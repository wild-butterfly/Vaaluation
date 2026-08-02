import Carbon.HIToolbox
import Foundation

/// A global keyboard shortcut in the same shape the TypeScript side persists
/// (`KeyCombo` in @vaaluation/shared-types). Pure value type so the encoding
/// and conflict logic is unit-testable without the Carbon runtime.
struct KeyCombo: Equatable {
  let keyCode: UInt32
  let characters: String
  let control: Bool
  let option: Bool
  let shift: Bool
  let command: Bool

  /// Carbon modifier mask for RegisterEventHotKey.
  var carbonModifiers: UInt32 {
    var mask: UInt32 = 0
    if control { mask |= UInt32(controlKey) }
    if option { mask |= UInt32(optionKey) }
    if shift { mask |= UInt32(shiftKey) }
    if command { mask |= UInt32(cmdKey) }
    return mask
  }

  var hasModifier: Bool {
    control || option || shift || command
  }

  /// Two combos conflict when key code and modifier set are identical.
  func conflicts(with other: KeyCombo) -> Bool {
    keyCode == other.keyCode && carbonModifiers == other.carbonModifiers
  }

  /// Display string like "⌃⌥D".
  var displayString: String {
    var parts = ""
    if control { parts += "⌃" }
    if option { parts += "⌥" }
    if shift { parts += "⇧" }
    if command { parts += "⌘" }
    return parts + characters
  }

  // MARK: - Bridge (de)serialization

  init(
    keyCode: UInt32,
    characters: String,
    control: Bool,
    option: Bool,
    shift: Bool,
    command: Bool
  ) {
    self.keyCode = keyCode
    self.characters = characters
    self.control = control
    self.option = option
    self.shift = shift
    self.command = command
  }

  init?(dictionary: [String: Any]) {
    guard let keyCode = dictionary["keyCode"] as? NSNumber else { return nil }
    self.keyCode = keyCode.uint32Value
    self.characters = dictionary["characters"] as? String ?? ""
    self.control = dictionary["control"] as? Bool ?? false
    self.option = dictionary["option"] as? Bool ?? false
    self.shift = dictionary["shift"] as? Bool ?? false
    self.command = dictionary["command"] as? Bool ?? false
  }

  var dictionary: [String: Any] {
    [
      "keyCode": Int(keyCode),
      "characters": characters,
      "control": control,
      "option": option,
      "shift": shift,
      "command": command,
    ]
  }
}
