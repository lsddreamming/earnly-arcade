# Unified Arcade Coins — purchase release hold

Status: implementation candidate, NOT approved for Apple upload or review submission.

Read-only production check on 2026-10-12: website `/coin-shop/config` reports `available: true` for all three packs. This confirms configured availability, not an end-to-end card charge. Production has no redemption/withdrawal/cash-out RPC.

Players see one Arcade Coins balance, earned in games or purchased. Coins buy avatar items and three additional plays for 25 coins. No coins, including rewards earned during paid plays, can be cashed out, transferred, converted to crypto, or redeemed for prizes. Purchased coins are tracked separately inside the existing wallet and do not increase lifetime earned totals. Any future redemption feature requires a new provenance design and review; do not enable it against this balance.

## App Store Connect configuration

Create consumable products for bundle `com.earnly.arcade`. Product identifiers and quantities must match exactly:

| Product ID | Arcade Coins | Proposed US price |
| --- | ---: | ---: |
| com.earnly.arcade.coins.starter | 500 | $1.99 |
| com.earnly.arcade.coins.plus | 1,500 | $4.99 |
| com.earnly.arcade.coins.vault | 4,000 | $9.99 |

Prices displayed in the app come from StoreKit, including localized currency. Complete paid-app agreements, banking/tax details, product availability, localizations, and review screenshots. These have not been inspected or verified in this development session.

Configure App Store Server Notifications V2 at `/functions/v1/apple-coins/notifications`. Configure Apple PKI DER root certificates (base64 JSON array) and the App Store Server API credentials only in backend secrets:

- APPLE_ROOT_CERTIFICATES_BASE64
- APPLE_APP_ID (numeric App Store app ID, not the bundle ID)
- APPLE_IAP_PRIVATE_KEY
- APPLE_IAP_KEY_ID
- APPLE_IAP_ISSUER_ID
- APPLE_COIN_PURCHASES_ENABLED (leave false until configuration and purchase testing pass)

Production verification checks Apple's certificate chain with online revocation checks, retrieves current transaction data from Apple's API, checks bundle/product/type/quantity/environment/account binding, then fulfills atomically. A purchase is finished on the device only after the server returns a fulfilled or revoked receipt. Unfinished purchases recover on shop launch, account sign-in, focus, or reconnection. Refund delivery is idempotent and irreversible by replaying an old purchase. Already-spent refunds become purchase debt. Deleting an account preserves an anonymized transaction tombstone to prevent re-crediting the same transaction.

## Isolated sandbox

Existing staging project: `wphqfogbnpdsfkquvdsu`. Production project: `zdwziebtbpuolusztede`.

`node scripts/build-apple-staging.mjs` generates the Apple sandbox function/migration bundle for the existing staging ledger. It pins the project and accepts Sandbox only. Production accepts Production only. Never loosen the production environment check to make a sandbox purchase pass.

Before release, finish a sandbox-targeted iOS configuration with staging Auth, wallet, extra-play and avatar endpoints, or an equivalently isolated reviewer test mode. The current candidate uses production endpoints and is NOT ready for TestFlight purchasing or App Review sandbox purchases. The staging bundle alone is not an end-to-end sandbox app. This is a release blocker, not an optional follow-up.

## Required purchase evidence before release

- Actual device sandbox purchases of all three product IDs using localized StoreKit prices.
- Cancellation, Ask to Buy pending approval, interrupted network and app termination recovery.
- Duplicate transaction delivery credits once; wrong-account delivery cannot credit.
- Refund before/after spending, duplicate notification, and stale transaction replay.
- Extra plays consume once without changing free daily counters; avatar purchases persist across sign-in/reinstall.
- Sandbox transactions never affect production balances or leaderboards.
- iPhone WebKit all three shards, desktop suite, simulations/contracts, and native compilation pass on the exact release commit.
- Account deletion remains usable after purchasing.

## Build and deployment

`native/ArcadePurchases.swift` is appended to the generated AppDelegate by `scripts/configure-ios.mjs`, and SceneDelegate installs the custom bridge. CI deletes/regenerates ios, so do not rely on manual edits in that generated directory.

`ios-coin-candidate.yml` archives a 1.3 candidate with a distinct build-number range and retains the IPA as a GitHub artifact. It has no App Store upload job. It does not submit to review. Keep existing submitted builds unchanged.

Apply the new migration and deploy the `apple-coins` function only after code review/QA. The existing `coin-shop` function also needs its native-origin/extra-play update. Reconcile deployed source before replacing it. Keep Apple purchases disabled until the evidence above is complete.

References: https://apple.github.io/app-store-server-library-node/classes/SignedDataVerifier.html and https://developer.apple.com/documentation/storekit/transaction/appaccounttoken .

## Local validation (2026-10-12)

- Exact desktop CI selection: 422 passed, 2 intentionally skipped (424 selected).
- Simulations/source contracts: 23 passed.
- Commerce API tests: 11 passed, plus PostgreSQL ledger/RLS assertions.
- Release gate tests: 14 passed.
- Stripe and Apple isolated sandbox ledger tests passed.
- Native web bundle and Capacitor iOS sync succeeded. This is not a compiled iOS archive.
- Shop visually inspected at 390 × 844 with mocked StoreKit products.
- Local iPhone WebKit could not launch because system libraries are absent; the environment cannot install them. macOS CI is required.
- GitHub push was blocked by automatic approval review requesting explicit permission to upload source to the repository. No PR, remote QA result, signed IPA, production deployment, or Apple submission is claimed.

The generic all-desktop test discovery includes a separate touchscreen-only iPhone quit-stress suite. That invocation was stopped after missing-touch errors; the repository's actual desktop CI selection above completed successfully. The dedicated iPhone stress suite remains a macOS/mobile validation item.
