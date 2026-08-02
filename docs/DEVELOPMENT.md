# Development Setup

## Prerequisites

- macOS 14+ (the app's deployment target, set by React Native macOS 0.81)
- Xcode 16+ with the macOS SDK
- Node.js 20+
- CocoaPods (`brew install cocoapods`)

## Getting started

```bash
git clone https://github.com/OWNER/vaaluation.git
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
