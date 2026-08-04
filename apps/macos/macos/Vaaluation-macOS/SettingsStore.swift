import Foundation

/// Persists the settings blob for the TypeScript side, which owns the schema.
/// Native code only stores the JSON payload and reads the few fields it needs.
final class SettingsStore {
  static let shared = SettingsStore()

  private let defaults = UserDefaults.standard
  private let key = "vaaluation.settings.v1"
  private let queue = DispatchQueue(label: "com.vaaluation.settings")

  private init() {}

  var settingsJSON: String? {
    get { queue.sync { defaults.string(forKey: key) } }
    set {
      queue.sync {
        if let value = newValue {
          defaults.set(value, forKey: key)
        } else {
          defaults.removeObject(forKey: key)
        }
      }
    }
  }

  /// Which modifiers accompany C when asking the game to copy an item.
  /// Defaults to the game's own default (Ctrl + Highlight, i.e. Ctrl+Option).
  var copyModifiers: String {
    stringField("copyModifiers") ?? "control-option"
  }

  private func stringField(_ key: String) -> String? {
    guard
      let json = settingsJSON,
      let data = json.data(using: .utf8),
      let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
    else {
      return nil
    }
    return object[key] as? String
  }

  /// Whether the user has opted into watching the client log.
  var tradeWhispersEnabled: Bool {
    boolField("tradeWhispersEnabled")
  }

  private func boolField(_ key: String) -> Bool {
    guard
      let json = settingsJSON,
      let data = json.data(using: .utf8),
      let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
    else {
      return false
    }
    return object[key] as? Bool ?? false
  }

  var onboardingCompleted: Bool {
    guard
      let json = settingsJSON,
      let data = json.data(using: .utf8),
      let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
      let completed = object["onboardingCompleted"] as? Bool
    else {
      return false
    }
    return completed
  }
}
