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

  func testMissingOrMalformedJSON() {
    XCTAssertTrue(HotkeyCenter.hotkeysFromSettingsJSON(nil).isEmpty)
    XCTAssertTrue(HotkeyCenter.hotkeysFromSettingsJSON("{broken").isEmpty)
    XCTAssertTrue(HotkeyCenter.hotkeysFromSettingsJSON("{}").isEmpty)
    XCTAssertTrue(HotkeyCenter.hotkeysFromSettingsJSON("{\"hotkeys\": 3}").isEmpty)
  }

  func testIgnoresEntriesWithoutKeyCode() {
    let json = "{\"hotkeys\": {\"priceCheck\": {\"characters\": \"D\"}}}"
    XCTAssertTrue(HotkeyCenter.hotkeysFromSettingsJSON(json).isEmpty)
  }
}
