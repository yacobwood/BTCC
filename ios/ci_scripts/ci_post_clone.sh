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

project_files = glob.glob('/usr/local/Cellar/cocoapods/*/libexec/gems/xcodeproj-*/lib/xcodeproj/project.rb')
print('project.rb files found: ' + str(project_files))

for path in project_files:
    lines = open(path).readlines()
    # Print lines 75-95 to see what's around the error at line 85
    print(f'\n--- {path} lines 75-95 ---')
    for i, line in enumerate(lines[74:95], start=75):
        print(f'{i}: {line}', end='')

    # Search all .rb files in xcodeproj gem for the hash that maps version numbers
    gem_dir = re.match(r'(.*/xcodeproj-[^/]+)/', path).group(1)
    print(f'\n\nSearching for version hash in: {gem_dir}')
    for rb in glob.glob(gem_dir + '/lib/**/*.rb', recursive=True):
        content = open(rb).read()
        # Look for a hash containing old known Xcode versions like '46', '47', '51'
        if "'46'" in content or "'51'" in content or 'Xcode' in content:
            # Find lines containing these patterns
            for i, line in enumerate(content.splitlines(), 1):
                if ("'46'" in line or "'51'" in line or ('Xcode' in line and '=>' in line)):
                    print(f'  {rb}:{i}: {line.strip()}')
PYEOF

# Install JS dependencies (required before pod install for React Native)
cd "$CI_PRIMARY_REPOSITORY_PATH"
npm install

# Install iOS pods
cd ios
pod install
