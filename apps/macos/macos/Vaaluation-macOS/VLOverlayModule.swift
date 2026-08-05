import Cocoa
import React

/// Lets the overlay size itself to its content.
///
/// A fixed height left most of the panel empty whenever there was little to
/// show — one trade request in a 400pt window is mostly dead space. React
/// measures what it actually rendered and reports it here.
@objc(VLOverlay)
final class VLOverlayModule: NSObject {
  @objc static func requiresMainQueueSetup() -> Bool { false }

  /// Weak so the module never keeps a closed overlay alive.
  static weak var controller: OverlayWindowController?

  /// Hides the overlay. Used by the panel's own close control.
  @objc(hide)
  func hide() {
    DispatchQueue.main.async {
      VLOverlayModule.controller?.hide()
    }
  }

  @objc(setContentHeight:)
  func setContentHeight(_ height: NSNumber) {
    DispatchQueue.main.async {
      VLOverlayModule.controller?.resizeToContentHeight(CGFloat(height.doubleValue))
    }
  }

  /// Pins or unpins the open panel.
  ///
  /// Pinning was only reachable by price-checking with the persistent
  /// shortcut, so a panel already on screen could not be kept there — the
  /// footer advertised a pin the app had no way to apply.
  @objc(setPinned:)
  func setPinned(_ pinned: NSNumber) {
    DispatchQueue.main.async {
      VLOverlayModule.controller?.setPinned(pinned.boolValue)
    }
  }

  /// Starts dragging the panel from the current mouse-down.
  ///
  /// The panel is `isMovableByWindowBackground`, but the React root view sits
  /// over the whole window and consumes the mouse events that would otherwise
  /// reach it, so the drag never began. React knows which parts of its header
  /// are buttons and which are empty chrome, so it decides when a press is a
  /// drag and calls this; AppKit takes over from there and runs the drag loop
  /// until the button comes up.
  @objc(beginDrag)
  func beginDrag() {
    DispatchQueue.main.async {
      guard
        let window = VLOverlayModule.controller?.window,
        let event = NSApp.currentEvent
      else { return }
      window.performDrag(with: event)
    }
  }
}
