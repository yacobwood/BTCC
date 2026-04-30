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
# OBJECT_VERSION_FOR_DEV_TOOLS may be in project.rb or constants.rb depending on version
candidates = (
    glob.glob('/usr/local/Cellar/cocoapods/*/libexec/gems/xcodeproj-*/lib/xcodeproj/project.rb') +
    glob.glob('/usr/local/Cellar/cocoapods/*/libexec/gems/xcodeproj-*/lib/xcodeproj/constants.rb')
)
print('Candidate files: ' + str(candidates))
for path in candidates:
    content = open(path).read()
    print(f'  {path}: has OBJECT_VERSION_FOR_DEV_TOOLS={("OBJECT_VERSION_FOR_DEV_TOOLS" in content)}, has 70={("70" in content)}')
    if 'OBJECT_VERSION_FOR_DEV_TOOLS' in content and "'70'" not in content:
        patched = re.sub(
            r"(OBJECT_VERSION_FOR_DEV_TOOLS\s*=\s*\{.*?)(\s*\}\.freeze)",
            lambda m: m.group(1) + "\n        '70' => 'Xcode 26'," + m.group(2),
            content,
            flags=re.DOTALL
        )
        open(path, 'w').write(patched)
        print('Patched: ' + path)
PYEOF

# Install JS dependencies (required before pod install for React Native)
cd "$CI_PRIMARY_REPOSITORY_PATH"
npm install

# Install iOS pods
cd ios
pod install
