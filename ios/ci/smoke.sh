#!/usr/bin/env bash
# Builds the iOS app and plays a few steps in a simulator (see
# DormiceUITests/SmokeTests.swift). Needs a Mac with Xcode. The screenshots it
# leaves in shots/ are for a person to look at.
set -euo pipefail
cd "$(dirname "$0")/.."

command -v xcodegen >/dev/null || brew install xcodegen
xcodegen generate

# the newest iPhone simulator this Mac has
UDID=$(xcrun simctl list devices available -j | python3 -c '
import json, re, sys
runtimes = json.load(sys.stdin)["devices"]
best = None
for runtime, devices in runtimes.items():
    m = re.search(r"iOS-(\d+)-(\d+)", runtime)
    if not m: continue
    for d in devices:
        if d["name"].startswith("iPhone") and "SE" not in d["name"]:
            key = (int(m.group(1)), int(m.group(2)), d["name"])
            if best is None or key > best[0]: best = (key, d["udid"], d["name"], runtime)
if best is None: sys.exit("no iPhone simulator found")
print(best[1]); print("simulator:", best[2], best[3], file=sys.stderr)
')

rm -rf shots && mkdir -p shots
pretty() { if command -v xcbeautify >/dev/null; then xcbeautify --quiet; else cat; fi; }

TEST_RUNNER_SHOTS_DIR="$PWD/shots" xcodebuild test \
  -project Dormice.xcodeproj -scheme Dormice \
  -destination "id=$UDID" -derivedDataPath build \
  2>&1 | tee shots/xcodebuild-test.log | pretty

# The App Store build is for real devices: make sure that compiles too.
xcodebuild build \
  -project Dormice.xcodeproj -scheme Dormice -configuration Release \
  -sdk iphoneos -destination 'generic/platform=iOS' -derivedDataPath build \
  CODE_SIGNING_ALLOWED=NO \
  2>&1 | tee shots/xcodebuild-device.log | pretty

ls -la shots
