# Contributing to Vaaluation

Thanks for your interest! Contributions of all kinds are welcome: bug reports,
parser fixtures, code, documentation, and design feedback.

## Ground rules

- Vaaluation must stay compliant with Grinding Gear Games' third-party policy:
  one user action → at most one game action → no automatic server actions.
  PRs that add automation, memory reading, or scraping will be declined.
- No telemetry, no accounts, no dark patterns.
- Keep platform-independent logic (parsing, trade queries, caching) in
  `packages/` — free of React Native and AppKit imports.

## Development setup

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

## Workflow

1. Open or find an issue describing the change.
2. Fork and branch from `main` (`feat/…`, `fix/…`, `docs/…`).
3. Make your change with tests.
4. Run the full local check: `npm run typecheck && npm run lint && npm test`.
5. Use [Conventional Commits](https://www.conventionalcommits.org/) messages,
   e.g. `feat(parser): support fractured modifiers`.
6. Open a pull request using the template.

## Parser fixtures

Item fixtures are anonymized copied-item text. Before adding a fixture, remove
anything identifying (character or account names never appear in item text, but
double-check notes and prices you paste alongside). One fixture file per item,
named for what it exercises.

## Native code

Swift code lives in `apps/macos/macos/` and `native/`. Keep native module
surfaces small and typed; do not expose generic AppKit capabilities to
JavaScript. Add XCTest coverage for pure-Swift logic.

## Code of Conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md).
