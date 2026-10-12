# Arcade Shop 2.0 release status

Shop 2.0 is deployed through merged PR #141 (including #140), main commit `ba9050f5fe8a0338f0202470458f80b58cc1c11e`. Real-money checkout remains disabled. Do not activate live payments or submit to Apple.

## Verified rollout — 2026-10-12

- Production migrations applied; `coin-shop` v12, `coin-webhook` v8, `avatars` v8, `apple-coins` v1 and `arcade-pass` v1 deployed. All 16 new collection items are active.
- Main QA run 38287860393 passed: 426 desktop tests (2 existing skips), 428 WebKit tests, 23 simulations/contracts, plus commerce/security/certificate checks. Native build 38287860400 and Pages deployment 38289406483 passed.
- Live shop: https://earnlyarcade.com/avatars.html . Twenty-six deployed assets matched source; mobile Chromium layout check found no horizontal overflow.
- Signed, unsubmitted iOS candidates: run 38286335769, production 1.3 (1009), sandbox 1.3 (2009). Neither was uploaded or submitted to Apple.
- Apple consumable drafts now have US prices 500/$0.99, 1,500/$2.99, 4,000/$4.99. VIP draft `com.earnly.arcade.vip.monthly` (Apple ID 6822054483) is one month at US $4.99, group 22469184. English product/group localization is saved; all remain Prepare for Submission.
- Apple Business shows Paid Apps Agreement, banking and U.S. tax form Active. EU trader verification is pending. Review screenshots and device purchase evidence remain outstanding.
- Stripe dashboard sign-in is blocked by a provider-reported Google authentication technical issue. No Stripe subscription configuration or live activation was performed.

See `shop-payment-verification.md` for the remaining evidence and owner setup sequence. Historical validation notes below describe the candidate work and are not the current deployment status.

## Implementation

1. One Arcade Coins wallet, with the existing purchased-balance provenance, purchase debt, idempotent Apple/Stripe receipts and purchased-first spending. Migration proposes 500/$0.99, 1,500/$2.99 and 4,000/$4.99. Existing order snapshots retain their original values. Apple quantities and product identifiers remain unchanged; localized StoreKit prices remain authoritative. All cash/gift-card/Bitcoin redemption is disabled, including earnings from paid plays.
2. The existing inventory/equip service now supports pets, frames, victory poses and effects, alongside outfits, crowns and accessories. New SVG layers share the existing character rig. Pulse outfit, pets and aura animate in the shop with reduced-motion support. Existing free items remain available.
3. Result screens link to the shop and can buy three extra plays for 25 coins. Existing server-backed Brick Breaker continue remains 25 coins, once per run. Continues are not added to games without a safe resume state. No purchase dialog interrupts a running game.
4. Crystal collection includes independently equipped army, commander, building and battle-effect cosmetics. Army/building/effect colors affect only rendering; commander styling appears in the game header. Simulation, target selection, networking, stats and rankings are unchanged. Players can purchase pieces individually or buy the complete Ion collection in one atomic purchase. The price is 750 coins when nothing is owned; owned pieces reduce the quote. The server verifies the expected price before debiting.
5. Optional proposed $4.99/month VIP exposes two subscription-only cosmetics. Apple signed transactions and Stripe paid invoices grant time-bounded access; refunds revoke, expiration falls back to defaults. Subscription receipts remain as tombstones after account deletion. Native restore and Apple management are provided; website management uses Stripe Billing Portal. No currency or gameplay perks are granted.
6. Halloween availability: 2026-10-01 through 2026-11-01 UTC. Christmas: 2026-12-01 through 2027-01-05 UTC. Server time controls new purchases; already owned items remain equipable. No countdown timers.
7. Home, Profile, Games and results provide shop links. Shop collections, previews, ownership, equipped states, and one wallet reuse the existing systems.

## Required configuration and verification before activation

- Both migrations are applied in production. Future deployments must preserve their order and coordinate backend/catalog compatibility.
- Deploy `avatars`, `coin-shop`, `coin-webhook`, `apple-coins`, and new `arcade-pass`, including their shared modules. Subscription webhooks authenticate provider signatures; user routes authenticate Supabase sessions. `verify_jwt=false` is intentional for externally signed webhooks.
- `SHOP_TWO_PAYMENTS_VERIFIED` defaults off. Existing `COIN_CHECKOUT_ENABLED` and `APPLE_COIN_PURCHASES_ENABLED` alone no longer activate this candidate's coin checkout.
- Verify Apple agreements, banking/tax, all coin price changes, localized products, and review screenshots. Create `com.earnly.arcade.vip.monthly` as one monthly auto-renewable subscription in one group. Draft product configuration was completed on 2026-10-12 as recorded above; it is not proof of device purchase readiness.
- Configure a Stripe monthly recurring USD 499-cent price in `STRIPE_PASS_PRICE_ID`, and Billing Portal cancellation. Configure `STRIPE_PASS_WEBHOOK_SECRET` for `/functions/v1/arcade-pass/stripe/webhook`. Subscribe to invoice payment/status, subscription lifecycle, charge refund and dispute events. Existing coin webhook remains separate and unchanged.
- `ARCADE_PASS_WEB_ENABLED` and `ARCADE_PASS_APPLE_ENABLED` default off. Keep both off until real provider sandbox testing, product disclosures, renewal/cancellation/refund/recovery and cross-platform entitlement checks pass.
- Verify complete App Review sandbox handling. The existing production Apple verifier rejects Sandbox, and this is still a release blocker; never redirect sandbox balances into production to bypass it.
- Run real-device Apple purchases for every coin pack and VIP, pending/cancelled transactions, reinstall restore, interrupted deliveries, renewal, cancellation, refund, expired subscriptions and account deletion. Mocked tests do not replace these checks.
- Verify legal/commercial acceptability of the unified nonredeemable currency and subscription with the payment providers before activation. No cash-equivalent benefits or redemption have been introduced.

## Validation and remaining work

Local ledger integration validates new slot defaults, proposed web prices, cosmetic purchase retries, out-of-window collection rejection, ownership persistence, VIP expiry/refunds/replay/account binding, browser-role permissions and no coin grants from VIP. Pass API tests reject wrong Apple app/environment/product/account, unsigned Stripe events, test mode, unpaid/underpaid invoices and wrong prices.

Focused desktop: 46 tests passed before the compact-pass adjustment; 37 density/new-shop checks passed after adjustment. Existing simulations/source contracts: 23 passed. Full desktop and exact-commit GitHub QA are required before PR/merge. Local WebKit cannot launch because system libraries are missing; package installation encountered environment package-manager restrictions. GitHub macOS WebKit remains required. Signed iOS candidate workflow only archives; it has no Apple upload or submission step.

Historical candidate note: production deployment, product drafts and signed archives were subsequently verified above. Real payments and device lifecycle evidence remain unverified; the payment release is still on hold.

## Isolated deployed validation (2026-10-12)

The new migration is applied to testing project `wphqfogbnpdsfkquvdsu` only. Testing functions: `apple-coins` v12, `avatars` v9, `arcade-pass` v1. The deployed catalog returns 109 items across 22 slots. Pass configuration reports both providers disabled. Unauthenticated Apple verification and bundle purchase requests return 401; the unconfigured Stripe pass webhook returns 503.

A rollback-only real PostgreSQL transaction verified the four-piece bundle debits 750 exactly once, preserves purchased-coin provenance, equips the collection, activates a VIP frame, and falls back after a verified refund. No test users or balances were retained. Security advisors report no new exposed-table errors; deny-all RLS without browser policies is intentional for server-owned commerce tables. The existing testing-project leaked-password protection warning remains an account setting: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection .

First branch build `ef78c7d`: native compilation and signed candidate archives passed. QA found a staging-test assertion still looking for the project guard in the old entrypoint after the runtime extraction. The guard itself remains in the imported shared runtime; the test now verifies both that import and the guard. Fresh full QA is required on `0873c571` and any later head.
