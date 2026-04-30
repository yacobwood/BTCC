#!/bin/sh

set -e

# Install Homebrew if not present
if ! command -v brew &>/dev/null; then
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi

# Install Node and CocoaPods via Homebrew
brew install node cocoapods

# Patch xcodeproj gem to support Xcode 26 project format (object version 70).
# xcodeproj 1.27.0 (bundled with CocoaPods 1.16.2) has no entry for version 70 in
# OBJECT_VERSION_FOR_DEV_TOOLS — no fixed release exists yet, so patch the file directly.
python3 - << 'PYEOF'
import re, glob

# Patch COMPATIBILITY_VERSION_BY_OBJECT_VERSION in constants.rb
# Keys are integers (e.g. 77 => 'Xcode 16.0') — insert 70 => 'Xcode 26'
for path in glob.glob('/usr/local/Cellar/cocoapods/*/libexec/gems/xcodeproj-*/lib/xcodeproj/constants.rb'):
    content = open(path).read()
    if 'COMPATIBILITY_VERSION_BY_OBJECT_VERSION' in content and '70 =>' not in content:
        # Insert after the highest existing entry (77 => 'Xcode 16.0')
        patched = content.replace(
            "77 => 'Xcode 16.0',",
            "77 => 'Xcode 16.0',\n        70 => 'Xcode 26',"
        )
        open(path, 'w').write(patched)
        print('Patched: ' + path)
    elif '70 =>' in content:
        print('Already patched: ' + path)
    else:
        print('ERROR: constant not found in: ' + path)
PYEOF

# Install JS dependencies (required before pod install for React Native)
cd "$CI_PRIMARY_REPOSITORY_PATH"
npm install

# Install iOS pods
cd ios
pod install
