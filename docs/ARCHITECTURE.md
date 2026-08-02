# Vaaluation Architecture

## Overview

Vaaluation is a React Native macOS application with an AppKit-owned shell.
AppKit (Swift) owns the application lifecycle — the status item, windows,
hotkeys, clipboard, and permissions — and hosts React Native views for all
non-trivial UI. Domain logic lives in plain TypeScript packages with no React
Native or AppKit dependencies.

```
vaaluation/
  apps/
    macos/            React Native app (UI, orchestration)
      src/            TypeScript application code
      macos/          Xcode project + Swift AppKit shell & native modules
  packages/
    shared-types/     Domain types shared across packages (strict TS)
    item-parser/      Pure-TS Path of Exile item text parser        (Milestone 3)
    trade-client/     Trade query builder, rate limiter, cache      (Milestone 5)
    ui/               Theme tokens & shared presentational components
  native/             Reserved for Swift packages extracted from the app shell
  docs/
```

## Why AppKit owns the lifecycle

React Native macOS assumes a single document-style main window. Vaaluation is a
menu-bar (`LSUIElement`) app with multiple special windows (settings, overlay).
So the Swift `AppDelegate`:

1. Creates one shared `RCTReactNativeFactory`/bridge at launch.
2. Creates the `NSStatusItem` and its menu.
3. Creates windows on demand (settings window, borderless overlay panel), each
   hosting an `RCTRootView` with a distinct `moduleName` (`VaaluationSettings`,
   `VaaluationOverlay`), all served by the same bridge.

React Native never opens or closes windows itself; it asks the native side via
typed module calls, and the native side emits lifecycle events back.

## Native bridge

Five small modules; no generic AppKit surface is ever exposed to JS:

| Module          | Responsibility                                                                                      |
| --------------- | --------------------------------------------------------------------------------------------------- |
| `VLSettings`    | Persist/read `AppSettings` (UserDefaults)                                                           |
| `VLPermissions` | Accessibility / Input Monitoring status, open System Settings, re-check on activation               |
| `VLHotkeys`     | Register/unregister global shortcuts (Carbon `RegisterEventHotKey`), conflict detection, key events |
| `VLClipboard`   | Read pasteboard, trigger single game-copy keystroke, restore previous clipboard                     |
| `VLGameWindow`  | Locate the Path of Exile window, bounds, display, scale                                             |
| `VLOverlay`     | Show/hide/pin the overlay panel, anchoring, Escape & click-outside                                  |

Rules:

- Every method is promise-based or an event; no synchronous bridge calls.
- Every payload has a TypeScript type in `apps/macos/src/native/` mirroring the
  Swift codable struct.
- Modules must degrade gracefully (e.g. game not running → typed error, not a
  crash).

## Data flow for a price check

```
Ctrl+D (Carbon hotkey, Swift)
  → JS orchestrator (single in-flight check, debounced)
  → VLClipboard.triggerGameCopyAndRead()   ← one synthetic keystroke, one game action
  → item-parser.parse(text)                ← pure TS, discriminated unions
  → VLOverlay.show(anchor from VLGameWindow.find())
  → user adjusts modifiers/ranges (no network yet)
  → trade-client.search(query, league)     ← explicit user action, rate-limit aware
  → listings rendered; "open in browser" builds the official trade URL
```

## Compliance invariants

These are architectural constraints, not just policy:

- One user input maps to at most one synthesized game input and zero automatic
  server actions. Searches require an explicit user action.
- No game memory access, no injection, no file modification, no HTML scraping.
- The trade website API (`www.pathofexile.com/api/trade/*`) is undocumented;
  all responses are schema-validated at the boundary in `trade-client` so
  upstream changes fail loudly and safely.

## Testing strategy

- `packages/*`: Vitest, fixture-driven (parser fixtures are anonymized copied
  items). Runs on any platform, no Xcode required.
- Swift: XCTest for pure logic (key-combo encoding, pasteboard validation,
  window-math). UI-less by design.
- CI: typecheck + lint + Vitest on ubuntu; `xcodebuild` build check on macOS.
