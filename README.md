# Vaaluation

**An open-source item price-check overlay for Path of Exile on macOS.**

Vaaluation lives in your menu bar. Hover an item in your stash or inventory, press
<kbd>Ctrl</kbd>+<kbd>D</kbd>, and a compact overlay shows comparable listings from the
official trade site for your league — with the modifiers you care about, editable
value ranges, seller status, and a one-click jump to the full trade search.

> **Status: early development.** Vaaluation is not yet ready for general use.
> Screenshots and a first signed release will land here when Milestone 1+ ship.

## Features (MVP roadmap)

- Menu-bar app — no Dock icon, no game modification, no memory reading
- Global price-check shortcut (<kbd>Ctrl</kbd>+<kbd>D</kbd>, configurable)
- Item parsing for currency, uniques, rares, magic/normal items, gems, maps,
  jewels, flasks, divination cards, fragments, and stackables
- Trade search against the currently selected league with rate-limit-aware backoff
- Compact overlay positioned relative to the game window, Retina and
  multi-monitor aware
- Open the exact search on the official trade website at any time

## Requirements

- macOS 14 Sonoma or later (Apple Silicon and Intel; universal build)
- Path of Exile (macOS client, English language)
- Display mode: **Windowed** or **Windowed Fullscreen**

## Installation

A signed, notarized `.dmg` will be provided on the
[Releases](../../releases) page. Vaaluation will never ask you to remove
quarantine attributes or bypass Gatekeeper — if a download prompts you to do
that, it did not come from us.

## Keyboard shortcuts

| Action                           | Default                                        |
| -------------------------------- | ---------------------------------------------- |
| Price check                      | <kbd>Ctrl</kbd>+<kbd>D</kbd>                   |
| Price check (persistent overlay) | <kbd>Ctrl</kbd>+<kbd>Option</kbd>+<kbd>D</kbd> |
| Show/hide overlay & settings     | <kbd>Shift</kbd>+<kbd>Space</kbd>              |

All shortcuts can be changed or disabled in Settings.

## How it works — and what it never does

When you press the price-check shortcut, Vaaluation sends a **single** item-copy
keystroke to Path of Exile (the same thing as pressing the game's copy binding
yourself), reads the item text the game places on the clipboard, parses it, and
shows the overlay. One keypress → one game action → zero automatic server actions.
Searches are only sent when you ask for them.

Vaaluation **never**:

- reads or modifies game memory or game files
- injects code into the game
- automates gameplay or performs multiple actions from a single input
- records your clipboard history or uploads clipboard contents
- collects telemetry or requires an account

## Permissions

| Permission        | Why                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------ |
| **Accessibility** | To send the single item-copy keystroke to Path of Exile when you press the shortcut. |

That's it. Vaaluation does not request Screen Recording or Input Monitoring.
See [docs/PRIVACY.md](docs/PRIVACY.md) for the full privacy statement.

## Privacy

No telemetry, no accounts, no tracking. Network requests go only to official
Path of Exile services (league list and trade search). See
[docs/PRIVACY.md](docs/PRIVACY.md).

## Development

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for setup, and
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how the pieces fit together.

```bash
git clone https://github.com/OWNER/vaaluation.git
cd vaaluation
npm install
npm run typecheck && npm run lint && npm test
```

## Roadmap

1. ✅ Menu-bar application shell
2. Permissions service & onboarding
3. Global hotkeys
4. Clipboard integration & item parser
5. Game-window detection & overlay
6. League selection
7. Trade search & price-check UI
8. Signed, notarized universal releases

## Support the project

Vaaluation is free and always will be. If it saves you time, a donation link may
appear here later — no features will ever be locked behind payment.

## Disclaimer

This product isn't affiliated with or endorsed by Grinding Gear Games in any way.

Vaaluation is an independent community project and is not affiliated with or
endorsed by Grinding Gear Games.

## License

[MIT](LICENSE)
