# VIP monthly furniture implementation contract

The $4.99 monthly pass will include one guaranteed, previewed furniture gift per
verified paid monthly period. Gifts are original Earnly designs, cosmetic only,
not tradeable, and have no cash or redemption value. Cancellation preserves gifts
from paid periods; refunds or revoked purchases invalidate the corresponding gift.

## Fulfillment requirements

- Extend the existing verified Apple transaction and Stripe paid-invoice paths;
  never award from checkout redirects, client VIP flags, or calendar timers.
- Apple eligibility requires the signed transaction's positive price and valid
  monthly purchase/expiry dates. Free trials and unverified or missing payment
  data cannot qualify. Approved sandbox accounts remain isolated from production
  gifts.
- Stripe eligibility requires the existing successful-payment reconciliation,
  the configured monthly price, and a full monthly invoice line. Prorations,
  unpaid invoices, refunds, disputes and duplicate delivery cannot mint gifts.
- Persist a unique provider/transaction award and a unique subscription/period
  award. Serialize ownership checks and item minting in a database transaction.
- Replay/restore returns the original award. A failed award remains retryable
  without charging again or duplicating a gift.
- Use additive schema changes with RLS and service-only RPC grants. Never modify
  coin balances, existing furniture ownership, or payment prices.
- Make VIP definitions unavailable through ordinary coin purchase and trading.
- Retain gift audit records on refund. Prevent refunded gifts from being placed
  or displayed, including any currently placed copy, without deleting room data.
- Handle full backpacks with a pending award rather than losing a paid benefit.

## Presentation

Show the exact upcoming gift before subscription, an owned/delivered state, and
delivery status in the VIP panel. Suggested original collection: a neon throne,
an aurora fountain, and a luminous botanical display. Do not advertise artificial
scarcity or claim a fixed supply. The gift schedule must be explicit and must not
promise an endless stream of unique designs from a small repeating collection.

## Release gate

Implementation includes three original rotating designs, the verified payment
evidence adapter, automatic awards, refund invalidation, pending delivery, and
shop/World presentation. Local payment, ledger and browser tests pass. Production
release still requires desktop Chromium and iPhone WebKit CI, then checked assets,
this migration, and both arcade-pass and apple-coins function deployments.
Keep existing payment activation switches unchanged. No Apple build is required.
