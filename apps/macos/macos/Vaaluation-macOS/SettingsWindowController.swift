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
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) is not supported")
  }

  func show(route: String) {
    showWindow(nil)
    window?.makeKeyAndOrderFront(nil)
    VLEventsModule.emitNavigate(route: route)
  }
}
