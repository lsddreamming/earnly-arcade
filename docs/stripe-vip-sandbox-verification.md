# Stripe VIP Sandbox webhook — 2026-10-13

Endpoint to enter in Stripe:
`https://wphqfogbnpdsfkquvdsu.supabase.co/functions/v1/arcade-pass/stripe/webhook`

This belongs to **Earnly Arcade Testing**, not the production database. The tested `arcade-pass` function is deployed as version 4. Its generated runtime is pinned to this project, accepts only test API keys and strict `livemode:false` objects, and uses Stripe API `2026-08-26.dahlia`. The Sandbox price is pinned to `price_1UPqV8DiPv1t7Me2icvDqvHT` ($4.99 USD/month), associated by the owner with product `prod_VQhuQazEOkHAfC`.

## Verified

- HTTPS health: HTTP 200, mode Sandbox, test Stripe key configured.
- Unsigned webhook POST: HTTP 400, no mutation.
- Webhook signing secret: **not configured yet**. Signed delivery and real provider lifecycle tests remain pending.
- Sandbox website and Apple purchases: disabled.
- Production VIP website/Apple purchases and website coin purchases: disabled, confirmed through their HTTPS configuration responses.
- `npm run test:commerce`: 38 named tests plus database assertion suites pass. Sixteen tests target the generated Sandbox handler and use actual Stripe SDK signature validation.
- Database suites exercise invoice-key idempotency, retry, sticky revocation, account ownership, RLS, cosmetic expiry, and no coin benefits. The deployed checkout and transaction tables have RLS enabled and deny direct anonymous/authenticated access.

## Behavior

Each event retrieves current Stripe objects. Only verified paid invoices for the configured price, quantity, customer, account metadata and environment grant a cosmetic period. Repeated event IDs or different event types for the same invoice converge on the same `(provider, transaction_id)` primary key. Failure returns HTTP 503 for retry; no event is marked consumed ahead of a successful transaction.

Renewals add one verified invoice period. Failed renewals do not extend access; an already-paid period runs until its existing expiry. End-of-period cancellation retains that period. Immediate cancellation revokes all recorded periods for the subscription. Refunds/disputes revoke the invoice, and stale replay cannot restore it. Voided invoices cannot retain a previous grant. Truncated provider responses fail closed.

## Finish setup

1. In Stripe Sandbox, create the Snapshot destination with the endpoint above and API version `2026-08-26.dahlia`.
2. Check the actual selected event names. Recommended events: `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `invoice.voided`, `invoice.marked_uncollectible`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `charge.refunded`, `charge.dispute.created`, `charge.dispute.closed`. An event count alone does not verify coverage.
3. Copy the newly generated signing secret directly into **Earnly Arcade Testing → Edge Functions → Secrets**, name `STRIPE_PASS_WEBHOOK_SECRET`. Never put its value in chat, screenshots, issues, source code, or logs. The test API key is already configured; do not replace it with a live key.
4. Recheck `/health`: `webhookConfigured` must become true. Send an actual Sandbox event and confirm HTTP 200 in Stripe delivery logs before claiming end-to-end success.
5. Enable only the isolated project's `SHOP_TWO_PAYMENTS_VERIFIED=true` and `ARCADE_PASS_WEB_ENABLED=true` for controlled authenticated testing. Production switches must remain false. The public shop uses production; use a testing-project session and the testing-project checkout endpoint, not the public shop, for this test.
6. Exercise initial test purchase, duplicate delivery, failed/successful renewal, period-end cancellation, immediate cancellation, refund and expiry. Confirm database entitlement state after each action and ensure production is unchanged. A dashboard-created subscription without the server checkout account metadata does not grant VIP.

No iOS build was created or submitted. No production backend or payment switches were changed by this work.
