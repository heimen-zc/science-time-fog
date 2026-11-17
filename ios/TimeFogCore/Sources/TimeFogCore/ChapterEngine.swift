import Foundation

public enum ChapterCommand {
  case advance
  case record(ExperimentRecord)
  case overlay, flipBattery
  case compare(EvidenceProof)
  case prove(EvidenceProof)
  case replay
  case preferences(Preferences)
}
public struct ChangeSet {
  public let snapshot: AppSnapshot
  public let rewards: [RewardEntry]
}
public struct ChapterEngine {
  public private(set) var snapshot: AppSnapshot
  public init(snapshot: AppSnapshot = AppSnapshot()) { self.snapshot = snapshot }
  public func applying(_ command: ChapterCommand) throws -> ChangeSet {
    var next = snapshot
    var granted: [RewardEntry] = []
    func award(_ id: RewardID, _ records: [ExperimentRecord], _ proof: EvidenceProof? = nil) {
      guard !next.earned(id) else { return }
      let entry = RewardEntry(eventID: id, evidenceIDs: records.map(\.id), proof: proof)
      next.rewards.append(entry)
      granted.append(entry)
    }
    switch command {
    case .advance:
      switch next.step {
      case .brief: next.step = .ringConnect
      case .magnetIntro: next.step = .magnetApproach
      case .cases:
        next.step =
          next.proofs.contains(where: { $0.kind == .jolt })
          ? (next.proofs.contains(where: { $0.kind == .leak }) ? .proofStatic : .proofLeak)
          : .proofJolt
      default: throw DomainError.invalidStep
      }
    case .record(let observation):
      guard observation.runID == next.runID else {
        throw DomainError.invalidObservation("请使用当前实验会话的记录。")
      }
      let expected: (Apparatus, ExperimentAction, Polarity, ChapterStep)
      switch next.step {
      case .ringConnect: expected = (.ring, .connect, .normal, .ringZero)
      case .ringZero: expected = (.ring, .hold, .normal, .ringDisconnect)
      case .ringDisconnect: expected = (.ring, .disconnect, .normal, .ringOverlay)
      case .reversedConnect: expected = (.ring, .connect, .reversed, .reversedZero)
      case .reversedZero: expected = (.ring, .hold, .reversed, .reversedDisconnect)
      case .reversedDisconnect: expected = (.ring, .disconnect, .reversed, .ringCompare)
      case .magnetApproach: expected = (.magnet, .approach, .normal, .magnetHold)
      case .magnetHold: expected = (.magnet, .hold, .normal, .magnetWithdraw)
      case .magnetWithdraw: expected = (.magnet, .withdraw, .normal, .cases)
      default: throw DomainError.invalidStep
      }
      guard observation.kind == expected.0, observation.action == expected.1,
        observation.polarity == expected.2
      else { throw DomainError.invalidStep }
      guard !next.observations.contains(where: { $0.id == observation.id }) else {
        throw DomainError.invalidObservation("这份观察已经保存。")
      }
      try EvidenceValidator.validate(observation)
      next.observations.append(observation)
      switch next.step {
      case .ringConnect: award(.R01, [observation])
      case .ringZero: award(.R02, [observation])
      case .magnetApproach: award(.R05, [observation])
      case .magnetHold: award(.R06, [observation])
      case .magnetWithdraw:
        guard let cycle = EvidenceJudge.cycle(next.currentRecords) else {
          throw DomainError.missingEvidence("还需要同一次靠近和近处停住的证据。")
        }
        award(.R07, cycle)
      default: break
      }
      next.step = expected.3
    case .overlay:
      guard next.step == .ringOverlay else { throw DomainError.invalidStep }
      guard let pair = EvidenceJudge.normalOverlay(next.currentRecords) else {
        throw DomainError.missingEvidence("需要同一套装置的接通与断开胶片。")
      }
      award(.R03, pair)
      next.step = .ringFlip
    case .flipBattery:
      guard next.step == .ringFlip else { throw DomainError.invalidStep }
      next.step = .reversedConnect
    case .compare(let proof):
      guard next.step == .ringCompare else { throw DomainError.invalidStep }
      let ring = next.currentRecords.filter { $0.kind == .ring }
      guard EvidenceJudge.sixRing(ring) else {
        throw DomainError.missingEvidence("正接与反接的六次真实观察还没有齐。")
      }
      guard proof.kind == .jolt else { throw DomainError.invalidStep }
      let verdict = EvidenceJudge.inspect(proof, records: ring)
      guard verdict.ok else { throw DomainError.unfairComparison(verdict.message) }
      award(.R04, ring, proof)
      next.step = .magnetIntro
    case .prove(let proof):
      guard next.step.proofKind == proof.kind else { throw DomainError.invalidStep }
      let verdict = EvidenceJudge.inspect(proof, records: next.observations)
      guard verdict.ok else { throw DomainError.notAtCheckpoint(verdict.message) }
      let records = proof.evidenceIDs.compactMap { id in next.observations.first { $0.id == id } }
      next.proofs.removeAll { $0.kind == proof.kind }
      next.proofs.append(proof)
      let id: RewardID = proof.kind == .jolt ? .R08 : proof.kind == .leak ? .R09 : .R10
      award(id, records, proof)
      next.step = proof.kind == .persistent ? .completed : .cases
    case .replay:
      guard next.completed else { throw DomainError.invalidStep }
      next.runID = UUID()
      next.step = .ringConnect
      next.proofs = []
    case .preferences(let prefs): next.preferences = prefs
    }
    // Keep every proof-bearing original; trim only unreferenced optional replays.
    let referenced = Set(next.rewards.flatMap(\.evidenceIDs) + next.proofs.flatMap(\.evidenceIDs))
    let recent = Set(next.observations.suffix(32).map(\.id))
    next.observations = next.observations.filter {
      referenced.contains($0.id) || recent.contains($0.id) || $0.runID == next.runID
    }
    try SnapshotValidator.validate(next)
    return ChangeSet(snapshot: next, rewards: granted)
  }
}

public protocol ProgressRepository: AnyObject {
  func load() throws -> AppSnapshot
  func save(_ snapshot: AppSnapshot) throws
  func reset() throws -> AppSnapshot
}

/// The same save-before-publish transaction is used by the app and failure tests.
public final class ChapterSession {
  public private(set) var engine: ChapterEngine
  public private(set) var pending: ChangeSet?
  public let repository: ProgressRepository
  public init(repository: ProgressRepository) throws {
    self.repository = repository
    self.engine = ChapterEngine(snapshot: try repository.load())
  }
  @discardableResult public func send(_ command: ChapterCommand) throws -> ChangeSet {
    guard pending == nil else { throw DomainError.ioFailure }
    let change = try engine.applying(command)
    pending = change
    return try retry()
  }
  @discardableResult public func retry() throws -> ChangeSet {
    guard let change = pending else { throw DomainError.invalidStep }
    try repository.save(change.snapshot)
    engine = ChapterEngine(snapshot: change.snapshot)
    pending = nil
    return change
  }
}
