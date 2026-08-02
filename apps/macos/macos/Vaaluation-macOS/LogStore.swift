import Foundation

/// Local-only application log: a bounded in-memory ring plus a rotated file in
/// ~/Library/Logs/Vaaluation. Never contains item text unless the user
/// explicitly enables debug logging on the TypeScript side.
final class LogStore {
  static let shared = LogStore()

  private let queue = DispatchQueue(label: "com.vaaluation.logstore")
  private var entries: [[String: String]] = []
  private let maxEntries = 500
  private let maxFileBytes: UInt64 = 1_000_000

  private let logDirectory: URL
  private let logFile: URL

  private init() {
    let base = FileManager.default.urls(for: .libraryDirectory, in: .userDomainMask)[0]
    logDirectory = base.appendingPathComponent("Logs/Vaaluation", isDirectory: true)
    logFile = logDirectory.appendingPathComponent("Vaaluation.log")
    try? FileManager.default.createDirectory(at: logDirectory, withIntermediateDirectories: true)
  }

  func append(level: String, scope: String, message: String) {
    let entry: [String: String] = [
      "timestamp": ISO8601DateFormatter().string(from: Date()),
      "level": level,
      "scope": scope,
      "message": message,
    ]
    queue.async {
      self.entries.append(entry)
      if self.entries.count > self.maxEntries {
        self.entries.removeFirst(self.entries.count - self.maxEntries)
      }
      self.writeLine(entry)
    }
  }

  func recent(limit: Int) -> [[String: String]] {
    queue.sync { Array(entries.suffix(limit)) }
  }

  func clear() {
    queue.sync {
      entries.removeAll()
      try? FileManager.default.removeItem(at: logFile)
    }
  }

  var logFilePath: String { logFile.path }

  private func writeLine(_ entry: [String: String]) {
    rotateIfNeeded()
    let line = "\(entry["timestamp"] ?? "") [\(entry["level"] ?? "")] \(entry["scope"] ?? ""): \(entry["message"] ?? "")\n"
    guard let data = line.data(using: .utf8) else { return }
    if let handle = try? FileHandle(forWritingTo: logFile) {
      defer { try? handle.close() }
      _ = try? handle.seekToEnd()
      try? handle.write(contentsOf: data)
    } else {
      try? data.write(to: logFile)
    }
  }

  private func rotateIfNeeded() {
    guard
      let attributes = try? FileManager.default.attributesOfItem(atPath: logFile.path),
      let size = attributes[.size] as? UInt64,
      size > maxFileBytes
    else {
      return
    }
    let backup = logDirectory.appendingPathComponent("Vaaluation.log.1")
    try? FileManager.default.removeItem(at: backup)
    try? FileManager.default.moveItem(at: logFile, to: backup)
  }
}
