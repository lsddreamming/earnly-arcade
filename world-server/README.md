# Earnly World

World is a separate destination from Games. The website has an original isometric
plaza preview and a live client. It renders each player's **existing saved potato
avatar and cosmetic layers** as a small, nearest-neighbor character; it does not
create a second avatar account. No competitor artwork is included.

`world-config.js` deliberately contains an empty endpoint until a WSS worker is
hosted and its deployment is verified. Preview mode is labeled, contains no fake
online players, and disables purchases. Publishing the website does not itself
host multiplayer. No Apple build is submitted by this module.

## Implemented stack

- Node 24 + TypeScript + pinned `ws`: one authoritative worker, 250 ms room ticks,
  bounded JSON intent packets and server-computed movement. The transport-independent
  engine can be moved to a room framework when multi-worker routing is necessary.
- HTML Canvas: original 2:1 tiles, procedural decor and existing layered potato
  artwork sampled to small sprites. No large renderer dependency for the first release.
- Existing Supabase Auth/PostgreSQL: verified sessions, UUID accounts, the existing
  Arcade Coins wallet, purchase receipts, inventory and atomic item transfers.
- Existing GitHub Pages frontend; a separate always-on Node service behind TLS.

## Features

- Seeded Earnly Plaza with static public decor and seating. Up to three personal
  8x8 rooms per player; open or owner-only access. Room changes persist.
- Twelve original catalog definitions, an enforced limited supply with serials,
  idempotent purchases, Backpack, placement, rotation, pickup and supported stacking.
- Saved potato outfits, small interpolated avatars, collision-aware A*, sitting
  and laying on compatible items. Direction currently mirrors left/right; dedicated
  eight-direction sprite atlases are a future art improvement.
- Normal proximity chat, adjacent whispers, room-wide shout protocol, friend
  requests/acceptance, online status, private message history and item-only trades.
- Two offer locks plus two final confirmations, immutable revisions, ordered row
  locks and atomic swaps. Edits reset acceptance. Ownership, account eligibility,
  block lists, debt and capacity are checked again before settlement.
- Chat-rule acceptance, rate limits, reciprocal blocking, message reports,
  operator removal/suspension and retained report evidence.

Purchased benefits remain non-redeemable. There are no cash-out, wagers, external
sales or transferable coin balances. Purchases debit the existing wallet through
its provenance trigger, and receipts record the purchased-coin portion. World does
not route iOS payments to Stripe or modify payment configuration.

## Engine constraints

`src/grid.ts`, `pathfinding.ts`, `movement.ts` and `interactions.ts` implement the
heightmap engine. XY are integers; floor strings use 0–9 and x for voids, maximum
64x64. Item heights use exact quarter units, at most 2,048 placed instances and
maximum surface height 64. Items must meet every supporting tile of their rotated
footprint. Unsupported stacks, intersections and non-stackable supports are rejected.
A tile has one top surface; bridges with walkable space underneath are unsupported.

A* uses octile costs (1 orthogonal, sqrt(2) diagonal), blocks corner cutting and
checks fresh occupancy each tick. Client packets cannot advance simulation time.
Seating needs an adjacent approach and is revalidated on the room tick; exiting
is a separately validated first step. Room edits pause ticks, validate occupants,
commit an expected database revision and then publish the new scene.

## Local checks

Use Node 24:

```sh
npm ci --prefix world-server --ignore-scripts
npm ci --ignore-scripts
npm run typecheck --prefix world-server
npm test --prefix world-server
node scripts/test-world-persistence.mjs
node scripts/test-world-features.mjs
node scripts/test-world-network.mjs
npx playwright install chromium
node scripts/test-world-browser.mjs
npx playwright test tests/world.spec.js --project=desktop-chromium
```

The network check runs two real WebSocket clients against PostgreSQL-compatible
PGlite through the actual gateway and access adapter. It covers chat, private
messages, purchase, a completed trade, room switching and placement. A second check uses two Chromium browsers and local TLS through the same server
for avatar admission, chat, buying, room creation and canvas placement. It is local
integration evidence, not a production load or real-account test. CI also runs
mobile WebKit, existing commerce checks and the unchanged native build gate.

## Deployment

Apply, in order, the three `20261013*world*.sql` migrations to the selected Supabase
project. All World tables live in the private `earnly_world` schema, with RLS and no
anon/authenticated access. Only service-role RPCs write them. The worker derives
actor IDs from verified sessions; browsers never call privileged RPCs directly.

Set server-only environment variables through the hosting provider's secret manager:
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `WORLD_ORIGINS` (exact comma-separated
HTTPS origins). Never put the service key in a frontend file, URL, argument or log.
`npm start --prefix world-server` binds loopback port 8080 by default. A managed
container may set `WORLD_BIND_HOST=0.0.0.0`; terminate TLS at a trusted proxy.

A container definition and optional Caddy Compose package are under `deploy/`.
On an authorized Docker host, set the server environment and `WORLD_DOMAIN`, point
that hostname's DNS at the host, then run:

```sh
docker compose -f world-server/deploy/compose.yaml up -d --build
```

Use one worker only. It bounds frames to 8 KiB, connections to 200, rooms to 100
(evicting empty rooms), packets to 20/second and account operations to 5/second.
Authentication has a five-second deadline; heartbeat/session checks run every
15 seconds. Also configure the host's connection/IP limits. Multi-worker routing,
shared presence, regional failover and large-scale load validation are not included.

Before setting `world-config.js` to the resulting `wss://HOST/world` endpoint,
verify HTTPS health, two real staging accounts, reconnects, moderation, inventory
persistence after worker restart, and purchase/trade reconciliation after interrupted
connections. Then repeat the admission/permission checks against the intended
production project. Publish only the public endpoint, never credentials.

## Moderation operations

Players can report messages they actually received and block other users. Private
messages require an accepted friendship. Operator actions use the server environment:

```sh
node scripts/world-moderate.mjs queue
node scripts/world-moderate.mjs remove MESSAGE_UUID
node scripts/world-moderate.mjs suspend USER_UUID 24
node scripts/world-moderate.mjs restore USER_UUID
node scripts/world-moderate.mjs prune
```

Assign an operator to review reports before opening public chat. Removal hides
messages from future history; already-delivered client copies are not recalled.
Suspensions deny new operations immediately and disconnect at the next session
check. Pruning deletes messages older than 30 days except unresolved report evidence.

Later expansions: password/doorbell access, custom floorplan editing, dedicated
pixel directional animation, in-room interactive props and live events. These are
not presented as working controls in this release.
