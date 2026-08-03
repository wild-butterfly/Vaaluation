import XCTest

final class HotkeySettingsParsingTests: XCTestCase {
  func testParsesDefaultSettingsShape() {
    let json = """
      {
        "leagueId": null,
        "hotkeys": {
          "priceCheck": {
            "keyCode": 2, "characters": "D",
            "control": true, "option": false, "shift": false, "command": false
          },
          "priceCheckPersistent": {
            "keyCode": 2, "characters": "D",
            "control": true, "option": true, "shift": false, "command": false
          },
          "toggleOverlay": null
        },
        "onboardingCompleted": false
      }
      """
    let hotkeys = HotkeyCenter.hotkeysFromSettingsJSON(json)

    XCTAssertEqual(hotkeys.count, 2)
    XCTAssertEqual(hotkeys["priceCheck"]?.displayString, "⌃D")
    XCTAssertEqual(hotkeys["priceCheckPersistent"]?.displayString, "⌃⌥D")
    XCTAssertNil(hotkeys["toggleOverlay"], "null means the shortcut is disabled")
  }

  /// A fresh install has no persisted settings; shortcuts must still work.
  func testMissingOrMalformedJSONFallsBackToDefaults() {
    for json in [nil, "{broken", "{}", "{\"hotkeys\": 3}"] as [String?] {
      let hotkeys = HotkeyCenter.hotkeysFromSettingsJSON(json)
      XCTAssertEqual(hotkeys["priceCheck"]?.displayString, "⌃D")
      XCTAssertEqual(hotkeys["priceCheckPersistent"]?.displayString, "⌃⌥D")
      XCTAssertEqual(hotkeys["toggleOverlay"]?.displayString, "⇧Space")
    }
  }

  /// Once settings exist they win outright — a disabled shortcut must not be
  /// resurrected by the defaults.
  func testExplicitNullIsNotOverriddenByDefaults() {
    let json = "{\"hotkeys\": {\"priceCheck\": null}}"
    XCTAssertNil(HotkeyCenter.hotkeysFromSettingsJSON(json)["priceCheck"])
  }

  func testIgnoresEntriesWithoutKeyCode() {
    let json = "{\"hotkeys\": {\"priceCheck\": {\"characters\": \"D\"}}}"
    XCTAssertTrue(HotkeyCenter.hotkeysFromSettingsJSON(json).isEmpty)
  }
}
