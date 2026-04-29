#!/bin/sh

set -e

# Install Homebrew if not present
if ! command -v brew &>/dev/null; then
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi

# Install Node and CocoaPods via Homebrew
brew install node cocoapods

# Upgrade xcodeproj gem to support Xcode 26 project format (object version 70)
echo "pod path: $(which pod)"
echo "ruby path: $(which ruby)"
POD_PATH=$(which pod)
COCOAPODS_RUBY=$(ls -la $POD_PATH | awk '{print $NF}' | xargs dirname | xargs dirname)/libexec/bin/ruby
echo "CocoaPods ruby: $COCOAPODS_RUBY"
if [ -f "$COCOAPODS_RUBY" ]; then
  $COCOAPODS_RUBY -S gem install xcodeproj
else
  echo "Falling back to brew ruby"
  $(brew --prefix ruby)/bin/gem install xcodeproj
fi

# Install JS dependencies (required before pod install for React Native)
cd "$CI_PRIMARY_REPOSITORY_PATH"
npm install

# Install iOS pods
cd ios
pod install
