# Spud's Arcade Empire — rewarded-ad review and device QA

## Behavior
- Only a user tap can request an ad. Browser Safari and desktop keep ordinary gameplay and the free offline collection button; no native bundle is loaded there.
- The existing investor uses the existing rewarded placement and its 15-minute cooldown.
- The new optional 2x boost lasts ten real-time minutes from an earned callback. Register, attendant and studio sales revenue is doubled during that window; customer cooldown, staff work, milestones, investor cash, offline settlement and upgrade prices remain unchanged. No stacking or extension. Expiry is stored locally and continues while away.
- Offline earnings are credited as before; the optional ad awards an additional copy of the quoted payout once. The pending offer is persisted with the same guest save. A later settlement during an ad remains independently claimable. Decline/dismiss of the offline dialog keeps the base payout. Ad failure/dismissal does not award a bonus.
- All three buttons share one in-flight lock. A successful reward and claim marker are saved together; failed storage rolls back the reward. This is guest-only local business cash, not Arcade Coins, extra game plays, or a server-verified currency.
- Native iOS uses its device clock for offline settlement because bundled assets may not have HTTP Date headers. The existing offline cap and monotonic saved timestamp remain. Browser settlement still uses the HTTP Date header. This is not tamper-proof against device time changes or multiple independent clients.
- Reuses the existing AdMob extraPlays ad unit through native-ads-entry.js, including existing ATT and UMP consent flow. No new production unit ID, SDK changes or unrelated reward ledger. No ad is automatically presented.

## Automated checks
The existing tests/empire-floor.cases.js is imported by tests/smoke.spec.js and contains the new mocked bridge cases plus the original rendering and save regression tests.
Run:
```sh
npm ci
npx playwright install chromium webkit
npx playwright test tests/smoke.spec.js --grep 'Empire' --project=desktop-chromium --project=mobile-webkit
```
These tests inject a mock EarnlyNativeAds.showRewarded, not a real AdMob impression. Passing them does not verify SDK delivery, consent, production ad fill, or App Store release.

## Physical iPhone acceptance (not performed by this change)
1. On a Mac with signing configured, use a debug/test build: EARNLY_ADMOB_TEST_MODE=1 npm run native:ios:sync; open the generated Xcode project and run on a physical iPhone. Confirm the app actually contains the updated HTML and scripts.
2. Open the game and verify no ad/ATT request occurs automatically. Tap the investor or profit boost. Resolve ATT and any UMP consent form; confirm an actual Google test rewarded ad appears. Denying tracking should not be treated as permission to use IDFA.
3. Complete a test ad. Verify the callback earns exactly one reward, the boost starts at ten minutes, register and passive cash increase at twice the original rate, and the customer cooldown remains 1.5 seconds. Confirm the boost expires and cannot stack. Background, reopen and restart the app.
4. Hire an attendant, leave for at least 60 seconds, return, and note the credited base cash. Collect without an ad; verify no ad call. Repeat with the optional double button, complete a test ad, and verify exactly the displayed bonus, with no repeat after restart.
5. Dismiss a test ad before earning it; verify no bonus and normal play. Test no network/no fill, privacy/consent unavailable, fast repeated taps, and leaving/returning during presentation. Check the 3D scene, zoom, touch controls and customer pacing.
6. Verify simulator/native build and required CI checks. Separately validate release configuration with test devices registered in AdMob and check AdMob console diagnostics. Never repeatedly click live production ads or use real impressions for automated tests. Production fill is not established by a test ad.
7. Do not ship until the device QA is recorded and CI is green. If the app is killed before its native earned callback reaches JavaScript, this local-only implementation cannot recover the lost callback; the offline base is still retained, and an unclaimed bonus is available for another voluntary request.
