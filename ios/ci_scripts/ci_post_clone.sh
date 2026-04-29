#!/bin/sh

set -e

# Install Homebrew if not present
if ! command -v brew &>/dev/null; then
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi

# Install Node and CocoaPods via Homebrew
brew install node cocoapods

# Upgrade xcodeproj gem inside CocoaPods to support Xcode 26 project format (object version 70)
# CocoaPods uses its own isolated gem dir at libexec/gems — install directly there
GEM_HOME=/usr/local/Cellar/cocoapods/1.16.2_2/libexec /usr/local/Cellar/cocoapods/1.16.2_2/libexec/bin/gem install xcodeproj

# Install JS dependencies (required before pod install for React Native)
cd "$CI_PRIMARY_REPOSITORY_PATH"
npm install

# Install iOS pods
cd ios
pod install
