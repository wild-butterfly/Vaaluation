import AppKit
import ApplicationServices
import Foundation

/// Reports macOS privacy-permission state. Vaaluation's design needs only
/// Accessibility (to post the single item-copy keystroke, Milestone 4).
/// Global hotkeys use Carbon and need no permission at all, so Input
/// Monitoring is reported as "notRequired" — the UI explains rather than asks.
enum PermissionService {
  enum Status: String {
    case granted
    case denied
    case notRequired
  }

  static func accessibilityStatus() -> Status {
    AXIsProcessTrusted() ? .granted : .denied
  }

  static func inputMonitoringStatus() -> Status {
    .notRequired
  }

  static func statusDictionary() -> [String: String] {
    [
      "accessibility": accessibilityStatus().rawValue,
      "inputMonitoring": inputMonitoringStatus().rawValue,
    ]
  }

  /// Shows the system Accessibility prompt (adds the app to the list) at most
  /// once per launch; afterwards we only deep-link to System Settings.
  private static var promptShown = false

  static func requestAccessibility() {
    guard accessibilityStatus() == .denied else { return }
    if !promptShown {
      promptShown = true
      let options =
        [kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: true] as CFDictionary
      AXIsProcessTrustedWithOptions(options)
    } else {
      openSystemSettings(pane: "accessibility")
    }
  }

  static func openSystemSettings(pane: String) {
    let urlString: String
    switch pane {
    case "accessibility":
      urlString = "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"
    case "inputMonitoring":
      urlString = "x-apple.systempreferences:com.apple.preference.security?Privacy_ListenEvent"
    default:
      urlString = "x-apple.systempreferences:com.apple.preference.security"
    }
    if let url = URL(string: urlString) {
      NSWorkspace.shared.open(url)
    }
  }
}
