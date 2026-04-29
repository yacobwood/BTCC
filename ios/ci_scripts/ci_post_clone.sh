#!/bin/sh

set -e

# Install Homebrew if not present
if ! command -v brew &>/dev/null; then
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi

# Install Node and CocoaPods via Homebrew
brew install node cocoapods

# Upgrade xcodeproj gem to support Xcode 26 project format (object version 70)
# Must use the Ruby bundled with CocoaPods, not system Ruby
COCOAPODS_GEM=$(find /usr/local/Cellar/cocoapods -name "gem" -path "*/bin/gem" | head -1)
echo "Using gem at: $COCOAPODS_GEM"
$COCOAPODS_GEM install xcodeproj
echo "xcodeproj version after install: $($COCOAPODS_GEM list xcodeproj)"

# Install JS dependencies (required before pod install for React Native)
cd "$CI_PRIMARY_REPOSITORY_PATH"
npm install

# Install iOS pods
cd ios
pod install
