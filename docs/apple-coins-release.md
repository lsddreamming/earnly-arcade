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

Prices displayed in the app come from StoreKit, including localized currency. Complete paid-app agreements, banking/tax details, product availability, localizations, and review screenshots. All three consumable drafts were created on 2026-10-12 with the US prices above, English (U.S.) localizations, and all-region availability. Apple IDs: Starter 6821991072, Plus 6821994181, Vault 6821997355. Paid agreements, banking/tax eligibility, Server API credentials, notifications, and real IAP review screenshots still require verification. No product was added for review.

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

`EARNLY_BACKEND_ENVIRONMENT=sandbox npm run native:web` now generates a test-only native bundle: Auth, wallet, purchases, extra plays, cosmetics and game-network URLs use the staging project. The copied HTML displays a SANDBOX banner; production website sources are untouched. The output `native-build-environment.json` identifies the backend and receipt environment. Unknown environment values fail the build. Default builds remain production.

The candidate workflow builds both production and sandbox artifacts on PR changes; manual dispatch selects a target (default sandbox). Sandbox uses test ads and a separate 2000+ build-number range. Neither artifact is uploaded to Apple automatically.

On 2026-10-12, the Apple Sandbox ledger/verifier and cosmetics schemas/API were deployed to staging, along with the native-origin extra-play update. Test account cosmetics initialize a zero-balance wallet and an isolated generated profile. These are test fixtures/services; production profiles and balances are never copied. The Apple config endpoint reports available:false until credentials and the explicit enable flag are provisioned.

Release still requires real StoreKit device purchases and a verified reviewer flow. The production build intentionally rejects Sandbox transactions, so the reviewer environment strategy must be completed before App Review. Other production cloud services (global chat, ranked score submissions, friend rooms, account-management RPCs) are not provisioned by this commerce-only sandbox setup; their absence must not be worked around by pointing any part of the sandbox bundle at production.

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
- Native web bundle, Capacitor sync, and Xcode native compilation succeeded (GitHub run 38266773397).
- Signed iOS 1.3 (1001) archive/export succeeded (run 38266773476), artifact earnly-arcade-ios-1.3-1. No Apple upload step exists in this workflow.
- Shop visually inspected at 390 × 844 with mocked StoreKit products.
- All three macOS mobile WebKit shards, desktop Chromium, and simulations/contracts passed on implementation commit 11bdc15591a1dc8272ae2cdc783e304b30a16fad (run 38266773523).
- Draft PR #140: https://github.com/lsddreamming/earnly-arcade/pull/140 . Source uploaded after explicit user approval. No production deployment or Apple submission.
- Four fresh current-UI captures (games, character studio, Player Hub, Crystal Command gameplay) were uploaded to the version 1.3 draft in 1320 × 2868 and 1206 × 2622 sizes. Captured using mobile Chromium with the actual read-only production cosmetics catalog cached for local network access. These are web-interface captures, not on-device StoreKit evidence.
- Apple App ID is 6814277509. Version 1.3 remains Prepare for Submission.

The generic all-desktop test discovery includes a separate touchscreen-only iPhone quit-stress suite. That invocation was stopped after missing-touch errors; the repository's actual desktop CI selection above completed successfully. The dedicated iPhone stress suite is outside the normal CI selection; real-device purchase testing remains required.

## Sandbox continuation validation

- Native environment tests: 3 passed; production bundle preservation and shared backend isolation covered.
- Sandbox ledger integration passed: Apple test coins purchase an avatar and three plays; purchased balance decreases correctly and lifetime earned remains zero. Anonymous/authenticated direct ledger access is denied.
- Commerce and release-gate tests passed again after these changes.
- Live staging Apple config is disabled pending credentials. Cosmetics catalog and native-origin endpoints are checked separately from real purchase verification.
