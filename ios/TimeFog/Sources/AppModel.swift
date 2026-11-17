import AudioToolbox
import Observation
import QuartzCore
import SwiftUI
import TimeFogCore

@MainActor @Observable final class AppModel {
  var snapshot = AppSnapshot()
  var frame = ScienceFrame()
  var busy = false
  var observationProgress = 0.0
  var latestReward: RewardEntry?
  var message = ""
  var errorMessage: String?
  var loadingFailed = false
  var labVisible = false
  var showingHelp = false
  var paused = false
  var sceneActive = true
  var checkpoint = 0.0
  var selectedA: UUID?
  var selectedB: UUID?
  var batteryRemoved = false
  var hintLevel = 0
  private var session: ChapterSession?
  private let repository: LocalProgressRepository
  private var samples: [Sample] = []
  private var elapsed = 0.0
  private var observationClock = ObservationClock()
  private var ringAction: ExperimentAction?
  private var magnetCapture = false
  private var target = 0.0
  private var lastStep = ChapterStep.brief

  init() {
    let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
    var folder = "TimeFog"
    #if DEBUG
      if ProcessInfo.processInfo.arguments.contains("--uitesting") { folder = "TimeFogUITests" }
    #endif
    repository = LocalProgressRepository(directory: base.appendingPathComponent(folder))
    #if DEBUG
      if ProcessInfo.processInfo.arguments.contains("--fresh") && folder == "TimeFogUITests" {
        try? FileManager.default.removeItem(at: repository.directory)
      }
    #endif
    load()
  }
  var pendingSave: Bool { session?.pending != nil }
  var step: ChapterStep { snapshot.step }
  var polarity: Polarity {
    [.reversedConnect, .reversedZero, .reversedDisconnect, .ringCompare, .magnetIntro].contains(
      step) ? .reversed : .normal
  }
  var records: [ExperimentRecord] { snapshot.currentRecords }
  var reduceMotion: Bool {
    snapshot.preferences.reduceMotion || UIAccessibility.isReduceMotionEnabled
  }
  var isObserving: Bool { busy || (step == .magnetHold && magnetCapture) }
  var proofKind: CaseID { step.proofKind ?? .jolt }
  var selectedIDs: [UUID] {
    if step == .ringCompare || proofKind == .jolt {
      return [selectedA, selectedB].compactMap { $0 }
    }
    if proofKind == .leak {
      return records.last(where: { $0.kind == .magnet && $0.action == .approach }).map { [$0.id] }
        ?? []
    }
    return EvidenceJudge.cycle(records)?.map(\.id) ?? []
  }
  var proof: EvidenceProof {
    EvidenceProof(
      kind: proofKind, evidenceIDs: selectedIDs, checkpoint: checkpoint,
      batteryRemoved: batteryRemoved)
  }
  var verdict: Verdict { EvidenceJudge.inspect(proof, records: snapshot.observations) }
  var ringCandidates: [ExperimentRecord] {
    records.filter { $0.kind == .ring && $0.action != .hold }
  }
  var guide: String {
    if snapshot.preferences.tapAssist {
      switch step {
      case .ringConnect, .reversedConnect:
        return "点下面的合闸按钮，再观察右侧指针。辅助操作会留下同样的真实证据。"
      case .ringDisconnect, .reversedDisconnect:
        return "点下面的断开按钮。电池和接线不变，看看方向与合闸时有什么不同。"
      case .magnetApproach:
        return "点下面的靠近按钮，磁铁会沿导轨移动。到达线圈旁后松手观察。"
      case .magnetWithdraw:
        return "点下面的远离按钮，沿同一条轨道拉远。辅助操作不影响奖励。"
      default: break
      }
    }
    return switch step {
    case .ringConnect, .reversedConnect: "只动左前方开关。合闸后先别再点，完整观察右侧指针归零。"
    case .ringZero, .reversedZero: "电池还接着。再观察一小段，看看另一侧有没有持续响应。"
    case .ringDisconnect, .reversedDisconnect: "电池方向和接线都保持不变，只抬起同一个开关。"
    case .ringFlip: "线圈、接线和动作都锁住。这一步只交换电池的正负方向。"
    case .magnetApproach: "握住导轨上的磁铁，拖到线圈旁；也可以点下面的靠近按钮。"
    case .magnetHold: "先松手。磁铁留在近处、指针稳定归零后，观察条才会推进。"
    case .magnetWithdraw: "磁极和接线不变，沿原路把磁铁拉回远端。"
    default: "每次只动一个条件，证据会告诉你下一步。"
    }
  }
  func load() {
    do {
      session = try ChapterSession(repository: repository)
      snapshot = session!.engine.snapshot
      loadingFailed = false
      errorMessage = nil
      prepareStep()
    } catch {
      session = nil
      loadingFailed = true
      errorMessage = error.localizedDescription
    }
  }
  @discardableResult private func transact(_ command: ChapterCommand) -> Bool {
    guard let session else {
      errorMessage = DomainError.corruptStore.localizedDescription
      return false
    }
    do {
      apply(try session.send(command))
      return true
    } catch {
      busy = false
      errorMessage = error.localizedDescription
      return false
    }
  }
  private func apply(_ change: ChangeSet) {
    let prior = step
    snapshot = change.snapshot
    if let reward = change.rewards.last {
      latestReward = reward
      if snapshot.preferences.haptics {
        UINotificationFeedbackGenerator().notificationOccurred(.success)
      }
      if snapshot.preferences.sound { AudioServicesPlaySystemSound(1057) }
    }
    message = ""
    if prior != step { prepareStep(preserveMagnet: prior.isMagnet && step.isMagnet) }
  }
  func retrySave() {
    do {
      guard let session else {
        load()
        return
      }
      apply(try session.retry())
      errorMessage = nil
    } catch { errorMessage = error.localizedDescription }
  }
  func setPreferences(_ value: Preferences) { _ = transact(.preferences(value)) }
  func advance() {
    latestReward = nil
    _ = transact(.advance)
  }
  func replay() {
    latestReward = nil
    _ = transact(.replay)
  }
  func overlay() {
    latestReward = nil
    _ = transact(.overlay)
  }
  func flip() {
    latestReward = nil
    _ = transact(.flipBattery)
  }
  func submitComparison() { submit(.compare(proof)) }
  func submitProof() { submit(.prove(proof)) }
  private func submit(_ command: ChapterCommand) {
    guard verdict.ok else {
      hintLevel += 1
      message = verdict.message
      return
    }
    latestReward = nil
    _ = transact(command)
  }
  func select(_ record: ExperimentRecord) {
    if selectedA == nil { selectedA = record.id } else { selectedB = record.id }
    message = EvidenceJudge.selection(kind: .jolt, ids: selectedIDs, records: records).message
  }
  func resetSelection() {
    selectedB = nil
    checkpoint = 0
    message = "保留 A，给 B 选择相同动作、相反电池方向的胶片。"
  }
  func showKeyFrame() {
    if proofKind == .persistent && step != .ringCompare {
      checkpoint = 0.5
    } else if let id = selectedIDs.first,
      let record = snapshot.observations.first(where: { $0.id == id })
    {
      checkpoint = EvidenceJudge.bestCheckpoint(record)
    }
    message = verdict.message
  }
  func requestHint() {
    hintLevel += 1
    message = hintLevel < 2 ? guide : "先看动作示范，或使用大按钮和慢放。奖励与自己拖动完全相同。"
  }
  func beginRing() {
    guard !busy, !pendingSave, !loadingFailed, step.isRing, step != .ringFlip else { return }
    let action: ExperimentAction =
      [.ringConnect, .reversedConnect].contains(step)
      ? .connect : [.ringZero, .reversedZero].contains(step) ? .hold : .disconnect
    latestReward = nil
    message = ""
    ringAction = action
    elapsed = 0
    observationProgress = 0
    frame = RingPhysics.frame(action: action, polarity: polarity, time: 0)
    samples = [Sample(time: 0, frame: frame)]
    busy = true
    observationClock.reset()
  }
  func setMagnetTarget(_ value: Double) {
    guard value.isFinite, step.isMagnet, !pendingSave, !loadingFailed else { return }
    target = MagnetPhysics.bounded(value)
    latestReward = nil
    if step != .magnetHold && !magnetCapture
      && ((step == .magnetApproach && target > 0.01) || (step == .magnetWithdraw && target < 0.99))
    {
      magnetCapture = true
      elapsed = 0
      samples = [Sample(time: 0, frame: frame)]
      busy = true
    }
  }
  func tick(now: TimeInterval) {
    let running =
      labVisible && sceneActive && !showingHelp && !paused && !loadingFailed && !pendingSave
    guard let dt = observationClock.step(now: now, running: running) else { return }
    if let action = ringAction, busy {
      elapsed += dt
      frame = RingPhysics.frame(action: action, polarity: polarity, time: elapsed)
      samples.append(Sample(time: elapsed, frame: frame))
      observationProgress = min(1, elapsed / RingPhysics.duration(action))
      if elapsed >= RingPhysics.duration(action) { finish(kind: .ring, action: action) }
    } else if step.isMagnet {
      frame = MagnetPhysics.follow(previous: frame, target: target, delta: dt)
      if step == .magnetHold {
        let stable =
          frame.position > 0.975 && abs(frame.signal) < 0.0000001 && abs(frame.needle) < 0.02
        if !stable {
          magnetCapture = false
          elapsed = 0
          samples = []
          observationProgress = 0
          return
        }
        if !magnetCapture {
          magnetCapture = true
          elapsed = 0
          samples = [Sample(time: 0, frame: frame)]
          busy = true
          return
        }
        elapsed += dt
        samples.append(Sample(time: elapsed, frame: frame))
        observationProgress = min(1, elapsed / 1.5)
        if elapsed >= 1.5 { finish(kind: .magnet, action: .hold) }
      } else if magnetCapture {
        elapsed += dt
        samples.append(Sample(time: elapsed, frame: frame))
        observationProgress = step == .magnetApproach ? frame.position : 1 - frame.position
        if samples.count >= 1190 {
          message = "这段观察先停在这里。回到起点，再做一次就好。"
          cancelObservation()
          return
        }
        if step == .magnetApproach && frame.position >= 1 {
          finish(kind: .magnet, action: .approach)
        } else if step == .magnetWithdraw && frame.position <= 0 {
          finish(kind: .magnet, action: .withdraw)
        }
      }
    }
  }
  private func finish(kind: Apparatus, action: ExperimentAction) {
    let observation = ExperimentRecord(
      runID: snapshot.runID, kind: kind, action: action,
      polarity: kind == .ring ? polarity : .normal, samples: samples)
    busy = false
    ringAction = nil
    magnetCapture = false
    samples = []
    elapsed = 0
    observationProgress = 0
    _ = transact(.record(observation))
  }
  func setSceneActive(_ active: Bool) {
    sceneActive = active
    observationClock.reset()
    if !active { cancelObservation() }
  }
  func leaveLab() {
    labVisible = false
    paused = false
    showingHelp = false
    cancelObservation()
  }
  func cancelObservation() {
    busy = false
    ringAction = nil
    magnetCapture = false
    samples = []
    elapsed = 0
    observationProgress = 0
    observationClock.reset()
    prepareFrame()
  }
  private func prepareStep(preserveMagnet: Bool = false) {
    busy = false
    ringAction = nil
    magnetCapture = false
    samples = []
    elapsed = 0
    observationProgress = 0
    observationClock.reset()
    checkpoint = 0
    batteryRemoved = false
    hintLevel = 0
    if !preserveMagnet { prepareFrame() }
    if step == .ringCompare || step == .proofJolt {
      selectedA =
        records.last(where: { $0.kind == .ring && $0.action == .connect && $0.polarity == .normal }
        )?.id
      selectedB = nil
    }
    lastStep = step
  }
  private func prepareFrame() {
    switch step {
    case .ringConnect, .reversedConnect: frame = ScienceFrame()
    case .ringZero, .ringDisconnect:
      frame = RingPhysics.frame(action: .hold, polarity: .normal, time: 2)
    case .reversedZero, .reversedDisconnect:
      frame = RingPhysics.frame(action: .hold, polarity: .reversed, time: 2)
    case .magnetHold, .magnetWithdraw:
      frame = MagnetPhysics.initial(1)
      target = 1
    case .magnetApproach, .magnetIntro:
      frame = MagnetPhysics.initial()
      target = 0
    default: frame = ScienceFrame()
    }
  }
  func resetAfterParentVerification() {
    do {
      _ = try repository.reset()
      latestReward = nil
      load()
    } catch { errorMessage = error.localizedDescription }
  }
}
