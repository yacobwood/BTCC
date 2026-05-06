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
# COMPATIBILITY_VERSION_BY_OBJECT_VERSION — no fixed release exists yet, so patch directly.
# Search both Intel (/usr/local) and Apple Silicon (/opt/homebrew) Homebrew prefixes.
python3 - << 'PYEOF'
import glob

patterns = [
    '/usr/local/Cellar/cocoapods/*/libexec/gems/xcodeproj-*/lib/xcodeproj/constants.rb',
    '/opt/homebrew/Cellar/cocoapods/*/libexec/gems/xcodeproj-*/lib/xcodeproj/constants.rb',
    '/opt/homebrew/opt/cocoapods/libexec/gems/xcodeproj-*/lib/xcodeproj/constants.rb',
]

paths = [p for pattern in patterns for p in glob.glob(pattern)]
if not paths:
    print('WARNING: no xcodeproj constants.rb found — skipping patch')
else:
    for path in paths:
        content = open(path).read()
        if '70 =>' in content:
            print('Already patched: ' + path)
        elif "77 => 'Xcode 16.0'," in content:
            patched = content.replace(
                "77 => 'Xcode 16.0',",
                "77 => 'Xcode 16.0',\n        70 => 'Xcode 26',"
            )
            open(path, 'w').write(patched)
            print('Patched: ' + path)
        else:
            print('ERROR: expected constant not found in: ' + path)
            print('First 200 chars:', content[:200])
PYEOF

# Install JS dependencies (required before pod install for React Native)
cd "$CI_PRIMARY_REPOSITORY_PATH"
npm install

# Install iOS pods
cd ios
pod install
