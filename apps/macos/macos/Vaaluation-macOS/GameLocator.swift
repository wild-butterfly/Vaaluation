import AppKit
import Foundation

/// Finds the running Path of Exile process using supported APIs only.
enum GameLocator {
  /// Bundle identifiers for the macOS Path of Exile 1 client. `com.GGG.PathOfExile`
  /// is the identifier shipped by both the Steam and standalone builds; compared
  /// case-insensitively because the casing is not guaranteed stable.
  private static let bundleIdentifiers: Set<String> = [
    "com.ggg.pathofexile"
  ]

  private static let processNames: Set<String> = [
    "Path of Exile",
    "PathOfExile",
  ]

  static func runningGame() -> NSRunningApplication? {
    NSWorkspace.shared.runningApplications.first { app in
      if let bundleID = app.bundleIdentifier?.lowercased(),
        bundleIdentifiers.contains(bundleID.lowercased())
          || bundleID.contains("pathofexile")
      {
        return true
      }
      if let name = app.localizedName, processNames.contains(name) {
        return true
      }
      return false
    }
  }

  static var isGameRunning: Bool {
    runningGame() != nil
  }
}
