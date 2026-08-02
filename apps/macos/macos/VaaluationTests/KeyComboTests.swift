import Carbon.HIToolbox
import XCTest

final class KeyComboTests: XCTestCase {
  private func combo(
    keyCode: UInt32 = 2,
    characters: String = "D",
    control: Bool = false,
    option: Bool = false,
    shift: Bool = false,
    command: Bool = false
  ) -> KeyCombo {
    KeyCombo(
      keyCode: keyCode,
      characters: characters,
      control: control,
      option: option,
      shift: shift,
      command: command
    )
  }

  func testCarbonModifierMask() {
    XCTAssertEqual(combo(control: true).carbonModifiers, UInt32(controlKey))
    XCTAssertEqual(
      combo(control: true, option: true).carbonModifiers,
      UInt32(controlKey) | UInt32(optionKey)
    )
    XCTAssertEqual(
      combo(shift: true, command: true).carbonModifiers,
      UInt32(shiftKey) | UInt32(cmdKey)
    )
    XCTAssertEqual(combo().carbonModifiers, 0)
  }

  func testHasModifier() {
    XCTAssertFalse(combo().hasModifier)
    XCTAssertTrue(combo(control: true).hasModifier)
    XCTAssertTrue(combo(shift: true).hasModifier)
  }

  func testConflictDetection() {
    let ctrlD = combo(control: true)
    let ctrlOptD = combo(control: true, option: true)
    let ctrlS = combo(keyCode: 1, characters: "S", control: true)

    XCTAssertTrue(ctrlD.conflicts(with: ctrlD))
    XCTAssertFalse(ctrlD.conflicts(with: ctrlOptD))
    XCTAssertFalse(ctrlD.conflicts(with: ctrlS))
  }

  func testDisplayString() {
    XCTAssertEqual(combo(control: true).displayString, "⌃D")
    XCTAssertEqual(
      combo(control: true, option: true, shift: true, command: true).displayString,
      "⌃⌥⇧⌘D"
    )
  }

  func testDictionaryRoundTrip() {
    let original = combo(control: true, option: true)
    let decoded = KeyCombo(dictionary: original.dictionary)
    XCTAssertEqual(decoded, original)
  }

  func testInitFromInvalidDictionary() {
    XCTAssertNil(KeyCombo(dictionary: [:]))
    XCTAssertNil(KeyCombo(dictionary: ["characters": "D"]))
  }

  func testInitFromDictionaryDefaults() {
    let decoded = KeyCombo(dictionary: ["keyCode": 2])
    XCTAssertEqual(decoded?.keyCode, 2)
    XCTAssertEqual(decoded?.characters, "")
    XCTAssertEqual(decoded?.hasModifier, false)
  }
}
