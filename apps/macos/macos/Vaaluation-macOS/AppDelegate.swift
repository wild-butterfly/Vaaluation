import Cocoa

final class AppDelegate: NSObject, NSApplicationDelegate {
  private var reactHost: ReactHost?
  private var statusItemController: StatusItemController?
  private var settingsWindowController: SettingsWindowController?

  func applicationDidFinishLaunching(_ notification: Notification) {
    // Menu-bar app: no Dock icon, no app switcher entry (LSUIElement is also
    // set in Info.plist; this keeps behavior correct when run from Xcode).
    NSApp.setActivationPolicy(.accessory)

    let host = ReactHost()
    reactHost = host
    statusItemController = StatusItemController(actions: self)

    LogStore.shared.append(level: "info", scope: "app", message: "Vaaluation launched")

    // Global shortcuts come straight from persisted settings so they work
    // before (and without) any React window existing.
    HotkeyCenter.shared.onHotkey = { [weak self] action in
      self?.handleHotkey(action: action)
    }
    let hotkeyErrors = HotkeyCenter.shared.applyFromSettings()
    for (action, error) in hotkeyErrors {
      LogStore.shared.append(
        level: "warn",
        scope: "hotkeys",
        message: "Could not register \(action): \(error.message)"
      )
    }

    if !SettingsStore.shared.onboardingCompleted {
      showSettingsWindow(route: "onboarding")
    }
  }

  func applicationDidBecomeActive(_ notification: Notification) {
    // Permission grants happen in System Settings; re-check whenever the user
    // comes back to us and let the React side update its UI.
    VLEventsModule.emitPermissions(PermissionService.statusDictionary())
  }

  private func handleHotkey(action: String) {
    VLEventsModule.emitHotkey(action: action)
    switch action {
    case "priceCheck", "priceCheckPersistent":
      // The capture→parse→overlay pipeline arrives in Milestones 3–4. Until
      // then the shortcut proves itself end-to-end in the log.
      LogStore.shared.append(
        level: "info",
        scope: "price-check",
        message: "Price check requested (pipeline lands in Milestones 3–4)"
      )
    case "toggleOverlay":
      showSettingsWindow(route: "settings")
    default:
      break
    }
  }

  func applicationWillTerminate(_ notification: Notification) {
    LogStore.shared.append(level: "info", scope: "app", message: "Vaaluation terminating")
  }

  private func showSettingsWindow(route: String) {
    guard let host = reactHost else { return }
    if settingsWindowController == nil {
      settingsWindowController = SettingsWindowController(reactHost: host, initialRoute: route)
    }
    settingsWindowController?.show(route: route)
    NSApp.activate(ignoringOtherApps: true)
  }
}

// MARK: - StatusItemActions

extension AppDelegate: StatusItemActions {
  func openSettings() {
    showSettingsWindow(route: "settings")
  }

  func openTestParsing() {
    showSettingsWindow(route: "test-parsing")
  }

  func openLogs() {
    showSettingsWindow(route: "logs")
  }

  func openAbout() {
    showSettingsWindow(route: "about")
  }

  func quit() {
    NSApp.terminate(nil)
  }
}
