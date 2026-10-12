# Arcade Shop 2.0 release candidate

This branch extends PR #140. Do not activate live payments or submit to Apple.

## Implementation

1. One Arcade Coins wallet, with the existing purchased-balance provenance, purchase debt, idempotent Apple/Stripe receipts and purchased-first spending. Migration proposes 500/$0.99, 1,500/$2.99 and 4,000/$4.99. Existing order snapshots retain their original values. Apple quantities and product identifiers remain unchanged; localized StoreKit prices remain authoritative. All cash/gift-card/Bitcoin redemption is disabled, including earnings from paid plays.
2. The existing inventory/equip service now supports pets, frames, victory poses and effects, alongside outfits, crowns and accessories. New SVG layers share the existing character rig. Pulse outfit, pets and aura animate in the shop with reduced-motion support. Existing free items remain available.
3. Result screens link to the shop and can buy three extra plays for 25 coins. Existing server-backed Brick Breaker continue remains 25 coins, once per run. Continues are not added to games without a safe resume state. No purchase dialog interrupts a running game.
4. Crystal collection includes independently equipped army, commander, building and battle-effect cosmetics. Army/building/effect colors affect only rendering; commander styling appears in the game header. Simulation, target selection, networking, stats and rankings are unchanged. Players can purchase pieces individually or buy the complete Ion collection in one atomic purchase. The price is 750 coins when nothing is owned; owned pieces reduce the quote. The server verifies the expected price before debiting.
5. Optional proposed $4.99/month VIP exposes two subscription-only cosmetics. Apple signed transactions and Stripe paid invoices grant time-bounded access; refunds revoke, expiration falls back to defaults. Subscription receipts remain as tombstones after account deletion. Native restore and Apple management are provided; website management uses Stripe Billing Portal. No currency or gameplay perks are granted.
6. Halloween availability: 2026-10-01 through 2026-11-01 UTC. Christmas: 2026-12-01 through 2027-01-05 UTC. Server time controls new purchases; already owned items remain equipable. No countdown timers.
7. Home, Profile, Games and results provide shop links. Shop collections, previews, ownership, equipped states, and one wallet reuse the existing systems.

## Required configuration and verification before activation

- Apply `20261012165849_arcade_shop_two.sql` after the existing PR #140 migration, with backend deployment coordinated with the catalog response changes.
- Deploy `avatars`, `coin-shop`, `coin-webhook`, `apple-coins`, and new `arcade-pass`, including their shared modules. Subscription webhooks authenticate provider signatures; user routes authenticate Supabase sessions. `verify_jwt=false` is intentional for externally signed webhooks.
- `SHOP_TWO_PAYMENTS_VERIFIED` defaults off. Existing `COIN_CHECKOUT_ENABLED` and `APPLE_COIN_PURCHASES_ENABLED` alone no longer activate this candidate's coin checkout.
- Verify Apple agreements, banking/tax, all coin price changes, localized products, and review screenshots. Create `com.earnly.arcade.vip.monthly` as one monthly auto-renewable subscription in one group. Product configuration has NOT been changed by this branch.
- Configure a Stripe monthly recurring USD 499-cent price in `STRIPE_PASS_PRICE_ID`, and Billing Portal cancellation. Configure `STRIPE_PASS_WEBHOOK_SECRET` for `/functions/v1/arcade-pass/stripe/webhook`. Subscribe to invoice payment/status, subscription lifecycle, charge refund and dispute events. Existing coin webhook remains separate and unchanged.
- `ARCADE_PASS_WEB_ENABLED` and `ARCADE_PASS_APPLE_ENABLED` default off. Keep both off until real provider sandbox testing, product disclosures, renewal/cancellation/refund/recovery and cross-platform entitlement checks pass.
- Verify complete App Review sandbox handling. The existing production Apple verifier rejects Sandbox, and this is still a release blocker; never redirect sandbox balances into production to bypass it.
- Run real-device Apple purchases for every coin pack and VIP, pending/cancelled transactions, reinstall restore, interrupted deliveries, renewal, cancellation, refund, expired subscriptions and account deletion. Mocked tests do not replace these checks.
- Verify legal/commercial acceptability of the unified nonredeemable currency and subscription with the payment providers before activation. No cash-equivalent benefits or redemption have been introduced.

## Validation and remaining work

Local ledger integration validates new slot defaults, proposed web prices, cosmetic purchase retries, out-of-window collection rejection, ownership persistence, VIP expiry/refunds/replay/account binding, browser-role permissions and no coin grants from VIP. Pass API tests reject wrong Apple app/environment/product/account, unsigned Stripe events, test mode, unpaid/underpaid invoices and wrong prices.

Focused desktop: 46 tests passed before the compact-pass adjustment; 37 density/new-shop checks passed after adjustment. Existing simulations/source contracts: 23 passed. Full desktop and exact-commit GitHub QA are required before PR/merge. Local WebKit cannot launch because system libraries are missing; package installation encountered environment package-manager restrictions. GitHub macOS WebKit remains required. Signed iOS candidate workflow only archives; it has no Apple upload or submission step.

Production deployment, real payments, actual subscription products, device purchase evidence and new signed archive are not yet verified. Do not describe this candidate as live or fully released.
