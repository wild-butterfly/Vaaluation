import Foundation
import React

@objc(VLSettings)
final class VLSettingsModule: NSObject {
  @objc static func requiresMainQueueSetup() -> Bool { false }

  @objc(getSettings:rejecter:)
  func getSettings(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter _: @escaping RCTPromiseRejectBlock
  ) {
    resolve(SettingsStore.shared.settingsJSON)
  }

  @objc(setSettings:resolver:rejecter:)
  func setSettings(
    _ json: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard
      let data = json.data(using: .utf8),
      (try? JSONSerialization.jsonObject(with: data)) is [String: Any]
    else {
      reject("invalid_settings", "Settings payload is not a JSON object", nil)
      return
    }
    SettingsStore.shared.settingsJSON = json
    // Hotkey registrations follow the persisted settings; re-sync natively so
    // shortcuts work even when no React window is open.
    DispatchQueue.main.async {
      HotkeyCenter.shared.applyFromSettings()
    }
    resolve(nil)
  }
}
