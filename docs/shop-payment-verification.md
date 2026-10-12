# Payment release hold and verification record

No live payment activation or Apple submission is authorized by this document. The safe shop UI and coin-funded catalog are deployed; payment release requires the evidence below. Automated tests do not substitute for provider or device tests.

## Configuration inventory

| Item | Verified state on 2026-10-12 | Remaining work |
| --- | --- | --- |
| Apple Starter / Plus / Vault | Existing consumable drafts repriced to US $0.99 / $2.99 / $4.99; quantities 500 / 1500 / 4000 | StoreKit device retrieval and purchase tests; review screenshots |
| Apple VIP | `com.earnly.arcade.vip.monthly`, Apple ID 6822054483, group 22469184; one month, US $4.99; English localization saved | Review screenshot, device lifecycle tests, purchase-option review |
| Apple business | Paid agreement, banking, U.S. tax form Active | EU trader verification by owner |
| Apple signed candidates | Production 1009; sandbox 2009; version 1.3; no upload | Installable device distribution and lifecycle evidence |
| Stripe VIP | Backend implementation exists; dashboard setup not verified | Product/price, customer portal, signed webhook, sandbox lifecycle tests |
| Reviewer sandbox routing | Production rejects Sandbox; isolated sandbox project exists | Implement and verify a reviewer flow without production balance or ranking contamination |

## Stripe owner setup sequence

Use the Stripe and Supabase dashboards directly; never send passwords, API keys, or webhook signing secrets through chat, issues, screenshots, or git.

1. In Stripe **test mode**, inspect existing products first. Reuse the matching VIP product where available. Configure a USD 499-cent recurring price, interval month, interval count 1. Do not enable trials, discounts, quantity changes, or alternate prices: the current verifier expects the full $4.99 payment for one pass.
2. Configure the customer portal to let customers cancel their subscription. Disable changes to unverified subscription prices or quantities. Verify the cancellation path with a test customer.
3. Configure the isolated project's pass webhook at `https://wphqfogbnpdsfkquvdsu.supabase.co/functions/v1/arcade-pass/stripe/webhook`. Select `invoice.paid`, `invoice.payment_failed`, `invoice.voided`, `invoice.marked_uncollectible`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `charge.refunded`, `charge.dispute.created`, and `charge.dispute.closed`. The endpoint verifies signatures and retrieves current provider state; a Checkout redirect does not grant benefits.
4. Enter test credentials only in that project's Edge Function secrets: `STRIPE_SECRET_KEY`, `STRIPE_PASS_PRICE_ID`, `STRIPE_PASS_WEBHOOK_SECRET`. Use the generated sandbox function bundle, which is pinned to this project and rejects live-mode payments. Do not deploy the sandbox bundle to production.
5. Once configuration is verified, enable only the isolated sandbox's `SHOP_TWO_PAYMENTS_VERIFIED` and `ARCADE_PASS_WEB_ENABLED` for controlled testing. These flags are project-specific. Production stays disabled.
6. Record the lifecycle evidence below. After all blockers are resolved, configure separate live-mode products/secrets and the production webhook; test-mode identifiers and secrets are not interchangeable. Live checkout activation remains a separate release decision.

For production rollback, set `SHOP_TWO_PAYMENTS_VERIFIED=false` and the provider enable flags false. Keep webhook verification credentials configured: already-paid transactions, refunds, restore and subscription management must continue processing during a sales hold.

## Device and provider evidence

Record build/commit, environment, UTC test time, result and a redacted evidence reference for each row. Do not record signed receipts, tokens, private keys, customer contact information, or card data. Every row is **pending** until real evidence is attached.

| Scenario | Expected result |
| --- | --- |
| Every Apple coin product | Localized StoreKit price; exact coins credited once to the purchasing account |
| Apple and Stripe VIP initial payment | Cosmetic access until verified expiry; no coins, cash rewards or gameplay advantage |
| Cancel / pending approval | No entitlement or coin credit before verified completion |
| App termination / network loss after payment | Unfinished purchase redelivered; exactly one credit; finish only after server acknowledgement |
| Duplicate delivery / wrong account | Retry is idempotent; different account cannot claim receipt |
| Refund before and after coin spending | Purchased credit revoked or debt created; stale receipt cannot restore refunded value |
| VIP renewal / cancellation / expiry | Correct period extension; cancellation management works; expired cosmetics fall back |
| VIP refund / dispute / delayed event | Revoked transaction cannot regain access from stale delivery |
| Reinstall / restore | Correct original-account state; consumable balance is restored from server, not re-granted |
| Sales hold enabled | New checkout unavailable; restore, signed refund processing and cancellation still work |
| Account deletion | Deletion succeeds; receipt tombstone prevents replay into a new account |
| Sandbox isolation | No changes to production balances, entitlements, earned totals or rankings |
| App Review purchase flow | Same production candidate handles Apple's review environment with proven isolation |

## Review notes draft

Arcade Coins buy digital cosmetics, extra plays and supported continues. All coins and gameplay earnings in this version are non-transferable and cannot be redeemed for cash, gift cards, Bitcoin or prizes. Purchased amounts are tracked separately on the server. Free gameplay remains available.

VIP Arcade Pass is an optional monthly auto-renewable subscription for cosmetics only while active. It grants no coins or cash-equivalent benefits. Restore Purchases and Manage Subscription are available in the shop. Account deletion is available from Player Hub.

Do not paste these notes as proof that the reviewer flow works. Add tested reviewer sign-in instructions and genuine purchase-screen captures only after the environment blocker is resolved. No product or version should be added for review in the meantime.
