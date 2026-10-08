# Earnly Arcade — App Store v1.1 Release Notes

Prepared for the next iOS update. This file is release documentation only; it does not submit a build.

## Version
- App: Earnly Arcade
- Bundle ID: com.earnly.arcade
- Marketing version: 1.1
- Signed TestFlight build number: 100 + the dedicated workflow run number (first run: 101)
- Local simulator default build number: 2
- In-app engine version: 1.1.0

## Reviewer paths
- The arcade is playable as a guest. An account is not required to access games.
- Optional account: Profile → Account & Data.
- Account deletion: Profile → Account & Data → Delete Account.
- Direct deletion section: account.html#delete-account.
- Privacy Policy: privacy.html.
- Terms of Use: terms.html.
- Support: support.html.
- World rankings: Profile → World Ranks, or leaderboards.html.

## Rewarded ads
- Rewarded ads are optional.
- Ads unlock an additional play; they do not directly award Arcade Coins.
- After a rewarded play is granted, Earnly automatically returns the player to the same game and begins the next run.
- The current iOS ad request uses non-personalized ads and does not request ATT permission.

## Arcade Coins
- Arcade Coins are in-app reward points in this release.
- They are not cash, cryptocurrency, stored value, or withdrawable/redeemable in v1.1.

## Release build command
Use:

`npm run native:ios:release`

This forces:
- EARNLY_ADMOB_TEST_MODE=0
- EARNLY_IOS_MARKETING_VERSION=1.1
- EARNLY_IOS_BUILD_NUMBER=2

Normal CI intentionally uses AdMob test mode.

## Pre-upload gate
Do not upload to App Store Connect until:
- automated desktop Chromium smoke suite is green;
- automated mobile WebKit/iPhone smoke suite is green;
- simulation/contract suite is green;
- iOS native build is green;
- Pages deployment is green;
- rewarded-ad auto-return regression is green;
- Block Drop mobile rotate/pause/quit regression is green;
- account deletion route and legal-page checks are green.

## Submission reminder
Uploading/submitting a new App Store build requires explicit owner approval. Keep the already released/submitted 1.0 record untouched.

## Signed TestFlight candidate

Use `.github/workflows/ios-v1-1-testflight.yml` for the current 1.1 candidate. It runs on main when that workflow is changed, or by manual dispatch. It signs 1.1 with live AdMob configuration and uploads the same run's IPA only after the exact commit passes automated QA, the native simulator build, and Pages publication. A newer main commit blocks upload. The legacy 1.0 archive and upload workflows are not used.

The workflow upload makes a build available for Apple processing; it does not submit it to App Review or publish it. Once processed, assign it to the existing internal TestFlight group if automatic distribution is not enabled.

Before App Review, install this exact candidate on an iPhone and check guest play, account sign-in, account deletion access, rewarded-ad return, Crystal Command controls, game pause/quit, and Character Studio browsing/equipping. Confirm website coin checkout remains hidden in the native app. Update review notes and screenshots to describe the packaged build.
