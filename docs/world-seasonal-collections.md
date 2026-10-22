# Annual World furniture collections

Halloween offers recur October 1 00:00 UTC through November 2 23:59:59.999 UTC each year. The catalog retains every definition; only shop offers, collection filters and onboarding purchase suggestions are seasonal. Owned furniture stays in Backpacks and saved rooms and can be moved, picked up and placed throughout the year.

The database checks the season using its own clock before any new purchase changes inventory, minted counts or wallets. Previously committed purchase receipts remain replayable after closing; the catalog provides a “Confirm previous purchase” recovery action. Client filtering is presentation only. A forged date or availability flag cannot reopen purchases.

Nine original procedural models: Lantern Grin Pumpkin, Harvest Pumpkin Patch, Friendly Lantern Ghost, Sleepy Skeleton Memorial, Bubblebrew Cauldron, Violet Wisp Flame, Moonface Haunted Mirror, Batwing Bubble Bath and Silver Cobweb Mat. The existing Moonlit Cauldron remains a separate year-round item. Retro Desktop Computer and Mint Medicine Cabinet are regular Home Essentials.

The additive migration `20261022213254_world_seasonal_halloween.sql` patches the underlying World purchase function while retaining the personal-pet wrapper, VIP guard, color validation and receipt protections. It has not been applied to production. Deploy the approved migration before publishing the matching client catalog. Root and www client files must remain identical. No native build version changes are required by this PR.

Validation: `node scripts/test-world-halloween.mjs` exercises the SQL with PGlite and `npx playwright test tests/world-halloween.spec.js` exercises browser rendering, date filtering, Backpack access and interrupted purchase recovery. CI runs the browser cases on desktop Chromium and mobile WebKit.

## Separate backlog

Working paired teleporters remain separate work: authoritative destination and room-access checks, safe arrival tiles, abuse/rate controls and reconnect tests. This collection adds no teleport behavior.
