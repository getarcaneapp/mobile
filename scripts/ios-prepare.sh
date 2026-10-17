#!/usr/bin/env bash
# Regenerates the native iOS project and installs CocoaPods (macOS only).
# Run after cloning, after `git pull`, and whenever a native dependency or
# app.config.ts changes. Leaves ios/Arcane.xcworkspace ready for Xcode/sqim.
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ "$(uname)" != "Darwin" ]]; then
  echo "ios-prepare: CocoaPods only runs on macOS." >&2
  exit 1
fi
command -v pod >/dev/null || { echo "ios-prepare: install CocoaPods first: brew install cocoapods" >&2; exit 1; }

pnpm install --frozen-lockfile
EXPO_NO_GIT_STATUS=1 pnpm expo prebuild --platform ios --clean
test -d ios/Arcane.xcworkspace || { echo "ios-prepare: ios/Arcane.xcworkspace missing" >&2; exit 1; }
echo "ios-prepare: ready → ios/Arcane.xcworkspace"
