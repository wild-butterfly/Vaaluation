import Cocoa

/// Borderless, transparent panel used for the in-game overlay.
///
/// A non-activating panel keeps Path of Exile as the active application while
/// still letting the user click and type in the overlay, so a price check
/// never yanks focus out of the game.
final class OverlayPanel: NSPanel {
  override var canBecomeKey: Bool { true }
  override var canBecomeMain: Bool { false }

  init(contentRect: NSRect) {
    super.init(
      contentRect: contentRect,
      styleMask: [.borderless, .nonactivatingPanel, .fullSizeContentView],
      backing: .buffered,
      defer: false
    )

    isOpaque = false
    backgroundColor = .clear
    hasShadow = true
    isMovableByWindowBackground = true
    hidesOnDeactivate = false
    // Sits above the game (including Windowed Fullscreen) and follows the
    // user between Spaces.
    level = .floating
    collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .stationary]
    animationBehavior = .utilityWindow
  }
}
