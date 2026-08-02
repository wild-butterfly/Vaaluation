# Vaaluation Privacy Statement

Vaaluation is designed so that there is almost nothing to have a privacy policy
about.

## What Vaaluation collects

Nothing. Vaaluation has **no telemetry, no analytics, no crash reporting, and
no accounts**. No data about you or your usage is transmitted to the Vaaluation
project.

## Network requests

Vaaluation talks only to official Path of Exile services:

| Request      | When                                   | What is sent                                                                           |
| ------------ | -------------------------------------- | -------------------------------------------------------------------------------------- |
| League list  | On launch and on manual refresh        | Nothing personal — a plain GET request.                                                |
| Trade search | Only when you run a price check search | The item filters you confirmed (base type, modifiers, ranges) and the selected league. |

Every request carries a descriptive `User-Agent` identifying Vaaluation, as
required by Grinding Gear Games' developer policy.

## Clipboard

- Vaaluation reads the clipboard only immediately after you press the
  price-check shortcut, and only to obtain the item text the game just copied.
- Text that does not look like a Path of Exile item is discarded immediately.
- Your previous clipboard contents are restored where reasonably safe.
- Clipboard contents are never stored, never logged (unless you explicitly
  enable debug logging, which is local-only), and never uploaded.

## Local data

Settings (league, shortcuts, overlay position) are stored locally in
`~/Library` under the app's own container. Logs are local, rotated, and never
contain full item text unless debug logging is explicitly enabled.

## Credentials

The MVP requires no authentication at all. Vaaluation will never ask for your
Path of Exile password or your `POESESSID` cookie. If account features are ever
added, they will use the official OAuth flow, and tokens will be stored in the
macOS Keychain.

## macOS permissions

| Permission    | Purpose                                                                           |
| ------------- | --------------------------------------------------------------------------------- |
| Accessibility | Send the single item-copy keystroke to Path of Exile when you press the shortcut. |

Vaaluation does not request Screen Recording, Input Monitoring, camera,
microphone, location, or contacts access.
