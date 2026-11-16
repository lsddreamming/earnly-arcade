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
LAUNCH_PID=
stop_capture() {
  xcrun simctl terminate "$DEVICE" com.earnlyarcade.alieninvasion.prototype 2>/dev/null || true
  if [ -n "$LAUNCH_PID" ]; then
    for ((waited=0; waited<20; waited++)); do
      if ! kill -0 "$LAUNCH_PID" 2>/dev/null; then break; fi
      sleep 0.1
    done
    kill "$LAUNCH_PID" 2>/dev/null || true
    wait "$LAUNCH_PID" 2>/dev/null || true
    LAUNCH_PID=
  fi
}
trap stop_capture EXIT
for MODE in Air Door Window Wall Ceiling combat paused reactive depth reduced heavy suppressed runner flyer brute weapon; do
  stop_capture
  DATA_DIR=$(xcrun simctl get_app_container "$DEVICE" com.earnlyarcade.alieninvasion.prototype data)
  rm -f "$DATA_DIR/Documents/visual-review.json"
  # simctl --stdout/--stderr paths live inside the simulator. Attach a PTY
  # instead and redirect on the host so SceneKit diagnostics reach the gate.
  CONSOLE_LOG="test-results/alien-native/$MODE-console.log"
  xcrun simctl launch --console-pty "$DEVICE" com.earnlyarcade.alieninvasion.prototype --ar-visual-review "$MODE" </dev/null >"$CONSOLE_LOG" 2>&1 &
  LAUNCH_PID=$!
  # A cold CI simulator can take longer than three seconds to load SceneKit/audio.
  # Wait for this launch's result, never a previous mode's file, and retain diagnostics.
  for ((attempt=0; attempt<45; attempt++)); do
    if [ -s "$DATA_DIR/Documents/visual-review.json" ]; then break; fi
    if ! kill -0 "$LAUNCH_PID" 2>/dev/null; then break; fi
    sleep 1
  done
  if [ ! -s "$DATA_DIR/Documents/visual-review.json" ]; then
    xcrun simctl io "$DEVICE" screenshot "test-results/alien-native/$MODE-failed.png" || true
    cat "$CONSOLE_LOG"
    echo "No native visual review result for $MODE within 45 seconds" >&2
    exit 1
  fi
  cp "$DATA_DIR/Documents/visual-review.json" "test-results/alien-native/$MODE.json"
  python3 -c 'import json,sys; r=json.load(open(sys.argv[1])); assert r["layoutPass"],r; assert r["anchorsStable"],r; assert r["audioPass"],r; assert r["soundControlPass"],r; assert r["physicalARVerified"] is False' "test-results/alien-native/$MODE.json"
  xcrun simctl io "$DEVICE" screenshot "test-results/alien-native/$MODE.png"
  stop_capture
  # Python is already required above; do not silently skip this check when
  # an optional search utility is absent from the hosted macOS runner.
  python3 - "$CONSOLE_LOG" <<'PYTHON'
import pathlib, re, sys
log = pathlib.Path(sys.argv[1]).read_text(errors='replace')
if not log.strip():
    raise SystemExit('Simulator console capture is empty: ' + sys.argv[1])
if re.search(r'failed to compile|compilation failed|Error Domain=SCNErrorDomain', log, re.I):
    print(log)
    raise SystemExit('SceneKit shader errors in ' + sys.argv[1])
PYTHON
done
