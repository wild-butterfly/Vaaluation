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
      let persistent = action == "priceCheckPersistent"
      ClipboardService.shared.triggerGameCopyAndRead(timeoutMs: 600) { result in
        switch result {
        case .success(let text):
          LogStore.shared.append(
            level: "info",
            scope: "price-check",
            message: "Item copied from game (\(text.count) chars)"
          )
          VLEventsModule.emitItemCopied(text: text, persistent: persistent)
          // The window must come forward over the game, otherwise a
          // successful check appears to do nothing at all.
          self.showSettingsWindow(route: "price-check", aboveGame: true)
        case .failure(let error):
          LogStore.shared.append(
            level: "warn",
            scope: "price-check",
            message: error.message
          )
        }
      }
    case "toggleOverlay":
      toggleWindow()
    default:
      break
    }
  }

  /// Shift+Space hides the window if it is already frontmost, so the same
  /// shortcut gets you back to the game.
  private func toggleWindow() {
    if let window = settingsWindowController?.window, window.isVisible {
      window.orderOut(nil)
      return
    }
    showSettingsWindow(route: "price-check", aboveGame: true)
  }

  func applicationWillTerminate(_ notification: Notification) {
    LogStore.shared.append(level: "info", scope: "app", message: "Vaaluation terminating")
  }

  /// - Parameter aboveGame: when true the window floats over Path of Exile
  ///   (including Windowed Fullscreen) instead of behaving like an ordinary
  ///   window that the game can cover.
  private func showSettingsWindow(route: String, aboveGame: Bool = false) {
    guard let host = reactHost else { return }
    if settingsWindowController == nil {
      settingsWindowController = SettingsWindowController(reactHost: host, initialRoute: route)
    }
    settingsWindowController?.setFloatingAboveGame(aboveGame)
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
