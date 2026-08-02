import Carbon.HIToolbox
import Foundation

/// Global shortcut engine built on Carbon's RegisterEventHotKey — a public,
/// still-supported API that needs no privacy permission and swallows the
/// keystroke so it never reaches the game.
final class HotkeyCenter {
  static let shared = HotkeyCenter()

  struct Registration {
    let action: String
    let combo: KeyCombo
    let ref: EventHotKeyRef
  }

  enum RegistrationError: Error {
    case noModifier
    case alreadyRegisteredElsewhere(OSStatus)
    case conflictWithOwnHotkey(String)

    var code: String {
      switch self {
      case .noModifier: return "no_modifier"
      case .alreadyRegisteredElsewhere: return "system_conflict"
      case .conflictWithOwnHotkey: return "internal_conflict"
      }
    }

    var message: String {
      switch self {
      case .noModifier:
        return "Shortcuts must include at least one modifier key (⌃⌥⇧⌘)."
      case .alreadyRegisteredElsewhere(let status):
        return "This shortcut is already taken by another app or the system (OSStatus \(status))."
      case .conflictWithOwnHotkey(let action):
        return "This shortcut is already used by \"\(action)\"."
      }
    }
  }

  /// Called on the main thread when a registered hotkey fires.
  var onHotkey: ((_ action: String) -> Void)?

  private var registrations: [String: Registration] = [:]
  private var eventHandler: EventHandlerRef?
  private var nextID: UInt32 = 1
  private var idToAction: [UInt32: String] = [:]
  private let signature: OSType = 0x564C_4B59 // 'VLKY'

  private init() {}

  func installHandlerIfNeeded() {
    guard eventHandler == nil else { return }
    var eventType = EventTypeSpec(
      eventClass: OSType(kEventClassKeyboard),
      eventKind: UInt32(kEventHotKeyPressed)
    )
    let callback: EventHandlerUPP = { _, event, userData -> OSStatus in
      guard let event, let userData else { return noErr }
      var hotKeyID = EventHotKeyID()
      let status = GetEventParameter(
        event,
        EventParamName(kEventParamDirectObject),
        EventParamType(typeEventHotKeyID),
        nil,
        MemoryLayout<EventHotKeyID>.size,
        nil,
        &hotKeyID
      )
      if status == noErr {
        let center = Unmanaged<HotkeyCenter>.fromOpaque(userData).takeUnretainedValue()
        center.handlePress(id: hotKeyID.id)
      }
      return noErr
    }
    InstallEventHandler(
      GetEventDispatcherTarget(),
      callback,
      1,
      &eventType,
      Unmanaged.passUnretained(self).toOpaque(),
      &eventHandler
    )
  }

  private func handlePress(id: UInt32) {
    guard let action = idToAction[id] else { return }
    LogStore.shared.append(level: "debug", scope: "hotkeys", message: "Hotkey fired: \(action)")
    DispatchQueue.main.async { [weak self] in
      self?.onHotkey?(action)
    }
  }

  /// Registers `combo` for `action`, replacing any previous registration for
  /// that action. Throws on conflicts instead of silently stealing keys.
  func register(action: String, combo: KeyCombo) throws {
    installHandlerIfNeeded()

    guard combo.hasModifier else {
      throw RegistrationError.noModifier
    }
    if let conflicting = registrations.first(
      where: { $0.key != action && $0.value.combo.conflicts(with: combo) }
    ) {
      throw RegistrationError.conflictWithOwnHotkey(conflicting.key)
    }

    unregister(action: action)

    let id = nextID
    nextID += 1
    var ref: EventHotKeyRef?
    let status = RegisterEventHotKey(
      combo.keyCode,
      combo.carbonModifiers,
      EventHotKeyID(signature: signature, id: id),
      GetEventDispatcherTarget(),
      0,
      &ref
    )
    guard status == noErr, let ref else {
      throw RegistrationError.alreadyRegisteredElsewhere(status)
    }
    registrations[action] = Registration(action: action, combo: combo, ref: ref)
    idToAction[id] = action
    LogStore.shared.append(
      level: "info",
      scope: "hotkeys",
      message: "Registered \(action): \(combo.displayString)"
    )
  }

  func unregister(action: String) {
    guard let existing = registrations.removeValue(forKey: action) else { return }
    UnregisterEventHotKey(existing.ref)
    idToAction = idToAction.filter { $0.value != action }
    LogStore.shared.append(level: "info", scope: "hotkeys", message: "Unregistered \(action)")
  }

  func unregisterAll() {
    for action in Array(registrations.keys) {
      unregister(action: action)
    }
  }

  var currentRegistrations: [String: KeyCombo] {
    registrations.mapValues { $0.combo }
  }

  /// Loads hotkeys from the persisted settings blob and registers them.
  /// Returns per-action errors for anything that could not be registered.
  @discardableResult
  func applyFromSettings() -> [String: RegistrationError] {
    var errors: [String: RegistrationError] = [:]
    let hotkeys = Self.hotkeysFromSettingsJSON(SettingsStore.shared.settingsJSON)
    let knownActions = ["priceCheck", "priceCheckPersistent", "toggleOverlay"]

    for action in knownActions {
      switch hotkeys[action] {
      case .some(let combo):
        do {
          try register(action: action, combo: combo)
        } catch let error as RegistrationError {
          errors[action] = error
        } catch {
          // register only throws RegistrationError
        }
      case .none:
        unregister(action: action)
      }
    }
    return errors
  }

  /// Pure parsing of the settings JSON → hotkey combos ("null" = disabled).
  static func hotkeysFromSettingsJSON(_ json: String?) -> [String: KeyCombo] {
    guard
      let json,
      let data = json.data(using: .utf8),
      let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
      let hotkeys = object["hotkeys"] as? [String: Any]
    else {
      return [:]
    }
    var result: [String: KeyCombo] = [:]
    for (action, value) in hotkeys {
      if let dict = value as? [String: Any], let combo = KeyCombo(dictionary: dict) {
        result[action] = combo
      }
    }
    return result
  }
}
