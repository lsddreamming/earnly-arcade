# Earnly Rooms — architecture and grid engine

Status: Tasks 1 and 2, ready for review. No database migrations, live room server, WebSocket transport, or player-facing world is deployed by this module. Earlier lightweight page and database drafts are excluded from this change. Apple submission remains on hold.

## Task 1: recommended stack

| Layer | Choice | Reason |
| --- | --- | --- |
| Authoritative room service | Node.js 24 LTS + TypeScript + Colyseus | One server-owned room simulation; authenticated clients send intents and receive state deltas. Configure a 250 ms movement tick and a 100–250 ms patch cadence. |
| Browser/iOS renderer | PixiJS 8, WebGL renderer, original RGBA pixel sprite atlases | Sprite layering, nearest-neighbor sampling and texture batching suit the 2:1 diamond grid; reuse web assets in the existing Capacitor app. |
| Durable data | Existing Supabase PostgreSQL | Preserve UUID account IDs, wallets, purchased-coin provenance and cosmetic ownership. Database transactions settle purchases and trades. |
| Authentication | Existing Supabase Auth | Verify access tokens on the server; never accept a user ID or coin balance from a packet. No new password table. |
| Live room state | In-memory room instance initially; Redis when deploying multiple workers | Avoid a database write per movement tick. Redis can provide shared presence, matchmaking and coordination when needed, but is not the source of item ownership. |
| Hosting | Existing Pages frontend + separately hosted always-on WSS Node service | Static Pages cannot host an authoritative game process. Select a host and confirm its cost before provisioning. No new paid service is provisioned here. |
| Verification | Node test runner and pinned TypeScript compiler | The deterministic grid engine has no runtime dependencies and runs independently of transport. |

Colyseus is preferred over wiring raw Socket.IO because room lifecycle and delta synchronization are central to this project. Exact framework versions should be pinned when the network module is implemented; this task adds no networking dependency. Current reference: https://docs.colyseus.io/room and https://docs.colyseus.io/netcode/server-input . Pixi rendering reference: https://pixijs.com/8.x/guides/components/renderers .

### Original visual direction

Working name: Earnly Rooms. Public destinations: The Plaza, Neon Lounge, Rooftop Garden. Player storage: Backpack. Use original potato bodies, original tile sets, decor silhouettes, palette and interface frames. Create eight directional atlas views for body, eyes, hair, clothing, shoes and props. Existing front-facing SVG avatars are identity references; they are not yet eight-direction pixel animation assets.

Projection: `screenX = originX + (x-y)*tileWidth/2`, `screenY = originY + (x+y)*tileHeight/2 - z*heightPixels`, with `tileWidth = 2*tileHeight`. Movement operates on grid coordinates, never rendered pixels. Render-order ties use x+y, elevation, item layer and stable instance ID. Large overlapping objects will require footprint-aware occlusion sorting.

### Planned authoritative contracts (not yet implemented)

- Each authenticated socket is bound to one server-selected account and room. Room access, bans, block lists and capacity are checked before joining. Password rooms store a password hash, never plaintext.
- MOVE_TO contains x/y intent only. Server computes the path, moves one bounded step on its clock, checks occupants/height revisions again, then sends authoritative positions. The renderer interpolates for appearance only.
- Each floor/item edit builds and validates a new immutable RoomGrid, then increments room revision. Reject unsupported stacks, collisions, edits beneath occupants, or edits sealing all exits. Stop stale paths and require/recompute a new route. Transactionally validate ownership before publishing a room change.
- Seat/bed plans walk to an adjacent usable tile and execute the action only after reaching it; the room actor reserves the destination and revalidates at transition time. Exiting a seat is a distinct first step, followed by ordinary walking.
- Normal speech is filtered/rate-limited and delivered to nearby permitted recipients. Shouts are room-wide. Whispers are server-filtered to the selected recipient within Euclidean distance <=1; never broadcast private text and hide it only in the client. Private messages need recipient consent, block enforcement and reporting. Public chat can reuse existing moderation concepts, but requires a room-scoped implementation.
- Trading uses immutable item instance IDs and an offer revision. Any edit invalidates both locks and final confirmations. Stage 1 locks both participants' offers. Stage 2 requires both final confirmations. The database transaction locks instances in stable ID order, rechecks ownership/reservations/revision and performs all transfers plus the audit log together. Cancellation/disconnection/timeouts release reservations. No coins or cash are transferred through item trades.
- Catalogue definitions carry server-authoritative price, timing and supply. Limited editions require transactionally enforced mint limits and serials; ordinary rare styling must not imply a finite supply. Never advertise a limited run until that enforcement exists.
- Keep the existing Arcade Coins wallet. No new signup balance or second currency. Purchased decor can be traded only within the approved in-game system, with no cash-out, external sale tools or redeemable prizes. Refund/chargeback handling for already-traded purchases must be designed before paid trading launches.

## Task 2: implemented engine

Files:
- `src/grid.ts`: strict heightmap parsing, bounds, immutable collision surfaces, item footprints, rotation, supported stacking, seat/bed flags.
- `src/pathfinding.ts`: deterministic A* with binary min-heap, octile/Manhattan heuristic, orthogonal and diagonal movement, height limits, occupant collision and bounded search.
- `src/interactions.ts`: nearest reachable approach to a seat/bed, authoritative final validation, and routes for exiting the interaction.
- `src/movement.ts`: strict MOVE_TO parser and a server-ticked walking controller. Repeated packets do not advance time. Item revisions or new occupants stop stale paths.
- `tests/engine.test.ts`: regression tests and comparison with an independent Dijkstra implementation on 100 seeded maps.

### Height model and intentional limits

- x/y are integers; floor strings use digits 0–9 and `x` for voids. Numeric floor matrices permit integer heights 0–64. Rectangular maps are limited to 64×64.
- Item heights use exact quarter units, not unrestricted floats, to avoid accumulation errors in collision checks. Up to 2,048 placed instances; each top surface must remain <=64 units.
- A placed item stores absolute z. It must exactly meet the support surface at every tile of its rotated footprint. The resulting top equals floor plus supported item heights. Unsupported, intersecting or non-stackable support is rejected.
- This engine models one top surface per tile. Bridges with walkable space underneath are deliberately unsupported; these require a multi-surface navigation graph.
- A* uses costs 1 orthogonally and sqrt(2) diagonally. The controller accumulates those costs on 250 ms ticks, so diagonal movement cannot travel faster for free.
- A chair or bed need not be walkable to be usable. Its canSit/canLay flags enable an interaction route; ordinary A* does not route through it. Final sit/lay changes run through completeInteraction, not through ordinary canStep.
- The `occupied` set is a server snapshot of OTHER actors; exclude the requesting actor. Before each move/action, use a fresh occupant set and atomically reserve the destination in the room tick.
- Room authorization, per-socket rate limits, destination reservations, door interactions and directional animation belong to the next module. A pathfinder alone does not provide network authentication or prevent every movement exploit.

### Example

```ts
import { RoomGrid, parseHeightmap } from './src/grid.ts';
import { findPath } from './src/pathfinding.ts';
import { findInteraction, completeInteraction } from './src/interactions.ts';
const room = new RoomGrid(parseHeightmap('0000\n0x00\n0000'), [], 1);
const route = findPath(room, {x:0,y:0}, {x:3,y:2});
// {status:'ok', path:[...authoritative XYZ waypoints], cost, expanded, revision:1}
// To sit: findInteraction(room, position, chairTile, 'sit'), walk its path,
// then completeInteraction(room, authoritativePosition, plan, {occupied}).
```

Validation commands (Node 24):

```sh
npm ci --prefix world-server
npm test --prefix world-server
npm run typecheck --prefix world-server
```

Pause here for owner review. Next phase, only after review: persistent instance ownership and double-lock trades, then authenticated WSS room protocol. No migration from the draft implementation should be applied.

## World foundation: room runtime and persistence

`RoomRuntime` binds server-verified identities to movement controllers, sends room
snapshots/deltas, and filters proximity chat/whispers before delivery. The transport
adapter must validate sessions and room access, apply moderation/block lists, bound
packet sizes, and call `tick()` on a 250ms server timer. This module is not a public
WebSocket endpoint yet. Send callbacks must handle disconnected sockets without throwing.

`TradeSession` implements revisioned double-lock offers. The SQL migration persists
rooms, decor definitions, unique item instances, trades and transfer history. Its
service-only `world_trade_action` repeats both confirmations and ownership validation
inside PostgreSQL, locks item rows in stable order, and transfers both sides atomically.
A trade timeout must be reconciled by ID; never create a new trade to retry a commit.
The database trade is authoritative; adapters must use its returned revision/locks.

This phase does not enable catalog sales, room editing or public chat. Before launch:
add authenticated WSS transport, room-entry/access rules, moderation/reporting,
server-validated placement, catalog purchase receipts, and the original pixel renderer.
The player-facing destination is **World / Earnly Plaza**, separate from Games.
