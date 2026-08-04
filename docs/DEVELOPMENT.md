# Development Setup

## Prerequisites

- macOS 14+ (the app's deployment target, set by React Native macOS 0.81)
- Xcode 16+ with the macOS SDK
- Node.js 20+
- CocoaPods (`brew install cocoapods`)

## Getting started

```bash
git clone https://github.com/wild-butterfly/Vaaluation.git
cd vaaluation
npm install
cd apps/macos/macos && pod install && cd -
```

## Running the app

```bash
# Terminal 1 — Metro bundler
cd apps/macos && npm start

# Terminal 2 — build & run
cd apps/macos && npx react-native run-macos
```

Or open `apps/macos/macos/Vaaluation.xcworkspace` in Xcode and run the
`Vaaluation-macOS` scheme.

## Running it like a normal app

The commands above run a **Debug** build: it lives in Xcode's build folder and
needs Metro running in a terminal. To get a standalone app in `/Applications`
that needs neither:

```bash
npm run app:install
```

This builds Release (bundling the JavaScript into the app), signs it ad-hoc for
local use, and installs it. Note that Vaaluation is a menu-bar app — no Dock
icon, no window on launch; look for the scales icon in the menu bar.

The resulting app is **not notarized** and is for your own machine only.
Distributable builds need Developer ID signing and notarization.

Because installing replaces the app and changes its signature, macOS treats it
as a new program: re-grant Accessibility in System Settings afterwards.

## Repository layout

See [ARCHITECTURE.md](ARCHITECTURE.md). The short version: TypeScript domain
logic lives in `packages/` (testable without Xcode), the app and its Swift
shell live in `apps/macos/`.

## Checks

Run everything CI runs:

```bash
npm run typecheck   # strict TS across all workspaces
npm run lint        # eslint, zero warnings allowed
npm test            # vitest (packages)
npm run format:check
```

Native build check:

```bash
cd apps/macos/macos
xcodebuild -workspace Vaaluation.xcworkspace -scheme Vaaluation-macOS \
  -configuration Debug -destination 'platform=macOS' build
```

## Conventions

- Strict TypeScript; discriminated unions over optional-field bags.
- Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`…).
- No React Native or AppKit imports inside `packages/`.
- Native modules stay small and typed — see ARCHITECTURE.md.

## Troubleshooting

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md).
