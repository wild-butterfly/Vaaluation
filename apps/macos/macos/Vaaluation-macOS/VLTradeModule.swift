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
