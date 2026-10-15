# Earnly milestone work — 15 October 2026

## Commerce audit

Read-only production inspection at the start of this work:

- Coin config reports available with 500/$0.99, 1,500/$2.99, 4,000/$4.99 packs.
- VIP config reports webAvailable=true and appleAvailable=true. These flags were already enabled; this work does not activate payments.
- Live Stripe has enabled coin and VIP webhook endpoints on the production project, pinned to 2026-08-26.dahlia. Coin endpoint includes completed/async-success/refund/dispute events; VIP includes invoice, subscription, refund and dispute events.
- Production contains four coin orders: one fulfilled, three pending. No refund adjustment is recorded on those orders. There are zero Apple coin receipts and zero VIP receipts.
- Isolated testing contains five Stripe VIP receipts, four revoked. This is persisted evidence only, not proof of every lifecycle scenario.

Fix: persist uncertain checkout request IDs by account and pack across reloads. Return authoritative refund totals and pack ID during order recovery, so refunded purchases display an adjusted-balance message. No wallet/schema changes.

Remaining purchase release evidence: actual provider/device purchase, duplicate delivery, refund, restore, renewal/cancellation and interrupted-flow testing as defined in shop-payment-verification.md. Do not claim live readiness or turn on additional payment switches from configuration alone.

## Earnly World

Add bounded connection startup with safe manual retry and stale-socket rejection. Add furniture name search and stored/current-room/other-room filters, plus navigation to owned rooms containing placed decor. Existing server-authoritative purchase, ownership, trade and placement rules remain in force.

## iPhone and release preparation

Enlarge World view and furniture controls to at least 44px. Keep narrow-screen overlays clear and preserve text editing in input fields. Bump the web cache for these milestones.

Remove push triggers from all three Apple upload workflows. Upload requires a manual workflow dispatch with confirm_apple_upload=true; the default is false. Existing exact-source QA/publication gates on newer releases remain intact. No Apple workflow is dispatched by this work.

## Deployment sequence

Each PR requires its applicable checks, including desktop Chromium, all three mobile WebKit shards, simulation/contracts, native build and World engine where applicable. Payment source changes also require both candidate checks. Merge only passing heads; confirm successful post-merge QA and a real, non-skipped Pages publish job. Deploy the matching coin-shop Edge handler only after commerce QA passes. World changes here are client-only, so no server redeploy is needed.

Native simulator/candidate checks are build validation, not App Store uploads. Actual device purchase evidence remains outstanding; do not upload or submit an Apple build.
