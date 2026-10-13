# Purchasing continuation — 2026-10-13

## Verified current configuration

- Production coin catalog: Starter 500/$0.99, Plus 1,500/$2.99, Vault 4,000/$4.99, all active.
- Production coin checkout reports available. This was already enabled before this continuation; no payment switches were changed here.
- Apple coin and VIP implementations use StoreKit, signed server verification, account binding, unfinished transaction recovery and server-owned balances. Dedicated Apple Sandbox review accounts cannot receive live purchases or post ranked scores.
- Production VIP config reports webAvailable=false and appleAvailable=true.
- The live Stripe account has the existing coin webhook with checkout completion, asynchronous success, refund and dispute events. No saved live prices or VIP webhook were returned by the connected account at inspection. Coin checkout uses server-generated inline prices, so absence of saved coin prices is expected.
- Test-mode Stripe VIP webhook and $4.99 monthly price exist. The testing ledger contains five Stripe invoice receipts, four revoked; this confirms persisted records, not all required lifecycle evidence.
- No production or review-account Apple coin receipts were present at inspection. Actual StoreKit fulfillment and restore still need on-device evidence.

## Changes in this continuation

- Resolve PR #143 against the Apple reviewer isolation fix without dropping either test suite.
- Preserve explicit live/test mode checks, signed webhook validation, idempotent invoice receipts, cancellation reconciliation, refund handling and trusted Checkout redirect validation.
- Add three distinct neon vector coin-pack illustrations and compact mobile cards. Keep authoritative server/StoreKit prices, amounts, accessible purchase buttons and wallet behavior.
- Include product art in native packaging and offline web assets.

## Remaining activation work

Stripe read calls worked, but write calls repeatedly returned an authentication-retry response. No live VIP price was created. The connection subsequently exposed only the live account. Reconnect Stripe with the needed write permissions and test account access, then configure the live monthly price, cancellation portal and signed VIP webhook. Supabase's connected tools do not expose a secret-setting operation; keep all secret values in the provider's secure settings, never git or chat.

Complete actual StoreKit purchases using a separately enrolled test account, verify exact delivery, restore, cancellation and recovery, and confirm the App Store draft's outstanding business/product requirements. Do not submit the new version until these are complete. Previously approved binaries remain unchanged.

Cash, gift-card and Bitcoin redemption remains disabled. A single visible coin balance retains purchased provenance; this is not approval to redeem earned or purchased coins.
