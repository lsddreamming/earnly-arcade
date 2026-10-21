# AdMob launch check — 2026-10-21

## Verified
- AdMob account shows approved / ad serving enabled.
- Earnly Arcade iOS (store ID 6814277509) shows Verified and Ready.
- App ID: ca-app-pub-8864401806510610~7658950353.
- Extra Plays Rewarded: ca-app-pub-8864401806510610/8249888009, matching the native bridge.
- No app-level or ad-unit frequency cap.
- Both root and www app-ads.txt return HTTP 200 and publisher pub-8864401806510610; robots.txt allows crawling.
- Last-seven-days account dashboard showed zero requests and impressions; actual delivery is not verified.

## Prepared, not published
No European consent message existed. Saved an English draft named “Earnly Arcade — European privacy choices”, associated with Earnly Arcade and https://earnlyarcade.com/privacy.html, with Consent, Do not consent, and Manage options. No IDFA explainer added because the app owns ATT.

The draft still uses Google's existing account-level vendor/purpose defaults. Review these before publishing: the preview references 210 partners and precise geolocation, which must not be assumed to describe Earnly's intended setup. Do not publish merely to bypass a consent error.

## App changes
Adds Privacy → Manage ad privacy choices in native iOS, invalidates cached permission after changes, retries consent readiness after a not-ready result, and removes misleading test-ad wording from live ad failures. Privacy access never loads an ad or grants a reward. Separates privacy-check (A02), iPhone permission (A01), and load errors without exposing raw SDK data to players. Native ad changes trigger an unsigned iOS simulator compile only, never an Apple upload.

## Remaining release gates
1. Run hosted desktop/mobile QA and a native build against this change.
2. Confirm installed/App Store build version and live configuration; website changes cannot update packaged Capacitor assets.
3. Review consent vendor/purpose settings and provide any required US privacy message. The policy now describes the existing ATT flow accurately.
4. Obtain explicit owner approval before Apple upload/submission. This change does not trigger an upload.
5. On an authorized test device, test consent accept/decline, reopening privacy options, ad close without reward, completion granting exactly one play, and return to the game. Use test-device mode for development testing; do not click live ads to test.
6. Publish the reviewed consent message when the corresponding app flow is ready. Verify real-user requests and impressions in AdMob afterward; approval alone is not delivery evidence.
