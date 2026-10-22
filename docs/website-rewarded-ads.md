# Website rewarded ads — preparation, October 22, 2026

Google H5 Games Ads application was submitted by the owner (confirmation screenshot). AdSense site status is Getting ready, review requested October 21. Neither is approval to serve ads.

## Implemented
- Independently gated Google H5 adapter in web-ads.js; ENABLED=false in committed production source.
- Lazy Google script loading only after an earning action when enabled. Disabled mode makes no new Google requests.
- Existing native provider takes priority and is unchanged. No web fallback inside Capacitor.
- Explicit reward prompt after beforeReward reports an available ad; adViewed plus completion required. Dismissal, errors, account changes and late callbacks cannot reward.
- Only extra plays and eligible run continues. Existing play limits and per-run continue restrictions apply. No new Coin grants or daily bonus credit from H5 callbacks: these are client signals, not signed server receipts.
- SDK load timeout, duplicate request protection, prompt expiry and bounded ad timeout. A shown ad that times out blocks further requests until its completion callback (or reload), avoiding overlapping ads.
- Root/www assets match. Focused Chromium and iPhone WebKit checks include the web provider and existing native continues.

## Before enabling
1. Verify AdSense site and H5 program approval in the account.
2. Verify /ads.txt is published and Google recognizes the publisher record.
3. Configure and review website-specific privacy/consent messaging. Native AdMob consent is separate; this adapter does not set or bypass consent.
4. On a development-only host, use Google's data-adbreak-test mode and test completion/skip/no-fill on Safari and Chrome. TEST_MODE is blocked on public hosts. Automated tests mock the SDK and do not prove actual Google delivery.
5. Review audio and game pause/resume on physical iPhone for extra-play and Snake/Star Defender continue placements.
6. Change ENABLED through a QA-gated release only after these gates; preserve TEST_MODE=false for production. Verify genuine requests/impressions without clicking live ads for testing.

Documentation:
https://developers.google.com/ad-placement/apis
https://developers.google.com/ad-placement/docs/example
https://support.google.com/adsense/answer/1705831
