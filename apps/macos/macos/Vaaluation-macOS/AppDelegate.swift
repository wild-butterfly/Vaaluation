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

    if !SettingsStore.shared.onboardingCompleted {
      showSettingsWindow(route: "onboarding")
    }
  }

  func applicationDidBecomeActive(_ notification: Notification) {
    // Milestone 2 hook: permission state is re-checked here.
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
