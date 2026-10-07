# Character Studio

The web studio lives at `avatars.html`, linked from Profile. Players spend their existing Arcade Coins to unlock avatars, outfits and cosmetic weapons. These cosmetics have no gameplay advantage.

## Source and deployment

- `avatar-studio.js`, `avatar-studio.css`, `avatar-config.js`, `avatars.html`: shop UI using the existing `EarnlyCloud.client` authentication session.
- `cosmetic-*.svg`: ten local composable character assets.
- `cosmetic-ui.js` and `cosmetic-ui.css`: saved avatar on Profile and a full player card on World Ranks.
- `supabase/functions/avatars/index.ts`: public catalog/profile/leaderboard GETs and authenticated purchase/equip operations.
- `supabase/migrations/*_avatar_studio.sql`: server-owned catalog, ownership, loadouts, receipts and transactional routines.
- `supabase/functions/leaderboard/index.ts`: preserves score logic and adds equipped avatar asset/rarity metadata.

The Edge Function runs at `/functions/v1/avatars/api/...`; the web API suffixes are `/config`, `/shop`, `/me`, `/leaderboard`, `/user/:username`, `/shop/buy` and `/user/equip`. Mutation requests require a validated existing Supabase account, and purchases require a UUID `Idempotency-Key`. All browser-role access to cosmetic tables and routines is revoked. Functions use SECURITY INVOKER and are executable only by the server's service role. The Edge Function implements its own token validation, so the legacy JWT gateway check is disabled.

Coin purchases lock the existing wallet row, sharing serialization with Continue purchases. A database transaction reads the server price, debits the wallet, adds unique ownership, equips the correct slot and records a receipt. A retry cannot charge twice, and rejected requests roll back all changes. The UI synchronizes pending server rewards before spending.

Games Recorded is the count of server-recorded `coin_ledger` game events; this automatically includes historical and future recorded runs, and does not claim to count runs that never generated a server reward record. Scores and rank are scoped to a single game; Memory Match ranks smaller values first.

The native web mirror includes these new assets for the future 1.1 source. No App Store 1.0 binary or review submission is changed. Website publication still requires the existing QA-gated Pages workflow.

## Validation

`tests/avatar-studio.spec.js` checks buy/equip, independent slots, insufficient funds, network retry request IDs, guest sign-in, saved profile artwork, and World Ranks profile cards on desktop Chromium and mobile WebKit. Existing leaderboard stability, page/navigation and release contract tests are also run. Live SQL purchase/ownership/receipt/permission assertions were exercised inside a transaction and rolled back; the live API rejects missing and forged sessions and returns the real catalog and public profiles.


### Detailed Arcade Sprouts and accessories

The character art is original, layered SVG built by `tools/generate-cosmetic-art.py`.
All layers use a stable 300 × 400 rig. Render from back to front: backpack,
avatar, outfit, shoes, facewear, beard, weapon. Keep these anchors when adding art.

The accessory migration expands equipment to seven independent slots. All active
zero-price items are automatically granted by `cosmetic_lock_player`, under the
existing wallet lock; missing starter slots are filled without overwriting any
saved equipment. There are 25 items, including 14 free options. Existing purchased
IDs, receipts, and balances are preserved. The shop API exposes `isStarter` for a
deterministic guest preview. Try-on changes are client-only and reset explicitly;
only Equip or a confirmed purchase changes the saved loadout. The free filter
hides paid items. Profile cards and World Ranks use the same layering order.
