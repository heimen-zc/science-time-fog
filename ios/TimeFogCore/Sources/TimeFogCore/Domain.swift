import Foundation

public enum Apparatus: String, Codable, CaseIterable, Sendable { case ring, magnet }
public enum Polarity: String, Codable, CaseIterable, Sendable {
  case normal, reversed
  public var sign: Double { self == .normal ? 1 : -1 }
  public var title: String { self == .normal ? "正接" : "反接" }
}
public enum ExperimentAction: String, Codable, CaseIterable, Sendable {
  case connect, hold, disconnect, approach, withdraw
  public var title: String {
    switch self {
    case .connect: "合闸"
    case .hold: "停住观察"
    case .disconnect: "断开"
    case .approach: "靠近"
    case .withdraw: "远离"
    }
  }
}
public enum ChapterStep: String, Codable, CaseIterable, Sendable {
  case brief, ringConnect, ringZero, ringDisconnect, ringOverlay, ringFlip
  case reversedConnect, reversedZero, reversedDisconnect, ringCompare
  case magnetIntro, magnetApproach, magnetHold, magnetWithdraw
  case cases, proofJolt, proofLeak, proofStatic, completed
  public var isRing: Bool {
    [
      .ringConnect, .ringZero, .ringDisconnect, .ringFlip, .reversedConnect, .reversedZero,
      .reversedDisconnect,
    ].contains(self)
  }
  public var isMagnet: Bool { [.magnetApproach, .magnetHold, .magnetWithdraw].contains(self) }
  public var proofKind: CaseID? {
    switch self {
    case .proofJolt: .jolt
    case .proofLeak: .leak
    case .proofStatic: .persistent
    default: nil
    }
  }
  public var title: String {
    switch self {
    case .brief: "灯塔任务"
    case .ringConnect: "合上开关，盯住指针"
    case .ringZero: "电池还连着，指针却归零"
    case .ringDisconnect: "抬起同一个开关"
    case .ringOverlay: "把两次观察叠在一起"
    case .ringFlip: "这次，只反转电池"
    case .reversedConnect: "反接后，再合上开关"
    case .reversedZero: "电池反了，零还一样吗？"
    case .reversedDisconnect: "最后，再断开一次"
    case .ringCompare: "相同动作，两种方向"
    case .magnetIntro: "这次，把电池拿走"
    case .magnetApproach: "握住磁铁，沿导轨靠近"
    case .magnetHold: "松手，让磁铁留在这里"
    case .magnetWithdraw: "沿原路，把磁铁拉远"
    case .cases: "用证据，穿过解释迷雾"
    case .proofJolt: "只是桌面震动了吗？"
    case .proofLeak: "电池，是必需的吗？"
    case .proofStatic: "磁铁在，电流就一直在吗？"
    case .completed: "你把发现的方法带回来了"
    }
  }
}
public enum CaseID: String, Codable, CaseIterable, Sendable {
  case jolt, leak, persistent
  public var title: String {
    switch self {
    case .jolt: "纯震动说"
    case .leak: "铁环漏电说"
    case .persistent: "有磁铁就一直有电流"
    }
  }
  public var seal: String {
    switch self {
    case .jolt: "控制变量"
    case .leak: "排除替代解释"
    case .persistent: "保存零结果"
    }
  }
}
public struct ScienceFrame: Codable, Equatable, Sendable {
  public var closed: Double
  public var position: Double
  public var flux: Double
  public var signal: Double
  public var needle: Double
  public init(
    closed: Double = 0, position: Double = 0, flux: Double = 0, signal: Double = 0,
    needle: Double = 0
  ) {
    self.closed = closed
    self.position = position
    self.flux = flux
    self.signal = signal
    self.needle = needle
  }
  public var finite: Bool { [closed, position, flux, signal, needle].allSatisfy(\.isFinite) }
}
public struct Sample: Codable, Equatable, Sendable {
  public var time: Double
  public var frame: ScienceFrame
  public init(time: Double, frame: ScienceFrame) {
    self.time = time
    self.frame = frame
  }
}
public struct Configuration: Codable, Equatable, Sendable {
  public var core: String
  public var turns: Int
  public var batteryPairs: Int
  public var leads: Int
  public init(kind: Apparatus) {
    core = kind == .ring ? "iron" : "air"
    turns = 120
    batteryPairs = kind == .ring ? 1 : 0
    leads = 1
  }
}
public struct ExperimentRecord: Codable, Equatable, Identifiable, Sendable {
  public var id: UUID
  public var runID: UUID
  public var kind: Apparatus
  public var action: ExperimentAction
  public var polarity: Polarity
  public var configuration: Configuration
  public var modelVersion: Int
  public var samples: [Sample]
  public init(
    id: UUID = UUID(), runID: UUID, kind: Apparatus, action: ExperimentAction,
    polarity: Polarity = .normal, samples: [Sample]
  ) {
    self.id = id
    self.runID = runID
    self.kind = kind
    self.action = action
    self.polarity = polarity
    self.configuration = Configuration(kind: kind)
    self.modelVersion = 1
    self.samples = samples
  }
  public var duration: Double { samples.last?.time ?? 0 }
  public var peak: Double { samples.map { abs($0.frame.needle) }.max() ?? 0 }
  public var signedPeak: Double {
    samples.max { abs($0.frame.signal) < abs($1.frame.signal) }?.frame.signal ?? 0
  }
  public var title: String {
    kind == .ring ? "\(polarity.title) · \(action.title)" : "无电池 · \(action.title)"
  }
}
public struct EvidenceProof: Codable, Equatable, Identifiable, Sendable {
  public var kind: CaseID
  public var evidenceIDs: [UUID]
  public var checkpoint: Double
  public var batteryRemoved: Bool
  public var id: String { kind.rawValue }
  public init(kind: CaseID, evidenceIDs: [UUID], checkpoint: Double, batteryRemoved: Bool = false) {
    self.kind = kind
    self.evidenceIDs = evidenceIDs
    self.checkpoint = checkpoint
    self.batteryRemoved = batteryRemoved
  }
}
public enum RewardID: String, CaseIterable, Codable, Sendable {
  case R01, R02, R03, R04, R05, R06, R07, R08, R09, R10
}
public struct RewardDefinition: Sendable {
  public let id: RewardID
  public let stars: Int
  public let title: String
  public let reason: String
  public let unlock: String
  public static let all: [RewardDefinition] = [
    .init(id: .R01, stars: 10, title: "捕捉到那一下", reason: "你完整记录了合闸时短暂的偏转。", unlock: "瞬态线索卡"),
    .init(id: .R02, stars: 10, title: "零，也有用", reason: "电池还接着，另一侧的指针却归零。", unlock: "稳态零结果"),
    .init(id: .R03, stars: 10, title: "找到反向线索", reason: "同一套接线，接通和断开朝相反方向。", unlock: "电池方向对照"),
    .init(id: .R04, stars: 15, title: "公平对照成立", reason: "两次同样的合闸，只反转电池，指针便反向。", unlock: "回放对照镜"),
    .init(id: .R05, stars: 10, title: "没有电池，也有响应", reason: "你移动了磁铁，记录到真实的针偏。", unlock: "无电池运动线索"),
    .init(id: .R06, stars: 10, title: "最安静的发现", reason: "磁铁还在近处，稳定观察中指针已经归零。", unlock: "近处静止线索"),
    .init(id: .R07, stars: 5, title: "三段证据，接通了", reason: "你完成了同一次靠近、停住和远离。", unlock: "解释迷雾"),
    .init(id: .R08, stars: 10, title: "纯震动说被排除", reason: "同样动作，两针反向，纯震动解释不了它。", unlock: "控制变量印章"),
    .init(
      id: .R09, stars: 10, title: "漏电不是必要条件", reason: "移开解释中的电池，无电池记录仍有响应。", unlock: "排除替代解释印章"),
    .init(
      id: .R10, stars: 10, title: "找到了关键变化", reason: "磁铁仍在近处，静止时却没有持续响应。", unlock: "保存零结果印章 · 灯塔修复"),
  ]
  public static func get(_ id: RewardID) -> RewardDefinition { all.first { $0.id == id }! }
}
public struct RewardEntry: Codable, Equatable, Identifiable, Sendable {
  public var eventID: RewardID
  public var evidenceIDs: [UUID]
  public var proof: EvidenceProof?
  public var earnedAt: Date
  public var id: String { eventID.rawValue }
  public var definition: RewardDefinition { .get(eventID) }
  public init(eventID: RewardID, evidenceIDs: [UUID], proof: EvidenceProof? = nil) {
    self.eventID = eventID
    self.evidenceIDs = evidenceIDs
    self.proof = proof
    self.earnedAt = Date()
  }
}
public struct Preferences: Codable, Equatable, Sendable {
  public var reduceMotion = false
  public var haptics = true
  public var sound = true
  public var largeText = false
  public var tapAssist = false
  public init() {}
}
public struct AppSnapshot: Codable, Equatable, Sendable {
  public var schemaVersion = 1
  public var contentVersion = 1
  public var chapterID = "induction-1831"
  public var runID = UUID()
  public var step = ChapterStep.brief
  public var observations: [ExperimentRecord] = []
  public var proofs: [EvidenceProof] = []
  public var rewards: [RewardEntry] = []
  public var preferences = Preferences()
  public init() {}
  public var stars: Int { rewards.reduce(0) { $0 + $1.definition.stars } }
  public var completed: Bool { Set(rewards.map(\.eventID)) == Set(RewardID.allCases) }
  public var rank: String { stars == 100 ? "发现者" : stars >= 40 ? "证据侦探" : "观察学徒" }
  public var currentRecords: [ExperimentRecord] { observations.filter { $0.runID == runID } }
  public func earned(_ id: RewardID) -> Bool { rewards.contains { $0.eventID == id } }
}
public enum DomainError: LocalizedError, Equatable {
  case invalidStep
  case invalidObservation(String)
  case missingEvidence(String)
  case unfairComparison(String)
  case notAtCheckpoint(String)
  case corruptStore, unsupportedVersion, ioFailure
  public var errorDescription: String? {
    switch self {
    case .invalidStep: "先完成眼前这一步，证据会带你到下一站。"
    case .invalidObservation(let s), .missingEvidence(let s), .unfairComparison(let s),
      .notAtCheckpoint(let s):
      s
    case .corruptStore: "已有存档暂时无法读取。原文件保留着，请重试读取，或请家长帮助处理。"
    case .unsupportedVersion: "这份存档来自较新版本，当前不会覆盖它。"
    case .ioFailure: "这次保存没有完成。已有进展保留着，请重试保存。"
    }
  }
}
public struct Verdict: Equatable, Sendable {
  public var ok: Bool
  public var message: String
  public init(_ ok: Bool, _ message: String) {
    self.ok = ok
    self.message = message
  }
}
