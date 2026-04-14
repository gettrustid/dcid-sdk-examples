#!/bin/bash
# Setup ZK circuits for React Native app
# This script copies circuit files to iOS and Android asset folders

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
SDK_DIR="$(cd "$APP_DIR/../.." && pwd)"
CIRCUITS_SRC="$SDK_DIR/dist/circuits"

echo "Setting up ZK circuits for React Native..."
echo "Source: $CIRCUITS_SRC"

# Check if circuits exist
if [ ! -d "$CIRCUITS_SRC" ]; then
  echo "Error: Circuits not found at $CIRCUITS_SRC"
  echo "Run 'npm run build' in the SDK root first"
  exit 1
fi

# === Android Setup ===
ANDROID_ASSETS="$APP_DIR/android/app/src/main/assets/circuits"
echo ""
echo "=== Android ==="
echo "Copying circuits to: $ANDROID_ASSETS"

mkdir -p "$ANDROID_ASSETS"
rm -rf "$ANDROID_ASSETS"/*

cp -r "$CIRCUITS_SRC/AuthV2" "$ANDROID_ASSETS/"
cp -r "$CIRCUITS_SRC/credentialAtomicQueryMTPV2" "$ANDROID_ASSETS/"
cp -r "$CIRCUITS_SRC/credentialAtomicQuerySigV2" "$ANDROID_ASSETS/"

echo "✓ Android circuits copied"

# === iOS Setup ===
IOS_CIRCUITS="$APP_DIR/ios/circuits"
echo ""
echo "=== iOS ==="
echo "Copying circuits to: $IOS_CIRCUITS"

mkdir -p "$IOS_CIRCUITS"
rm -rf "$IOS_CIRCUITS"/*

cp -r "$CIRCUITS_SRC/AuthV2" "$IOS_CIRCUITS/"
cp -r "$CIRCUITS_SRC/credentialAtomicQueryMTPV2" "$IOS_CIRCUITS/"
cp -r "$CIRCUITS_SRC/credentialAtomicQuerySigV2" "$IOS_CIRCUITS/"

echo "✓ iOS circuits copied"
echo ""
echo "=== IMPORTANT: iOS Additional Step ==="
echo "You must add the circuits folder to your Xcode project:"
echo "1. Open ios/TrustIDMobile.xcworkspace in Xcode"
echo "2. Right-click on TrustIDMobile in the navigator"
echo "3. Select 'Add Files to TrustIDMobile...'"
echo "4. Select the 'circuits' folder"
echo "5. Check 'Copy items if needed' and 'Create folder references'"
echo "6. Click Add"
echo ""
echo "After adding to Xcode, rebuild the iOS app."
echo ""

# Calculate sizes
echo "=== Circuit Sizes ==="
du -sh "$CIRCUITS_SRC/AuthV2"
du -sh "$CIRCUITS_SRC/credentialAtomicQueryMTPV2"
du -sh "$CIRCUITS_SRC/credentialAtomicQuerySigV2"
echo ""
TOTAL=$(du -sh "$CIRCUITS_SRC" | cut -f1)
echo "Total: $TOTAL"
echo ""
echo "Done! Circuits are ready for bundling."
