import AppKit
import Foundation

/// Sends a single chat command to Path of Exile.
///
/// Compliance: one call sends exactly one chat message, and is only ever made
/// in direct response to the user pressing a button. There is no queue, no
/// retry, and no way to chain commands — GGG's rules for standalone
/// applications require one user action to produce at most one game action.
enum ChatSender {
  enum ChatError: Error {
    case permissionDenied
    case gameNotRunning
    case emptyCommand

    var code: String {
      switch self {
      case .permissionDenied: return "permission_denied"
      case .gameNotRunning: return "game_not_running"
      case .emptyCommand: return "empty_command"
      }
    }

    var message: String {
      switch self {
      case .permissionDenied:
        return "Accessibility permission is required to send chat commands."
      case .gameNotRunning:
        return "Path of Exile is not running."
      case .emptyCommand:
        return "The command was empty."
      }
    }
  }

  private static let returnKey: CGKeyCode = 36

  /// Types `command` into the game's chat box and submits it.
  ///
  /// A newline would end one message and begin another, so the text is
  /// stripped of them before sending; this is what keeps a single call to a
  /// single game action.
  static func send(command: String) -> Result<Void, ChatError> {
    let sanitized = command
      .replacingOccurrences(of: "\r", with: " ")
      .replacingOccurrences(of: "\n", with: " ")
      .trimmingCharacters(in: .whitespacesAndNewlines)

    guard !sanitized.isEmpty else { return .failure(.emptyCommand) }
    guard PermissionService.accessibilityStatus() == .granted else {
      return .failure(.permissionDenied)
    }
    guard let game = GameLocator.runningGame() else {
      return .failure(.gameNotRunning)
    }

    let pid = game.processIdentifier
    let source = CGEventSource(stateID: .hidSystemState)

    // Enter opens the chat box, the text is typed, Enter submits it.
    postReturn(source: source, pid: pid)
    postText(sanitized, source: source, pid: pid)
    postReturn(source: source, pid: pid)

    LogStore.shared.append(
      level: "info",
      scope: "chat",
      message: "Sent chat command (\(sanitized.count) chars)"
    )
    return .success(())
  }

  private static func postReturn(source: CGEventSource?, pid: pid_t) {
    let down = CGEvent(keyboardEventSource: source, virtualKey: returnKey, keyDown: true)
    let up = CGEvent(keyboardEventSource: source, virtualKey: returnKey, keyDown: false)
    down?.postToPid(pid)
    up?.postToPid(pid)
  }

  /// Delivers the whole string in one synthetic event rather than one event
  /// per character, which is both faster and far less likely to interleave
  /// with the player's own typing.
  private static func postText(_ text: String, source: CGEventSource?, pid: pid_t) {
    let utf16 = Array(text.utf16)
    guard
      let down = CGEvent(keyboardEventSource: source, virtualKey: 0, keyDown: true),
      let up = CGEvent(keyboardEventSource: source, virtualKey: 0, keyDown: false)
    else {
      return
    }
    utf16.withUnsafeBufferPointer { buffer in
      guard let base = buffer.baseAddress else { return }
      down.keyboardSetUnicodeString(stringLength: utf16.count, unicodeString: base)
      up.keyboardSetUnicodeString(stringLength: utf16.count, unicodeString: base)
    }
    down.postToPid(pid)
    up.postToPid(pid)
  }
}
