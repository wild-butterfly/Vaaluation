import Foundation
import React

@objc(VLTrade)
final class VLTradeModule: NSObject {
  @objc static func requiresMainQueueSetup() -> Bool { false }

  /// Starts watching the client log. Raw lines are forwarded to JS, which
  /// keeps only recognized trade whispers.
  @objc(startWatching:rejecter:)
  func startWatching(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.main.async {
      GameLogWatcher.shared.onLines = { lines in
        VLEventsModule.emitLogLines(lines)
      }
      if GameLogWatcher.shared.start() {
        resolve(GameLogWatcher.shared.currentPath)
      } else {
        reject(
          "log_not_found",
          "Could not find the Path of Exile client log. Launch the game once, then try again.",
          nil
        )
      }
    }
  }

  @objc(stopWatching)
  func stopWatching() {
    DispatchQueue.main.async {
      GameLogWatcher.shared.stop()
    }
  }

  @objc(isWatching:rejecter:)
  func isWatching(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter _: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.main.async {
      resolve(GameLogWatcher.shared.isWatching)
    }
  }

  /// Trade history is stored locally so it survives a restart. It holds only
  /// recognized trade requests — never other chat — and is never uploaded.
  private var historyURL: URL {
    let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
    let dir = base.appendingPathComponent("Vaaluation", isDirectory: true)
    try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    return dir.appendingPathComponent("trade-history.json")
  }

  @objc(loadHistory:rejecter:)
  func loadHistory(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter _: @escaping RCTPromiseRejectBlock
  ) {
    let url = historyURL
    DispatchQueue.global(qos: .utility).async {
      let text = (try? String(contentsOf: url, encoding: .utf8)) ?? nil
      DispatchQueue.main.async { resolve(text) }
    }
  }

  @objc(saveHistory:resolver:rejecter:)
  func saveHistory(
    _ json: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    let url = historyURL
    DispatchQueue.global(qos: .utility).async {
      do {
        try json.write(to: url, atomically: true, encoding: .utf8)
        DispatchQueue.main.async { resolve(nil) }
      } catch {
        DispatchQueue.main.async {
          reject("write_failed", "Could not save trade history: \(error.localizedDescription)", nil)
        }
      }
    }
  }

  /// Appends one completed request, keeping the newest first and ignoring a
  /// request already recorded. Done natively so concurrent writes from more
  /// than one window cannot clobber each other.
  @objc(appendHistory:resolver:rejecter:)
  func appendHistory(
    _ json: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    let url = historyURL
    DispatchQueue.global(qos: .utility).async {
      guard
        let entryData = json.data(using: .utf8),
        let entry = try? JSONSerialization.jsonObject(with: entryData) as? [String: Any],
        let id = entry["id"] as? String
      else {
        DispatchQueue.main.async {
          reject("invalid_entry", "History entry was not a JSON object with an id", nil)
        }
        return
      }

      var entries: [[String: Any]] = []
      if let existing = try? Data(contentsOf: url),
        let parsed = try? JSONSerialization.jsonObject(with: existing) as? [[String: Any]]
      {
        entries = parsed
      }
      guard !entries.contains(where: { ($0["id"] as? String) == id }) else {
        DispatchQueue.main.async { resolve(nil) }
        return
      }

      entries.insert(entry, at: 0)
      if entries.count > 300 { entries = Array(entries.prefix(300)) }

      do {
        let data = try JSONSerialization.data(withJSONObject: entries)
        try data.write(to: url, options: .atomic)
        DispatchQueue.main.async { resolve(nil) }
      } catch {
        DispatchQueue.main.async {
          reject("write_failed", "Could not save trade history", nil)
        }
      }
    }
  }

  @objc(clearHistory:rejecter:)
  func clearHistory(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter _: @escaping RCTPromiseRejectBlock
  ) {
    let url = historyURL
    DispatchQueue.global(qos: .utility).async {
      try? FileManager.default.removeItem(at: url)
      DispatchQueue.main.async { resolve(nil) }
    }
  }

  /// Log lines that arrived before React was listening.
  @objc(drainPendingLines:rejecter:)
  func drainPendingLines(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter _: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.main.async {
      resolve(VLEventsModule.drainPendingLines())
    }
  }

  @objc(consumePendingShowTrades:rejecter:)
  func consumePendingShowTrades(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter _: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.main.async {
      resolve(VLEventsModule.consumePendingShowTrades())
    }
  }

  /// Sends exactly one chat command, in response to one user action.
  @objc(sendChatCommand:resolver:rejecter:)
  func sendChatCommand(
    _ command: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.main.async {
      switch ChatSender.send(command: command) {
      case .success:
        resolve(nil)
      case .failure(let error):
        reject(error.code, error.message, nil)
      }
    }
  }
}
