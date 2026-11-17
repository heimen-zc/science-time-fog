import Foundation

public final class LocalProgressRepository: ProgressRepository {
  public let directory: URL
  public var fileURL: URL { directory.appendingPathComponent("progress.json") }
  public init(directory: URL) { self.directory = directory }
  public func load() throws -> AppSnapshot {
    guard FileManager.default.fileExists(atPath: fileURL.path) else { return AppSnapshot() }
    do {
      let attributes = try FileManager.default.attributesOfItem(atPath: fileURL.path)
      guard let size = attributes[.size] as? NSNumber, size.intValue <= 16_000_000 else {
        throw DomainError.corruptStore
      }
      // @CfSecAICode 遵循消费金融安全编码 SEC-MAINSITE-DESERIALIZE-001 规范: 只解码固定 JSON 数据类型并校验版本 数量 数值和引用。
      let value = try JSONDecoder().decode(AppSnapshot.self, from: Data(contentsOf: fileURL))
      try SnapshotValidator.validate(value)
      return value
    } catch let error as DomainError { throw error } catch { throw DomainError.corruptStore }
  }
  public func save(_ snapshot: AppSnapshot) throws {
    try SnapshotValidator.validate(snapshot)
    do {
      try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
      let encoder = JSONEncoder()
      encoder.outputFormatting = [.sortedKeys]
      let data = try encoder.encode(snapshot)
      #if os(iOS)
        try data.write(
          to: fileURL, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
      #else
        try data.write(to: fileURL, options: .atomic)
      #endif
    } catch { throw DomainError.ioFailure }
  }
  public func reset() throws -> AppSnapshot {
    if FileManager.default.fileExists(atPath: fileURL.path) {
      let backup = directory.appendingPathComponent(
        "progress-before-reset-\(UUID().uuidString).json")
      do { try FileManager.default.copyItem(at: fileURL, to: backup) } catch {
        throw DomainError.ioFailure
      }
    }
    let blank = AppSnapshot()
    try save(blank)
    return blank
  }
}
