import Cocoa

/// Hosts the compact React Native overlay inside a blurred glass panel.
final class OverlayWindowController: NSWindowController {
  private static let defaultSize = NSSize(width: 560, height: 560)
  private static let cornerRadius: CGFloat = 12

  private var clickOutsideMonitor: Any?
  private var escapeMonitor: Any?
  private(set) var isPinned = false

  init(reactHost: ReactHost) {
    let panel = OverlayPanel(
      contentRect: NSRect(origin: .zero, size: Self.defaultSize)
    )

    // Background blur is what makes the panel read as glass rather than a
    // flat dark rectangle over the game.
    let effect = NSVisualEffectView(
      frame: NSRect(origin: .zero, size: Self.defaultSize)
    )
    effect.material = .hudWindow
    effect.blendingMode = .behindWindow
    effect.state = .active
    effect.autoresizingMask = [.width, .height]
    effect.wantsLayer = true
    effect.layer?.cornerRadius = Self.cornerRadius
    effect.layer?.masksToBounds = true
    effect.layer?.borderWidth = 1
    effect.layer?.borderColor = NSColor(
      calibratedRed: 0.55, green: 0.48, blue: 0.29, alpha: 0.45
    ).cgColor

    let rootView = reactHost.makeRootView(
      moduleName: "VaaluationOverlay",
      initialProps: [:]
    )
    rootView.frame = effect.bounds
    rootView.autoresizingMask = [.width, .height]
    // Let the blur show through the React content.
    rootView.wantsLayer = true
    rootView.layer?.backgroundColor = NSColor.clear.cgColor
    if let rctRootView = rootView as? NSView & CALayerDelegate {
      rctRootView.setValue(NSColor.clear, forKey: "backgroundColor")
    }
    effect.addSubview(rootView)

    panel.contentView = effect
    super.init(window: panel)
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) is not supported")
  }

  /// Shows the overlay anchored near the pointer but always fully on screen.
  func show(pinned: Bool) {
    guard let panel = window as? OverlayPanel else { return }
    isPinned = pinned

    positionNearCursor(panel)
    panel.orderFrontRegardless()
    panel.makeKey()

    installMonitors()
    VLEventsModule.emitOverlayState(visible: true, pinned: pinned)
  }

  func hide() {
    guard let panel = window, panel.isVisible else { return }
    panel.orderOut(nil)
    removeMonitors()
    VLEventsModule.emitOverlayState(visible: false, pinned: isPinned)
  }

  func toggle(pinned: Bool) {
    if window?.isVisible == true {
      hide()
    } else {
      show(pinned: pinned)
    }
  }

  func setPinned(_ pinned: Bool) {
    isPinned = pinned
    VLEventsModule.emitOverlayState(visible: window?.isVisible == true, pinned: pinned)
  }

  var isVisible: Bool { window?.isVisible == true }

  private func positionNearCursor(_ panel: NSWindow) {
    let mouse = NSEvent.mouseLocation
    guard
      let screen = NSScreen.screens.first(where: { NSMouseInRect(mouse, $0.frame, false) })
        ?? NSScreen.main
    else {
      return
    }

    let size = panel.frame.size
    let margin: CGFloat = 16
    // Prefer down-right of the cursor, flipping when that would clip.
    var origin = NSPoint(x: mouse.x + margin, y: mouse.y - size.height - margin)

    let visible = screen.visibleFrame
    if origin.x + size.width > visible.maxX {
      origin.x = mouse.x - size.width - margin
    }
    if origin.y < visible.minY {
      origin.y = mouse.y + margin
    }
    origin.x = min(max(origin.x, visible.minX), visible.maxX - size.width)
    origin.y = min(max(origin.y, visible.minY), visible.maxY - size.height)

    panel.setFrameOrigin(origin)
  }

  private func installMonitors() {
    removeMonitors()

    escapeMonitor = NSEvent.addLocalMonitorForEvents(matching: .keyDown) {
      [weak self] event in
      guard event.keyCode == 53, self?.window?.isVisible == true else { return event }
      self?.hide()
      return nil
    }

    // Clicking anywhere outside dismisses the overlay unless it is pinned.
    clickOutsideMonitor = NSEvent.addGlobalMonitorForEvents(
      matching: [.leftMouseDown, .rightMouseDown]
    ) { [weak self] _ in
      guard let self, !self.isPinned else { return }
      self.hide()
    }
  }

  private func removeMonitors() {
    if let clickOutsideMonitor {
      NSEvent.removeMonitor(clickOutsideMonitor)
      self.clickOutsideMonitor = nil
    }
    if let escapeMonitor {
      NSEvent.removeMonitor(escapeMonitor)
      self.escapeMonitor = nil
    }
  }

  deinit {
    removeMonitors()
  }
}
