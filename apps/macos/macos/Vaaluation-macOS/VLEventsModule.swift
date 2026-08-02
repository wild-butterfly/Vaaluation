import Foundation
import React

/// Native → JS event channel. Milestone 1 only carries navigation requests
/// from menu-bar actions into the React window.
@objc(VLEvents)
final class VLEventsModule: RCTEventEmitter {
  private static weak var shared: VLEventsModule?
  private var hasListeners = false
  private static var pendingRoute: String?

  override init() {
    super.init()
    VLEventsModule.shared = self
  }

  override static func requiresMainQueueSetup() -> Bool { false }

  override func supportedEvents() -> [String] {
    ["vl:navigate"]
  }

  override func startObserving() {
    hasListeners = true
    if let route = VLEventsModule.pendingRoute {
      VLEventsModule.pendingRoute = nil
      sendEvent(withName: "vl:navigate", body: ["route": route])
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
}
