#!/bin/bash
#
# Builds, signs, notarizes and packages Vaaluation for public download.
#
# The result is a zip anyone can download and open by double-clicking. That
# needs three things the local build does not:
#
#   1. A "Developer ID Application" certificate. The "Apple Development"
#      certificate used for local builds is for your own machines only;
#      macOS refuses an app signed with it when it arrives from the internet.
#   2. The hardened runtime, which notarization requires.
#   3. Notarization itself — Apple scans the upload and issues a ticket, which
#      is then stapled into the bundle so Gatekeeper can verify it offline.
#
# Without all three, a downloader sees "Vaaluation is damaged and can't be
# opened" — the app is fine, that is simply what macOS says about an
# unnotarized download.
#
# Prerequisites, once per machine:
#
#   Certificate:  Xcode > Settings > Accounts > Manage Certificates >
#                 + > Developer ID Application
#   Notary login: xcrun notarytool store-credentials vaaluation \
#                   --apple-id you@example.com \
#                   --team-id YOURTEAMID \
#                   --password <app-specific-password>
#
# App-specific passwords come from appleid.apple.com, under Sign-In and
# Security. Your Team ID is on developer.apple.com/account.
#
# Usage: npm run release [version]

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MACOS_DIR="$REPO_ROOT/apps/macos/macos"
BUILD_DIR="${TMPDIR:-/tmp}/vaaluation-dist"
DIST_DIR="$REPO_ROOT/dist"
APP_NAME="Vaaluation.app"
NOTARY_PROFILE="${VAALUATION_NOTARY_PROFILE:-vaaluation}"
VERSION="${1:-$(date +%Y.%m.%d)}"

IDENTITY="${VAALUATION_SIGN_IDENTITY:-$(security find-identity -v -p codesigning \
  | sed -n 's/.*"\(Developer ID Application:[^"]*\)".*/\1/p' | head -1)}"

if [ -z "$IDENTITY" ]; then
  cat >&2 <<'MSG'
error: no "Developer ID Application" certificate found.

This is not the same as the "Apple Development" certificate used for local
builds — that one is only trusted on your own machines. Create the
distribution certificate in:

  Xcode > Settings > Accounts > Manage Certificates > + > Developer ID Application

You need to be the Account Holder or an Admin of the Apple Developer team.
MSG
  exit 1
fi

if ! xcrun notarytool history --keychain-profile "$NOTARY_PROFILE" >/dev/null 2>&1; then
  cat >&2 <<MSG
error: no notarization credentials stored under the profile "$NOTARY_PROFILE".

Store them once with:

  xcrun notarytool store-credentials $NOTARY_PROFILE \\
    --apple-id you@example.com \\
    --team-id YOURTEAMID \\
    --password <app-specific-password>

The password is an app-specific password from appleid.apple.com, not your
Apple ID password.
MSG
  exit 1
fi

echo "==> Signing as: $IDENTITY"
echo "==> Version: $VERSION"

echo "==> Building Release (bundles the JavaScript; takes a few minutes)"
rm -rf "$BUILD_DIR"
xcodebuild \
  -workspace "$MACOS_DIR/Vaaluation.xcworkspace" \
  -scheme Vaaluation-macOS \
  -configuration Release \
  -destination 'platform=macOS' \
  -derivedDataPath "$BUILD_DIR" \
  CODE_SIGNING_ALLOWED=NO \
  build

APP="$BUILD_DIR/Build/Products/Release/$APP_NAME"
[ -d "$APP" ] || { echo "error: build did not produce $APP" >&2; exit 1; }

# A blank window is the failure mode when this is missing, and it only shows
# up after someone has downloaded and trusted the app — so it is checked here.
[ -f "$APP/Contents/Resources/main.jsbundle" ] \
  || { echo "error: the JavaScript bundle is missing; the app would launch blank" >&2; exit 1; }

echo "==> Signing"
# Signed in one pass, deepest first. Signing a framework separately from the
# app that contains it produces a "different Team IDs" library-validation
# failure at launch.
codesign --force --deep --options runtime --timestamp \
  --sign "$IDENTITY" "$APP"
codesign --verify --deep --strict --verbose=2 "$APP"

mkdir -p "$DIST_DIR"
ZIP="$DIST_DIR/Vaaluation-$VERSION.zip"
rm -f "$ZIP"

echo "==> Packaging"
# ditto, not zip: it preserves the bundle's symlinks and resource forks, which
# a plain zip mangles badly enough that the signature no longer verifies.
ditto -c -k --keepParent "$APP" "$ZIP"

echo "==> Notarizing (Apple scans the upload; usually a few minutes)"
xcrun notarytool submit "$ZIP" --keychain-profile "$NOTARY_PROFILE" --wait

echo "==> Stapling the ticket"
# Stapled into the .app, then repackaged: the ticket has to travel inside the
# bundle so Gatekeeper can check it without a network round trip.
xcrun stapler staple "$APP"
rm -f "$ZIP"
ditto -c -k --keepParent "$APP" "$ZIP"

echo "==> Verifying as Gatekeeper would"
spctl --assess --type execute --verbose=2 "$APP"

echo
echo "Done: $ZIP"
echo
echo "Upload it to a GitHub release:"
echo "  gh release create v$VERSION \"$ZIP\" --title \"Vaaluation $VERSION\" --notes-file docs/RELEASE_NOTES.md"
