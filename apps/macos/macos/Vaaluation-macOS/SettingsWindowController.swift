import Cocoa

/// The main (and for Milestone 1, only) window: hosts the React Native
/// settings/onboarding/logs UI.
final class SettingsWindowController: NSWindowController, NSWindowDelegate {
  init(reactHost: ReactHost, initialRoute: String) {
    let window = NSWindow(
      contentRect: NSRect(x: 0, y: 0, width: 760, height: 560),
      styleMask: [.titled, .closable, .miniaturizable, .resizable],
      backing: .buffered,
      defer: false
    )
    window.title = "Vaaluation"
    window.minSize = NSSize(width: 640, height: 480)
    window.isReleasedWhenClosed = false
    window.center()
    window.setFrameAutosaveName("VaaluationSettingsWindow")

    let rootView = reactHost.makeRootView(
      moduleName: "VaaluationSettings",
      initialProps: ["initialRoute": initialRoute]
    )
    window.contentView = rootView

    super.init(window: window)
    window.delegate = self
    installEscapeMonitor()
  }

  private var escapeMonitor: Any?

  /// Escape dismisses the window while it is floating over the game, so the
  /// user can get back to playing without reaching for the mouse.
  private func installEscapeMonitor() {
    escapeMonitor = NSEvent.addLocalMonitorForEvents(matching: .keyDown) {
      [weak self] event in
      guard
        let window = self?.window,
        window.isKeyWindow,
        event.keyCode == 53 // Escape
      else {
        return event
      }
      window.orderOut(nil)
      return nil
    }
  }

  deinit {
    if let escapeMonitor {
      NSEvent.removeMonitor(escapeMonitor)
    }
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) is not supported")
  }

  /// Path of Exile runs in Windowed Fullscreen, which is an ordinary window
  /// sized to the display. A normal-level window of ours ends up behind it,
  /// so price-check results float above and join whichever Space the game is
  /// on. Menu-driven opens use the normal level so the window behaves like
  /// any other while the game is not in front.
  func setFloatingAboveGame(_ floating: Bool) {
    guard let window else { return }
    window.level = floating ? .floating : .normal
    window.collectionBehavior =
      floating
      ? [.canJoinAllSpaces, .fullScreenAuxiliary]
      : [.fullScreenAuxiliary]
    window.hidesOnDeactivate = false
  }

  func show(route: String) {
    showWindow(nil)
    window?.makeKeyAndOrderFront(nil)
    // orderFrontRegardless still raises the window when our menu-bar app is
    // not the active application, which is the normal case while playing.
    window?.orderFrontRegardless()
    VLEventsModule.emitNavigate(route: route)
  }
}
