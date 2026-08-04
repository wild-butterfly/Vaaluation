import Foundation
import React

/// Native → JS event channel. Milestone 1 only carries navigation requests
/// from menu-bar actions into the React window.
@objc(VLEvents)
final class VLEventsModule: RCTEventEmitter {
  private static weak var shared: VLEventsModule?
  private var hasListeners = false
  private static var pendingRoute: String?
  /// Log lines seen before any React root attached. Bounded: this is a live
  /// tail, not a backlog to replay in full.
  private static var pendingLines: [String] = []
  private static let maxPendingLines = 200

  override init() {
    super.init()
    VLEventsModule.shared = self
  }

  override static func requiresMainQueueSetup() -> Bool { false }

  override func supportedEvents() -> [String] {
    ["vl:navigate", "vl:hotkey", "vl:permissions", "vl:item-copied", "vl:overlay", "vl:log-lines", "vl:show-trades"]
  }

  override func startObserving() {
    hasListeners = true
    if let route = VLEventsModule.pendingRoute {
      VLEventsModule.pendingRoute = nil
      sendEvent(withName: "vl:navigate", body: ["route": route])
    }
    if !VLEventsModule.pendingLines.isEmpty {
      let lines = VLEventsModule.pendingLines
      VLEventsModule.pendingLines = []
      sendEvent(withName: "vl:log-lines", body: ["lines": lines])
    }
  }

  override func stopObserving() {
    hasListeners = false
  }

  static func emitNavigate(route: String) {
    guard let instance = shared, instance.hasListeners else {
      pendingRoute = route
      return
    }
    instance.sendEvent(withName: "vl:navigate", body: ["route": route])
  }

  /// Fired when a registered global hotkey is pressed.
  static func emitHotkey(action: String) {
    guard let instance = shared, instance.hasListeners else { return }
    instance.sendEvent(withName: "vl:hotkey", body: ["action": action])
  }

  /// Fired after a price-check hotkey successfully captured item text.
  static func emitItemCopied(text: String, persistent: Bool) {
    guard let instance = shared, instance.hasListeners else { return }
    instance.sendEvent(
      withName: "vl:item-copied",
      body: ["text": text, "persistent": persistent]
    )
  }

  /// Fired when the overlay is shown, hidden or pinned.
  static func emitOverlayState(visible: Bool, pinned: Bool) {
    guard let instance = shared, instance.hasListeners else { return }
    instance.sendEvent(withName: "vl:overlay", body: ["visible": visible, "pinned": pinned])
  }

  /// Raw client-log lines. JS keeps only recognized trade whispers and
  /// discards everything else, so ordinary chat never leaves native memory.
  static func emitLogLines(_ lines: [String]) {
    guard let instance = shared, instance.hasListeners else {
      // No React root yet — hold the lines so a whisper that arrives while
      // the overlay is starting is not lost.
      pendingLines.append(contentsOf: lines)
      if pendingLines.count > maxPendingLines {
        pendingLines.removeFirst(pendingLines.count - maxPendingLines)
      }
      return
    }
    instance.sendEvent(withName: "vl:log-lines", body: ["lines": lines])
  }

  /// Asks the overlay to bring its Trades tab forward.
  static func emitShowTrades() {
    guard let instance = shared, instance.hasListeners else { return }
    instance.sendEvent(withName: "vl:show-trades", body: [:])
  }

  /// Fired when permission state may have changed (app became active).
  static func emitPermissions(_ status: [String: String]) {
    guard let instance = shared, instance.hasListeners else { return }
    instance.sendEvent(withName: "vl:permissions", body: status)
  }
}
