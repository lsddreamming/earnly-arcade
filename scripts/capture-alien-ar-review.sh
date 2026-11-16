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
for MODE in Air Door Window Wall Ceiling combat paused reactive depth reduced heavy suppressed runner flyer brute weapon; do
  xcrun simctl terminate "$DEVICE" com.earnlyarcade.alieninvasion.prototype 2>/dev/null || true
  DATA_DIR=$(xcrun simctl get_app_container "$DEVICE" com.earnlyarcade.alieninvasion.prototype data)
  rm -f "$DATA_DIR/Documents/visual-review.json"
  xcrun simctl launch --stdout=/tmp/alien-review-out.log --stderr=/tmp/alien-review-err.log "$DEVICE" com.earnlyarcade.alieninvasion.prototype --ar-visual-review "$MODE"
  # A cold CI simulator can take longer than three seconds to load SceneKit/audio.
  # Wait for this launch's result, never a previous mode's file, and retain diagnostics.
  for ((attempt=0; attempt<45; attempt++)); do
    if [ -s "$DATA_DIR/Documents/visual-review.json" ]; then break; fi
    sleep 1
  done
  cp /tmp/alien-review-out.log "test-results/alien-native/$MODE-stdout.log" || true
  cp /tmp/alien-review-err.log "test-results/alien-native/$MODE-stderr.log" || true
  if [ ! -s "$DATA_DIR/Documents/visual-review.json" ]; then
    xcrun simctl io "$DEVICE" screenshot "test-results/alien-native/$MODE-failed.png" || true
    cat /tmp/alien-review-err.log || true
    echo "No native visual review result for $MODE within 45 seconds" >&2
    exit 1
  fi
  cp "$DATA_DIR/Documents/visual-review.json" "test-results/alien-native/$MODE.json"
  python3 -c 'import json,sys; r=json.load(open(sys.argv[1])); assert r["layoutPass"],r; assert r["anchorsStable"],r; assert r["audioPass"],r; assert r["soundControlPass"],r; assert r["physicalARVerified"] is False' "test-results/alien-native/$MODE.json"
  xcrun simctl io "$DEVICE" screenshot "test-results/alien-native/$MODE.png"
  if rg -i 'failed to compile|compilation failed|Error Domain=SCNErrorDomain' /tmp/alien-review-err.log; then
    cat /tmp/alien-review-err.log; exit 1
  fi
done
