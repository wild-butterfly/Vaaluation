import AppKit
import Foundation
import React

@objc(VLHotkeys)
final class VLHotkeysModule: NSObject {
  @objc static func requiresMainQueueSetup() -> Bool { false }

  private var captureMonitor: Any?

  /// Re-reads the persisted settings and synchronizes native registrations.
  /// Resolves with { action: { code, message } } for combos that failed.
  @objc(applyFromSettings:rejecter:)
  func applyFromSettings(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter _: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.main.async {
      let errors = HotkeyCenter.shared.applyFromSettings()
      resolve(errors.mapValues { ["code": $0.code, "message": $0.message] })
    }
  }

  @objc(getRegistrations:rejecter:)
  func getRegistrations(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter _: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.main.async {
      resolve(HotkeyCenter.shared.currentRegistrations.mapValues { $0.dictionary })
    }
  }

  /// Captures the next key press in this app (used by the shortcut recorder in
  /// Settings). Resolves with a KeyCombo dictionary, or null if the user
  /// cancels with Escape. Never observes keys outside Vaaluation.
  @objc(captureNextKeyCombo:rejecter:)
  func captureNextKeyCombo(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.main.async { [weak self] in
      guard let self else { return }
      if self.captureMonitor != nil {
        reject("capture_in_progress", "A shortcut recording is already in progress", nil)
        return
      }
      self.captureMonitor = NSEvent.addLocalMonitorForEvents(matching: .keyDown) {
        [weak self] event in
        guard let self else { return event }
        self.stopCapture()

        if event.keyCode == 53 { // Escape cancels recording
          resolve(nil)
          return nil
        }

        let flags = event.modifierFlags
        let combo = KeyCombo(
          keyCode: UInt32(event.keyCode),
          characters: Self.displayCharacters(for: event),
          control: flags.contains(.control),
          option: flags.contains(.option),
          shift: flags.contains(.shift),
          command: flags.contains(.command)
        )
        resolve(combo.dictionary)
        return nil
      }
    }
  }

  @objc(cancelCapture)
  func cancelCapture() {
    DispatchQueue.main.async { [weak self] in
      self?.stopCapture()
    }
  }

  private func stopCapture() {
    if let monitor = captureMonitor {
      NSEvent.removeMonitor(monitor)
      captureMonitor = nil
    }
  }

  private static func displayCharacters(for event: NSEvent) -> String {
    if event.keyCode == 49 {
      return "Space"
    }
    let characters = event.charactersIgnoringModifiers?.uppercased() ?? ""
    return characters.isEmpty ? "Key \(event.keyCode)" : characters
  }
}
