import XCTest

@testable import TimeFogCore

final class MemoryRepository: ProgressRepository {
  var value = AppSnapshot()
  var fail = false
  var writes = 0
  func load() throws -> AppSnapshot { value }
  func save(_ snapshot: AppSnapshot) throws {
    if fail { throw DomainError.ioFailure }
    value = snapshot
    writes += 1
  }
  func reset() throws -> AppSnapshot {
    value = AppSnapshot()
    return value
  }
}
enum Fixtures {
  static func ring(_ run: UUID, _ action: ExperimentAction, _ polarity: Polarity = .normal)
    -> ExperimentRecord
  {
    let duration = RingPhysics.duration(action)
    let count = Int(ceil(duration * 60))
    let samples = (0...count).map { i -> Sample in
      let t = min(duration, Double(i) / 60)
      return Sample(time: t, frame: RingPhysics.frame(action: action, polarity: polarity, time: t))
    }
    return ExperimentRecord(
      runID: run, kind: .ring, action: action, polarity: polarity, samples: samples)
  }
  static func magnet(_ run: UUID, _ action: ExperimentAction, _ initial: ScienceFrame? = nil)
    -> ExperimentRecord
  {
    var frame = initial ?? MagnetPhysics.initial(action == .approach ? 0 : 1)
    if action == .hold {
      for _ in 0..<40 { frame = MagnetPhysics.sample(previous: frame, position: 1, delta: 1 / 60) }
    }
    var samples = [Sample(time: 0, frame: frame)]
    let count = action == .hold ? 90 : 140
    for i in 1...count {
      frame =
        action == .hold
        ? MagnetPhysics.sample(previous: frame, position: 1, delta: 1 / 60)
        : MagnetPhysics.follow(previous: frame, target: action == .approach ? 1 : 0, delta: 1 / 60)
      samples.append(Sample(time: Double(i) / 60, frame: frame))
    }
    return ExperimentRecord(runID: run, kind: .magnet, action: action, samples: samples)
  }
  static func throughExperiments(_ session: ChapterSession) throws {
    try session.send(.advance)
    let run = session.engine.snapshot.runID
    for a in [ExperimentAction.connect, .hold, .disconnect] {
      try session.send(.record(ring(run, a)))
    }
    try session.send(.overlay)
    try session.send(.flipBattery)
    for a in [ExperimentAction.connect, .hold, .disconnect] {
      try session.send(.record(ring(run, a, .reversed)))
    }
    let ring = session.engine.snapshot.currentRecords
    let a = ring.first { $0.action == .connect && $0.polarity == .normal }!
    let b = ring.first { $0.action == .connect && $0.polarity == .reversed }!
    try session.send(
      .compare(
        EvidenceProof(
          kind: .jolt, evidenceIDs: [a.id, b.id], checkpoint: EvidenceJudge.bestCheckpoint(a))))
    try session.send(.advance)
    let approach = magnet(run, .approach)
    let hold = magnet(run, .hold, approach.samples.last!.frame)
    let away = magnet(run, .withdraw, hold.samples.last!.frame)
    for r in [approach, hold, away] { try session.send(.record(r)) }
  }
  static func completeProofs(_ session: ChapterSession) throws {
    try session.send(.advance)
    let records = session.engine.snapshot.currentRecords
    let a = records.first { $0.kind == .ring && $0.action == .connect && $0.polarity == .normal }!
    let b = records.first { $0.kind == .ring && $0.action == .connect && $0.polarity == .reversed }!
    try session.send(
      .prove(
        .init(kind: .jolt, evidenceIDs: [a.id, b.id], checkpoint: EvidenceJudge.bestCheckpoint(a))))
    try session.send(.advance)
    let m = records.first { $0.action == .approach }!
    try session.send(
      .prove(
        .init(
          kind: .leak, evidenceIDs: [m.id], checkpoint: EvidenceJudge.bestCheckpoint(m),
          batteryRemoved: true)))
    try session.send(.advance)
    let cycle = EvidenceJudge.cycle(records)!
    try session.send(
      .prove(.init(kind: .persistent, evidenceIDs: cycle.map(\.id), checkpoint: 0.5)))
  }
}

final class PhysicsTests: XCTestCase {
  func testSwitchContactAndDirection() {
    XCTAssertEqual(RingPhysics.frame(action: .connect, polarity: .normal, time: 0.2).signal, 0)
    let normal = RingPhysics.frame(action: .connect, polarity: .normal, time: 0.55)
    let reverse = RingPhysics.frame(action: .connect, polarity: .reversed, time: 0.55)
    XCTAssertGreaterThan(normal.needle, 0.5)
    XCTAssertEqual(normal.needle, -reverse.needle, accuracy: 1e-10)
    XCTAssertLessThan(
      RingPhysics.frame(action: .disconnect, polarity: .normal, time: 0.25).needle, 0)
  }
  func testSteadyCurrentIsZeroButFluxRemains() {
    let f = RingPhysics.frame(action: .hold, polarity: .normal, time: 1)
    XCTAssertEqual(f.closed, 1)
    XCTAssertEqual(f.flux, 1)
    XCTAssertEqual(f.needle, 0)
    XCTAssertEqual(f.signal, 0)
  }
  func testMagnetSignalComesFromFluxChangeAndStops() {
    let a = MagnetPhysics.initial(0.3)
    let b = MagnetPhysics.sample(previous: a, position: 0.4, delta: 0.02)
    XCTAssertEqual(b.signal, (b.flux - a.flux) / 0.02 * 0.32, accuracy: 1e-10)
    var f = b
    for _ in 0..<120 { f = MagnetPhysics.sample(previous: f, position: 0.4, delta: 1 / 60) }
    XCTAssertEqual(f.signal, 0)
    XCTAssertLessThan(abs(f.needle), 0.0001)
    XCTAssertGreaterThan(f.flux, 0)
  }
  func testNonFiniteDoesNotEnterState() {
    let a = MagnetPhysics.initial()
    XCTAssertEqual(MagnetPhysics.follow(previous: a, target: .nan, delta: 0.02), a)
    XCTAssertTrue(RingPhysics.frame(action: .connect, polarity: .normal, time: .infinity).finite)
  }
}
final class EvidenceTests: XCTestCase {
  func testShortOrTamperedObservationRejected() throws {
    var r = Fixtures.ring(UUID(), .connect)
    try EvidenceValidator.validate(r)
    r.samples.removeLast(80)
    XCTAssertThrowsError(try EvidenceValidator.validate(r))
    r = Fixtures.ring(UUID(), .connect)
    r.samples[30].frame.needle = 0
    XCTAssertThrowsError(try EvidenceValidator.validate(r))
  }
  func testTimeReversalRejected() {
    var r = Fixtures.ring(UUID(), .connect)
    r.samples[10].time = 0
    XCTAssertThrowsError(try EvidenceValidator.validate(r))
  }
  func testFairnessReportsActionConfound() {
    let run = UUID()
    let a = Fixtures.ring(run, .connect)
    let b = Fixtures.ring(run, .disconnect, .reversed)
    let verdict = EvidenceJudge.selection(kind: .jolt, ids: [a.id, b.id], records: [a, b])
    XCTAssertFalse(verdict.ok)
    XCTAssertTrue(verdict.message.contains("动作也变了"))
  }
  func testFairPairNeedsActualOppositeFrame() {
    let run = UUID()
    let a = Fixtures.ring(run, .connect)
    let b = Fixtures.ring(run, .connect, .reversed)
    let p = EvidenceProof(kind: .jolt, evidenceIDs: [a.id, b.id], checkpoint: 0)
    XCTAssertFalse(EvidenceJudge.inspect(p, records: [a, b]).ok)
    var good = p
    good.checkpoint = EvidenceJudge.bestCheckpoint(a)
    XCTAssertTrue(EvidenceJudge.inspect(good, records: [a, b]).ok)
  }
  func testNearHoldAndSameSessionRequired() throws {
    let run = UUID()
    let a = Fixtures.magnet(run, .approach)
    let h = Fixtures.magnet(run, .hold)
    let w = Fixtures.magnet(run, .withdraw)
    for r in [a, h, w] { try EvidenceValidator.validate(r) }
    XCTAssertNotNil(EvidenceJudge.cycle([a, h, w]))
    var other = w
    other.runID = UUID()
    XCTAssertNil(EvidenceJudge.cycle([a, h, other]))
    var far = h
    far.samples = far.samples.map { Sample(time: $0.time, frame: MagnetPhysics.initial()) }
    XCTAssertThrowsError(try EvidenceValidator.validate(far))
    let p = EvidenceProof(kind: .persistent, evidenceIDs: [a.id, h.id, w.id], checkpoint: 0.5)
    XCTAssertTrue(EvidenceJudge.inspect(p, records: [a, h, w]).ok)
    var wrong = p
    wrong.checkpoint = 0
    XCTAssertFalse(EvidenceJudge.inspect(wrong, records: [a, h, w]).ok)
  }
  func testBatteryRemovalRequiredForLeak() {
    let a = Fixtures.magnet(UUID(), .approach)
    var p = EvidenceProof(
      kind: .leak, evidenceIDs: [a.id], checkpoint: EvidenceJudge.bestCheckpoint(a))
    XCTAssertFalse(EvidenceJudge.inspect(p, records: [a]).ok)
    p.batteryRemoved = true
    XCTAssertTrue(EvidenceJudge.inspect(p, records: [a]).ok)
  }
}
final class TransactionTests: XCTestCase {
  func testCompleteChapterAndReplayAreExactly100() throws {
    let repo = MemoryRepository()
    let session = try ChapterSession(repository: repo)
    try Fixtures.throughExperiments(session)
    XCTAssertEqual(session.engine.snapshot.stars, 70)
    try Fixtures.completeProofs(session)
    XCTAssertEqual(session.engine.snapshot.stars, 100)
    XCTAssertEqual(session.engine.snapshot.rewards.count, 10)
    XCTAssertTrue(session.engine.snapshot.completed)
    XCTAssertThrowsError(try session.send(.prove(session.engine.snapshot.proofs[0])))
    XCTAssertEqual(session.engine.snapshot.stars, 100)
    try session.send(.replay)
    XCTAssertEqual(session.engine.snapshot.step, .ringConnect)
    XCTAssertEqual(session.engine.snapshot.proofs.count, 0)
    let run = session.engine.snapshot.runID
    let change = try session.send(.record(Fixtures.ring(run, .connect)))
    XCTAssertTrue(change.rewards.isEmpty)
    XCTAssertEqual(session.engine.snapshot.stars, 100)
  }
  func testFailedSaveDoesNotPublishAndRetryCommitsOnce() throws {
    let repo = MemoryRepository()
    let session = try ChapterSession(repository: repo)
    try session.send(.advance)
    repo.fail = true
    XCTAssertThrowsError(
      try session.send(.record(Fixtures.ring(session.engine.snapshot.runID, .connect))))
    XCTAssertEqual(session.engine.snapshot.stars, 0)
    XCTAssertEqual(repo.value.stars, 0)
    XCTAssertNotNil(session.pending)
    XCTAssertThrowsError(try session.send(.advance))
    repo.fail = false
    try session.retry()
    XCTAssertEqual(session.engine.snapshot.stars, 10)
    XCTAssertEqual(repo.value.stars, 10)
    XCTAssertNil(session.pending)
    XCTAssertThrowsError(try session.retry())
  }
  func testWrongStepAndFakeLedgerFailClosed() throws {
    let session = try ChapterSession(repository: MemoryRepository())
    XCTAssertThrowsError(try session.send(.overlay))
    var value = AppSnapshot()
    value.step = .completed
    XCTAssertThrowsError(try SnapshotValidator.validate(value))
  }
}
final class ObservationClockTests: XCTestCase {
  func testPauseAndBackgroundNeverCatchUp() {
    var clock = ObservationClock()
    XCTAssertNil(clock.step(now: 10, running: true))
    XCTAssertEqual(clock.step(now: 10.02, running: true)!, 0.02, accuracy: 1e-8)
    XCTAssertNil(clock.step(now: 10.03, running: false))
    XCTAssertNil(clock.step(now: 80, running: true))
    XCTAssertEqual(clock.step(now: 80.02, running: true)!, 0.02, accuracy: 1e-8)
  }
  func testLongFrameDoesNotAwardElapsedWallTime() {
    var clock = ObservationClock()
    XCTAssertNil(clock.step(now: 1, running: true))
    XCTAssertNil(clock.step(now: 5, running: true))
    XCTAssertEqual(clock.step(now: 5.02, running: true)!, 0.02, accuracy: 1e-8)
  }
  func testTinyCallbacksAccumulateInsteadOfInventingTime() {
    var clock = ObservationClock()
    XCTAssertNil(clock.step(now: 1, running: true))
    XCTAssertNil(clock.step(now: 1.001, running: true))
    XCTAssertNil(clock.step(now: 1.002, running: true))
    XCTAssertEqual(clock.step(now: 1.005, running: true)!, 0.005, accuracy: 1e-8)
  }
}
final class RepositoryTests: XCTestCase {
  func testDiskRoundtripCorruptionAndResetBackup() throws {
    let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    defer { try? FileManager.default.removeItem(at: directory) }
    let repo = LocalProgressRepository(directory: directory)
    let session = try ChapterSession(repository: repo)
    try session.send(.advance)
    try session.send(.record(Fixtures.ring(session.engine.snapshot.runID, .connect)))
    XCTAssertEqual(try repo.load(), session.engine.snapshot)
    try Data("{broken".utf8).write(to: repo.fileURL)
    XCTAssertThrowsError(try repo.load())
    XCTAssertEqual(String(data: try Data(contentsOf: repo.fileURL), encoding: .utf8), "{broken")
    let blank = try repo.reset()
    XCTAssertEqual(blank.stars, 0)
    XCTAssertEqual(
      try FileManager.default.contentsOfDirectory(atPath: directory.path).filter {
        $0.contains("before-reset")
      }.count, 1)
  }
  func testUnknownVersionIsNotOverwritten() throws {
    let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    defer { try? FileManager.default.removeItem(at: directory) }
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    let repo = LocalProgressRepository(directory: directory)
    var future = AppSnapshot()
    future.schemaVersion = 999
    let data = try JSONEncoder().encode(future)
    try data.write(to: repo.fileURL)
    XCTAssertThrowsError(try repo.load()) {
      XCTAssertEqual($0 as? DomainError, .unsupportedVersion)
    }
    XCTAssertEqual(try Data(contentsOf: repo.fileURL), data)
  }
}
