#!/bin/sh

set -e

# Install Homebrew if not present
if ! command -v brew &>/dev/null; then
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi

# Install Node and CocoaPods via Homebrew
brew install node cocoapods

# Upgrade xcodeproj gem inside CocoaPods to support Xcode 26 project format (object version 70)
# CocoaPods uses its own isolated gem dir at libexec/gems — set GEM_HOME so any `gem` binary installs there
PODS_VERSION=$(brew list --versions cocoapods | awk '{print $2}')
GEM_HOME=/usr/local/Cellar/cocoapods/${PODS_VERSION}/libexec gem install xcodeproj --no-document

# Install JS dependencies (required before pod install for React Native)
cd "$CI_PRIMARY_REPOSITORY_PATH"
npm install

# Install iOS pods
cd ios
pod install
