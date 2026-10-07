# Website coin checkout activation

Implemented packs: 500 coins / $1.99; 1,500 / $4.99; 4,000 / $9.99 USD. Purchases are disabled until the owner connects a live Stripe account. Existing coin earnings, outfit unlocks and extra-play purchases remain available.

## Owner setup

1. Create and activate the Earnly Arcade merchant account at https://dashboard.stripe.com/register. Complete Stripe's business, identity and bank-account steps directly with Stripe.
2. In that account, create a live webhook endpoint:
   `https://zdwziebtbpuolusztede.supabase.co/functions/v1/coin-webhook`
   Subscribe to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `charge.refunded`, `charge.dispute.created` and `charge.dispute.closed`. Use the API version pinned by Stripe SDK 22.6.2 (`2026-08-26.dahlia`).
3. Store `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in the Supabase project's Edge Function Secrets screen. Never put either key in a frontend file, repository, chat, screenshot or browser storage.
4. Keep `COIN_CHECKOUT_ENABLED` unset while verifying deployment and merchant details. Test payments in a separate Supabase staging project: this production handler ignores test-mode events and refuses to credit test-mode sessions.
5. Confirm the business's support contact, refund process and published purchase disclosures. Set `COIN_CHECKOUT_ENABLED=true` only after setup and staging verification are complete.
6. Perform an owner-controlled small live purchase, verify exactly one credit, verify a refresh/retry leaves the balance unchanged, then refund it through Stripe and verify the reversal. Do not activate advertising for purchases before this check passes.

## Behavior and recovery

- The website sends only pack ID and a request UUID. The authenticated user and prices are resolved on the server.
- Stripe hosts all card entry. Earnly stores order references, amounts and fulfillment state, never card numbers.
- Webhook signatures are verified against the raw request body with a five-minute tolerance. Live paid sessions are retrieved again from Stripe; mode, order metadata, currency, payment intent and total must match.
- A locked database transaction grants an order once. The success URL does not itself grant anything; authenticated return-page checks use the same verified fulfillment path.
- Pending orders preserve their request ID across network retries. Expired sessions require a fresh request. The server caps checkout creation at ten orders per account per hour.
- Paid coins are tracked separately from lifetime earned coins. Purchases never increase `lifetime_earned`. All existing outfit/continue debits consume the purchased portion first.
- Completed refunds reverse a proportional coin amount, rounded upward to a whole coin. If those coins were already spent, `purchase_debt` records the shortfall and subsequent paid coin grants settle it first. Earned coins remain earned. Support must explain this balance adjustment to the buyer.
- Disputed payments do not fulfill while disputed. A dispute on an already fulfilled order requires owner review; inspect Stripe's dispute queue promptly. Refund and support decisions remain with the merchant.
- If fulfillment fails, Stripe can retry the webhook. Fix the server error and resend the event from Stripe; the order transaction prevents duplicate credit.
- On account deletion, associated order and play-credit rows are deleted. Stripe retains its own payment records under its policies. Review record retention with the owner before live activation.

## Extra plays

Three extra plays cost 25 Arcade Coins for the selected game. Coins and play credits are updated together on the server; retrying a request does not debit twice. Credits do not reset daily and are separate from free/rewarded plays. Players use their daily free plays first.

When daily plays run out, the website prepares one server-backed extra play online. It says “Extra play ready! Tap Play again to start.” A lost response reuses the request ID. The prepared run is cached on that browser until started; clearing browser data can discard that prepared run. Unprepared credits remain on the account. Gameplay and its existing free-play limits are client-side, so this is not an anti-cheat or cash-prize system.

Coin payment controls and the new paid-play launcher are website-only. This change does not enable external payment links in the native iOS app or modify its submitted 1.0 release.

## Validation

`npm run test:commerce` validates SQL permissions, fixed prices, purchase retries, refund debt and extra plays, plus Edge handler authentication, signature rejection and production/test separation.

`npx playwright test tests/avatar-studio.spec.js tests/coin-shop.spec.js` verifies storefront interactions on Chromium and mobile WebKit. Deployment still uses the repository's full QA gate.

Official implementation references: https://docs.stripe.com/checkout/fulfillment and https://supabase.com/docs/guides/functions/examples/stripe-webhooks .
