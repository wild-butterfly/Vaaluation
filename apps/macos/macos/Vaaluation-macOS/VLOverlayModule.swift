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

  @objc(setContentHeight:)
  func setContentHeight(_ height: NSNumber) {
    DispatchQueue.main.async {
      VLOverlayModule.controller?.resizeToContentHeight(CGFloat(height.doubleValue))
    }
  }
}
