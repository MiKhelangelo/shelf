#!/bin/bash
# Builds an unsigned Shelf.app on a Mac. It does not read browser cookies.
set -euo pipefail
if [[ "$(uname -s)" != "Darwin" ]]; then
  printf 'Build Shelf.app on a Mac.\n' >&2
  exit 1
fi
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"
SHELF_NATIVE=1 npm run build
app="$root/mac/Shelf.app"
rm -rf "$app"
mkdir -p "$app/Contents/MacOS" "$app/Contents/Resources/ui"
cp "$root/mac/Info.plist" "$app/Contents/Info.plist"
cp -R "$root/dist/." "$app/Contents/Resources/ui/"
swiftc -O -framework Cocoa -framework WebKit -o "$app/Contents/MacOS/Shelf" "$root/mac/main.swift"
printf 'Built %s\n' "$app"
printf 'It is not signed or notarized. macOS may ask you to allow it.\n'
