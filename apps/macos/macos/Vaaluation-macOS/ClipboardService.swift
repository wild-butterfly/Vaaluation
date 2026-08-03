import AppKit
import Foundation

/// Clipboard integration around the game's item-copy behavior.
///
/// Compliance invariants:
/// - `triggerGameCopyAndRead` posts exactly ONE synthetic copy keystroke, and
///   only in direct response to the user's hotkey press.
/// - Only text that validates as a Path of Exile item is ever returned;
///   anything else is discarded immediately and never logged or stored.
/// - The user's previous clipboard is restored when we changed it.
final class ClipboardService {
  static let shared = ClipboardService()

  enum ClipboardError: Error {
    case permissionDenied
    case gameNotRunning
    case timeout
    case notAnItem

    var code: String {
      switch self {
      case .permissionDenied: return "permission_denied"
      case .gameNotRunning: return "game_not_running"
      case .timeout: return "timeout"
      case .notAnItem: return "not_an_item"
      }
    }

    var message: String {
      switch self {
      case .permissionDenied:
        return "Accessibility permission is required to send the copy keystroke."
      case .gameNotRunning:
        return "Path of Exile is not running."
      case .timeout:
        return "The game did not place anything on the clipboard. Hover an item and try again."
      case .notAnItem:
        return "The copied text is not a Path of Exile item."
      }
    }
  }

  private init() {}

  func readText() -> String? {
    NSPasteboard.general.string(forType: .string)
  }

  /// Quick shape check; full parsing happens in TypeScript.
  static func looksLikeItemText(_ text: String) -> Bool {
    text.range(of: #"^Rarity: .+"#, options: .regularExpression) != nil
      || text.range(of: #"^Item Class: .+"#, options: .regularExpression) != nil
  }

  /// Sends a single Cmd+C to the game process, waits for the pasteboard to
  /// change, validates the result, restores the previous clipboard where we
  /// replaced it, and completes with the item text.
  func triggerGameCopyAndRead(
    timeoutMs: Int,
    completion: @escaping (Result<String, ClipboardError>) -> Void
  ) {
    guard PermissionService.accessibilityStatus() == .granted else {
      completion(.failure(.permissionDenied))
      return
    }
    guard let game = GameLocator.runningGame() else {
      completion(.failure(.gameNotRunning))
      return
    }

    let pasteboard = NSPasteboard.general
    let previousText = pasteboard.string(forType: .string)
    let startChangeCount = pasteboard.changeCount

    postCopyKeystroke(pid: game.processIdentifier)

    let deadline = Date().addingTimeInterval(Double(timeoutMs) / 1000.0)
    pollPasteboard(
      pasteboard: pasteboard,
      startChangeCount: startChangeCount,
      deadline: deadline
    ) { [weak self] newText in
      guard let newText else {
        completion(.failure(.timeout))
        return
      }
      // Restore the user's clipboard: the item text was for us, not for them.
      self?.restore(previous: previousText, pasteboard: pasteboard)

      guard Self.looksLikeItemText(newText) else {
        completion(.failure(.notAnItem))
        return
      }
      completion(.success(newText))
    }
  }

  /// One keystroke: Cmd+C key-down + key-up delivered to the game's process.
  private func postCopyKeystroke(pid: pid_t) {
    let source = CGEventSource(stateID: .hidSystemState)
    let keyCVirtual: CGKeyCode = 8

    let keyDown = CGEvent(keyboardEventSource: source, virtualKey: keyCVirtual, keyDown: true)
    keyDown?.flags = .maskCommand
    let keyUp = CGEvent(keyboardEventSource: source, virtualKey: keyCVirtual, keyDown: false)
    keyUp?.flags = .maskCommand

    keyDown?.postToPid(pid)
    keyUp?.postToPid(pid)
    LogStore.shared.append(
      level: "debug",
      scope: "clipboard",
      message: "Posted copy keystroke to game (pid \(pid))"
    )
  }

  private func pollPasteboard(
    pasteboard: NSPasteboard,
    startChangeCount: Int,
    deadline: Date,
    completion: @escaping (String?) -> Void
  ) {
    if pasteboard.changeCount != startChangeCount {
      completion(pasteboard.string(forType: .string))
      return
    }
    if Date() >= deadline {
      completion(nil)
      return
    }
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.02) { [weak self] in
      self?.pollPasteboard(
        pasteboard: pasteboard,
        startChangeCount: startChangeCount,
        deadline: deadline,
        completion: completion
      )
    }
  }

  private func restore(previous: String?, pasteboard: NSPasteboard) {
    pasteboard.clearContents()
    if let previous {
      pasteboard.setString(previous, forType: .string)
    }
  }
}
