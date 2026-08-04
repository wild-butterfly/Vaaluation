#!/bin/bash
#
# Builds a standalone Vaaluation.app and installs it to /Applications.
#
# Unlike the Debug build, this bundles the JavaScript into the app, so it runs
# on its own with no Metro server and no terminal.
#
# The result is ad-hoc signed for local use only. It is NOT notarized and must
# not be distributed — a public release needs Developer ID signing plus
# notarization (see docs/RELEASING.md).

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MACOS_DIR="$REPO_ROOT/apps/macos/macos"
BUILD_DIR="${TMPDIR:-/tmp}/vaaluation-release"
APP_NAME="Vaaluation.app"
DEST="${1:-/Applications}"

echo "==> Building Release (this bundles the JavaScript, and takes a few minutes)"
xcodebuild \
  -workspace "$MACOS_DIR/Vaaluation.xcworkspace" \
  -scheme Vaaluation-macOS \
  -configuration Release \
  -destination 'platform=macOS' \
  -derivedDataPath "$BUILD_DIR" \
  CODE_SIGNING_ALLOWED=NO \
  build

APP="$BUILD_DIR/Build/Products/Release/$APP_NAME"
if [ ! -d "$APP" ]; then
  echo "error: build did not produce $APP" >&2
  exit 1
fi

if [ ! -f "$APP/Contents/Resources/main.jsbundle" ]; then
  echo "error: the JavaScript bundle is missing; the app would launch blank" >&2
  exit 1
fi

# One signature across the whole bundle. Signing nested frameworks separately
# gives them mismatched identities, and library validation then refuses to load
# them at launch.
#
# A real signing identity is strongly preferred over ad-hoc: ad-hoc signatures
# are derived from the app's contents, so every rebuild looks like a different
# program to macOS and silently invalidates granted permissions. A development
# certificate keeps the identity stable, so Accessibility survives updates.
IDENTITY="${VAALUATION_SIGN_IDENTITY:-$(
  security find-identity -v -p codesigning 2>/dev/null |
    sed -n 's/.*"\(Apple Development:[^"]*\)".*/\1/p' | head -1
)}"

if [ -n "$IDENTITY" ]; then
  echo "==> Signing as: $IDENTITY"
else
  echo "==> No development certificate found; falling back to ad-hoc."
  echo "    Accessibility will need re-granting after each install."
  IDENTITY="-"
fi

codesign --force --deep --sign "$IDENTITY" --timestamp=none "$APP"
codesign --verify --deep --strict "$APP"

echo "==> Installing to $DEST"
pkill -f "$DEST/$APP_NAME/Contents/MacOS" 2>/dev/null || true
sleep 1
rm -rf "${DEST:?}/$APP_NAME"
cp -R "$APP" "$DEST/$APP_NAME"

cat <<EOF

Installed: $DEST/$APP_NAME

Vaaluation is a menu-bar app: it has no Dock icon and opens no window on
launch. After starting it, look for the scales icon in the menu bar.

If this is the first install signed with a development certificate, re-grant
Accessibility once in System Settings > Privacy & Security > Accessibility
(remove any older Vaaluation entry first). Later installs keep the same
signing identity, so the grant should persist.
EOF
