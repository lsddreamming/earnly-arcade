#!/bin/bash
set -euo pipefail
# Simulator render/layout evidence only. Never a substitute for physical AR.
xcodebuild -project native/AlienInvasionAR/AlienInvasionAR.xcodeproj -scheme AlienInvasionAR \
  -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
  CODE_SIGNING_ALLOWED=NO -derivedDataPath /tmp/alien-ar-review build > /tmp/alien-ar-simulator-build.log 2>&1 || { tail -100 /tmp/alien-ar-simulator-build.log; exit 1; }
DEVICE=$(xcrun simctl list devices available --json | python3 -c 'import json,sys; phones=[d for ds in json.load(sys.stdin)["devices"].values() for d in ds if "iPhone" in d["name"]]; phones.sort(key=lambda d:("SE" not in d["name"],d["name"])); print(phones[0]["udid"])')
xcrun simctl boot "$DEVICE" || true
xcrun simctl bootstatus "$DEVICE" -b
xcrun simctl install "$DEVICE" /tmp/alien-ar-review/Build/Products/Debug-iphonesimulator/AlienInvasionAR.app
mkdir -p test-results/alien-native
for MODE in Air Door Window Wall Ceiling combat paused; do
  xcrun simctl terminate "$DEVICE" com.earnlyarcade.alieninvasion.prototype 2>/dev/null || true
  xcrun simctl launch --stdout=/tmp/alien-review-out.log --stderr=/tmp/alien-review-err.log "$DEVICE" com.earnlyarcade.alieninvasion.prototype --ar-visual-review "$MODE"
  sleep 3
  DATA_DIR=$(xcrun simctl get_app_container "$DEVICE" com.earnlyarcade.alieninvasion.prototype data)
  cp "$DATA_DIR/Documents/visual-review.json" "test-results/alien-native/$MODE.json"
  python3 -c 'import json,sys; r=json.load(open(sys.argv[1])); assert r["layoutPass"],r; assert r["physicalARVerified"] is False' "test-results/alien-native/$MODE.json"
  xcrun simctl io "$DEVICE" screenshot "test-results/alien-native/$MODE.png"
  if rg -i 'failed to compile|compilation failed|Error Domain=SCNErrorDomain' /tmp/alien-review-err.log; then
    cat /tmp/alien-review-err.log; exit 1
  fi
done
