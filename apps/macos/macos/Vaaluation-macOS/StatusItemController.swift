import Cocoa

protocol StatusItemActions: AnyObject {
  func openSettings()
  func openTestParsing()
  func openLogs()
  func openAbout()
  func quit()
}

final class StatusItemController: NSObject {
  private let statusItem: NSStatusItem
  private weak var actions: StatusItemActions?

  init(actions: StatusItemActions) {
    self.statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
    self.actions = actions
    super.init()

    if let button = statusItem.button {
      let image = NSImage(
        systemSymbolName: "scalemass.fill",
        accessibilityDescription: "Vaaluation"
      )
      image?.isTemplate = true
      button.image = image
      button.toolTip = "Vaaluation — Path of Exile price check"
    }

    statusItem.menu = buildMenu()
  }

  private func buildMenu() -> NSMenu {
    let menu = NSMenu()

    let settingsItem = NSMenuItem(
      title: "Open Settings…",
      action: #selector(openSettings),
      keyEquivalent: ","
    )
    settingsItem.target = self
    menu.addItem(settingsItem)

    let testItem = NSMenuItem(
      title: "Test Clipboard Parsing…",
      action: #selector(openTestParsing),
      keyEquivalent: ""
    )
    testItem.target = self
    menu.addItem(testItem)

    let logsItem = NSMenuItem(
      title: "View Logs…",
      action: #selector(openLogs),
      keyEquivalent: ""
    )
    logsItem.target = self
    menu.addItem(logsItem)

    menu.addItem(.separator())

    let aboutItem = NSMenuItem(
      title: "About Vaaluation",
      action: #selector(openAbout),
      keyEquivalent: ""
    )
    aboutItem.target = self
    menu.addItem(aboutItem)

    menu.addItem(.separator())

    let quitItem = NSMenuItem(
      title: "Quit Vaaluation",
      action: #selector(quit),
      keyEquivalent: "q"
    )
    quitItem.target = self
    menu.addItem(quitItem)

    return menu
  }

  @objc private func openSettings() { actions?.openSettings() }
  @objc private func openTestParsing() { actions?.openTestParsing() }
  @objc private func openLogs() { actions?.openLogs() }
  @objc private func openAbout() { actions?.openAbout() }
  @objc private func quit() { actions?.quit() }
}
