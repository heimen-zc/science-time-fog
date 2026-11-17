import Foundation

public enum EvidenceJudge {
  public static func frame(_ record: ExperimentRecord, at progress: Double) -> ScienceFrame {
    guard !record.samples.isEmpty, progress.isFinite else { return ScienceFrame() }
    let time = max(0, min(1, progress)) * record.duration
    guard let index = record.samples.firstIndex(where: { $0.time >= time }) else {
      return record.samples.last!.frame
    }
    let b = record.samples[index]
    let a = record.samples[max(0, index - 1)]
    let f = b.time > a.time ? (time - a.time) / (b.time - a.time) : 0
    func lerp(_ x: Double, _ y: Double) -> Double { x + (y - x) * f }
    return ScienceFrame(
      closed: lerp(a.frame.closed, b.frame.closed),
      position: lerp(a.frame.position, b.frame.position), flux: lerp(a.frame.flux, b.frame.flux),
      signal: lerp(a.frame.signal, b.frame.signal), needle: lerp(a.frame.needle, b.frame.needle))
  }
  public static func bestCheckpoint(_ record: ExperimentRecord) -> Double {
    guard record.duration > 0,
      let sample = record.samples.max(by: { abs($0.frame.needle) < abs($1.frame.needle) })
    else { return 0 }
    return sample.time / record.duration
  }
  public static func cycle(_ records: [ExperimentRecord]) -> [ExperimentRecord]? {
    guard let a = records.last(where: { $0.kind == .magnet && $0.action == .approach }),
      let h = records.last(where: {
        $0.kind == .magnet && $0.action == .hold && $0.runID == a.runID
      }),
      let w = records.last(where: {
        $0.kind == .magnet && $0.action == .withdraw && $0.runID == a.runID
      }),
      [a, h, w].allSatisfy({ (try? EvidenceValidator.validate($0)) != nil })
    else { return nil }
    return [a, h, w]
  }
  public static func selection(kind: CaseID, ids: [UUID], records: [ExperimentRecord]) -> Verdict {
    let chosen = ids.compactMap { id in records.first { $0.id == id } }
    let count = kind == .jolt ? 2 : kind == .leak ? 1 : 3
    guard ids.count == count, chosen.count == count, Set(ids).count == count else {
      return Verdict(false, "先装入这一关需要的个人实验胶片。")
    }
    guard chosen.allSatisfy({ (try? EvidenceValidator.validate($0)) != nil }) else {
      return Verdict(false, "这份观察不完整，请回实验台补做。")
    }
    if kind == .jolt {
      let a = chosen[0]
      let b = chosen[1]
      guard a.kind == .ring, b.kind == .ring, a.action != .hold, b.action != .hold else {
        return Verdict(false, "需要两份通断瞬间的记录，保持时的零读数不能比较偏转方向。")
      }
      guard a.runID == b.runID, a.configuration == b.configuration else {
        return Verdict(false, "这组记录还改变了装置条件，请保持线圈、接线和同次实验不变。")
      }
      guard a.action == b.action else {
        return Verdict(false, "开关动作也变了。保留 A，只把 B 换成同样的\(a.action.title)，再比较电池方向。")
      }
      guard a.polarity != b.polarity else { return Verdict(false, "两份记录的电池方向相同。保持动作相同，只反转电池。") }
      return Verdict(true, "只改变了电池方向。拖动光标，看两支指针。")
    }
    if kind == .leak {
      let r = chosen[0]
      return r.kind == .magnet && r.action != .hold && r.configuration.batteryPairs == 0
        && r.peak > 0.01
        ? Verdict(true, "这是无电池的运动记录。先移开解释中的电池，再找响应。")
        : Verdict(false, "需要无电池、但磁铁运动时确实出现响应的胶片。")
    }
    guard chosen.map(\.action) == [.approach, .hold, .withdraw], let cycle = cycle(chosen),
      cycle.map(\.id) == ids
    else { return Verdict(false, "请接入同一次实验的靠近、近处停住、远离三段；不能拼接不同会话。") }
    return Verdict(true, "三段胶片接通了。找到磁铁还在近处、指针却归零的中段。")
  }
  public static func inspect(_ proof: EvidenceProof, records: [ExperimentRecord]) -> Verdict {
    let checked = selection(kind: proof.kind, ids: proof.evidenceIDs, records: records)
    guard checked.ok else { return checked }
    guard proof.checkpoint.isFinite, (0...1).contains(proof.checkpoint) else {
      return Verdict(false, "把光标放回记录范围内。")
    }
    let chosen = proof.evidenceIDs.map { id in records.first { $0.id == id }! }
    switch proof.kind {
    case .jolt:
      let a = frame(chosen[0], at: proof.checkpoint)
      let b = frame(chosen[1], at: proof.checkpoint)
      return a.needle * b.needle < -0.008
        ? Verdict(true, "同样动作，两支指针确实朝相反方向偏转。") : Verdict(false, "现在看不清方向差异。把光标移到两针明显偏转的一刻。")
    case .leak:
      guard proof.batteryRemoved else { return Verdict(false, "先移开解释中的电池，检验它是不是必需的。") }
      let f = frame(chosen[0], at: proof.checkpoint)
      return abs(f.needle) > max(0.0001, chosen[0].peak * 0.3)
        ? Verdict(true, "没有电池，运动中的磁铁仍让指针偏转。") : Verdict(false, "这帧还没有明显响应，找磁铁运动中的偏转高点。")
    case .persistent:
      let segment = min(2, Int(proof.checkpoint * 3))
      let local = proof.checkpoint * 3 - Double(segment)
      let f = frame(chosen[segment], at: local)
      return segment == 1 && f.position > 0.975 && f.flux > 0.9 && abs(f.needle) < 0.02
        ? Verdict(true, "磁铁还在近处，指针却已归零。关键是变化。") : Verdict(false, "不是远处的零。把光标移到中间近处停住的片段。")
    }
  }
  public static func normalOverlay(_ records: [ExperimentRecord]) -> [ExperimentRecord]? {
    guard
      let a = records.last(where: {
        $0.kind == .ring && $0.action == .connect && $0.polarity == .normal
      }),
      let b = records.last(where: {
        $0.kind == .ring && $0.action == .disconnect && $0.polarity == .normal
          && $0.runID == a.runID
      }), a.configuration == b.configuration, a.signedPeak * b.signedPeak < 0
    else { return nil }
    return [a, b]
  }
  public static func sixRing(_ records: [ExperimentRecord]) -> Bool {
    guard let run = records.first?.runID, records.allSatisfy({ $0.runID == run }) else {
      return false
    }
    return Polarity.allCases.allSatisfy { p in
      [ExperimentAction.connect, .hold, .disconnect].allSatisfy { a in
        records.contains { $0.kind == .ring && $0.polarity == p && $0.action == a }
      }
    }
  }
}

public enum SnapshotValidator {
  public static func validate(_ snapshot: AppSnapshot) throws {
    guard snapshot.schemaVersion == 1, snapshot.contentVersion == 1 else {
      throw DomainError.unsupportedVersion
    }
    guard snapshot.chapterID == "induction-1831", snapshot.observations.count <= 128,
      snapshot.rewards.count <= 10, snapshot.proofs.count <= 3,
      Set(snapshot.observations.map(\.id)).count == snapshot.observations.count,
      Set(snapshot.rewards.map(\.eventID)).count == snapshot.rewards.count,
      Set(snapshot.proofs.map(\.kind)).count == snapshot.proofs.count
    else { throw DomainError.corruptStore }
    for r in snapshot.observations {
      do { try EvidenceValidator.validate(r) } catch { throw DomainError.corruptStore }
    }
    for p in snapshot.proofs {
      guard EvidenceJudge.inspect(p, records: snapshot.observations).ok else {
        throw DomainError.corruptStore
      }
    }
    for entry in snapshot.rewards {
      let records = entry.evidenceIDs.compactMap { id in snapshot.observations.first { $0.id == id }
      }
      guard !records.isEmpty, records.count == entry.evidenceIDs.count,
        Set(entry.evidenceIDs).count == entry.evidenceIDs.count
      else { throw DomainError.corruptStore }
      let single = records.count == 1 ? records.first : nil
      var valid = false
      switch entry.eventID {
      case .R01:
        valid = single?.kind == .ring && single?.action == .connect && single?.polarity == .normal
      case .R02:
        valid = single?.kind == .ring && single?.action == .hold && single?.polarity == .normal
      case .R03: valid = EvidenceJudge.normalOverlay(records) != nil
      case .R04:
        valid =
          EvidenceJudge.sixRing(records) && entry.proof?.kind == .jolt
          && entry.proof.map { EvidenceJudge.inspect($0, records: records).ok } == true
      case .R05: valid = single?.kind == .magnet && single?.action == .approach
      case .R06: valid = single?.kind == .magnet && single?.action == .hold
      case .R07: valid = EvidenceJudge.cycle(records) != nil
      case .R08, .R09, .R10:
        let expected: CaseID =
          entry.eventID == .R08 ? .jolt : entry.eventID == .R09 ? .leak : .persistent
        valid =
          entry.proof?.kind == expected
          && entry.proof.map { EvidenceJudge.inspect($0, records: records).ok } == true
      }
      guard valid else { throw DomainError.corruptStore }
    }
    let ids = Set(snapshot.rewards.map(\.eventID))
    for (index, id) in RewardID.allCases.enumerated() where ids.contains(id) {
      guard Set(RewardID.allCases.prefix(index)).isSubset(of: ids) else {
        throw DomainError.corruptStore
      }
    }
    let minimum: RewardID?
    switch snapshot.step {
    case .ringZero: minimum = .R01
    case .ringDisconnect, .ringOverlay: minimum = .R02
    case .ringFlip, .reversedConnect, .reversedZero, .reversedDisconnect, .ringCompare:
      minimum = .R03
    case .magnetIntro, .magnetApproach: minimum = .R04
    case .magnetHold: minimum = .R05
    case .magnetWithdraw: minimum = .R06
    case .cases, .proofJolt: minimum = .R07
    case .proofLeak: minimum = .R08
    case .proofStatic: minimum = .R09
    case .completed: minimum = .R10
    default: minimum = nil
    }
    if let minimum, !ids.contains(minimum) { throw DomainError.corruptStore }
  }
}
