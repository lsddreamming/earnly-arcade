# Earnly World AI Spud Residents

## Implementation and scope

Public rooms draw from the ten established personalities, including Jax (comedian), Blitz (competitive gamer), Mochi (shy), Zippy (energetic) and Sprout. Quiet public rooms have four or five residents, with a stable shuffled lineup specific to each room. As human attendance grows, residents retire one at a time at 20-second intervals; quiet rooms repopulate gradually. Persisted friendships remain available for invitations even when a resident retires from the public room. Nameplates use ordinary names. A small, readable AI resident badge appears beside the name in avatar preview/chat and friendship panels before interaction; it is not repeated in each bubble. All use existing Spud Shop layers; no new player accounts, inventory, currency or presence records are created. The prominent room label is “Spuds here”: real occupants plus AI residents. Opening the public room directory materializes the actual resident simulation before counting, so unvisited hangouts show their existing Spuds before a human joins. Unavailable or floor-constrained rooms retain the nonnumeric fallback; human occupancy and visit telemetry are never inflated. The underlying human occupancy/capacity still comes exclusively from authenticated room members; AI does not increase real-player or friend-online counts.

Residents independently choose short walks, seating, dancing and furniture admiration. Opening a nearby profile pauses that resident and walks the player over along a clear bounded route. Profiles renew a 45-second server lease; closing the profile releases it. Moving to public chat preserves the hold while typing, for up to one minute of inactivity. Public chat never interrupts player walking. Leaving, disconnecting or an expired lease releases it. Multiple players can talk to the same resident independently. Path searches are staggered to one planning actor per room tick with bounded A*. They reserve seats, respect live player/pet occupancy and grid revisions, and never target or chase a player. AI snapshots and greetings require the new client capability, so older installed clients do not render Spuds as ordinary host NPCs. Furniture placement previews include resident occupancy. Walking uses the existing cached avatar renderer with 700ms interpolation; dancing respects Reduce Motion. Small/disconnected rooms admit only residents with safe reachable floor.

Natural mode allows short generated two- or three-resident conversations after a quiet minute, with 2–4 minutes between starts. Players within eight tiles hear and can join. A human message cancels pending ambient replies. Quiet hides unsolicited conversations and only explicitly addressed messages request a response. Residents pause through the existing movement leases; player movement is unchanged.

**Public dialogue uses OpenAI’s Responses API on the server**, with a bounded recent-public-chat window for each resident. Every moderated normal message within eight Euclidean tiles and one height unit is eligible, including player-to-player chat. A named resident takes priority, followed by the active conversational partner, then the nearest resident. The model may choose `SKIP` when an unsolicited interjection would be inappropriate. No topic classifier or canned fallback drives public answers. Legacy private preference controls retain their existing deterministic confirmations.

Whispers, human DMs and saved private memories never enter model prompts. Public history expires after two minutes of room simulation, is bounded to 24 lines, and is discarded when its author leaves. Responses inherit the intersection of the supplied context's authorized audiences and recheck proximity before delivery. Blocking clears pending dialogue/context. Ambient prompts use only generated ambient dialogue, so they cannot relay human conversations to new audiences. Normal successful interactions update existing opt-in visit memory without saving transcripts.

## Provider configuration and cost control

Render Dashboard is the source of truth for the existing `earnly-world` service. Merge these keys without replacing existing variables:

| Variable | Value |
| --- | --- |
| `OPENAI_API_KEY` | Secret project API key, entered directly in Render Environment |
| `WORLD_AI_ENABLED` | `true` (set `false` to disable immediately on next deploy) |
| `WORLD_AI_MODEL` | `gpt-6-luna` |
| `WORLD_AI_DAILY_USD` | `1` maximum, lower values allowed |
| `WORLD_AI_MONTHLY_USD` | `10` maximum, lower values allowed |

Verified official model/pricing references on 2026-10-29: https://developers.openai.com/api/docs/models/gpt-6-luna and https://developers.openai.com/api/docs/pricing . Luna supports Responses and reasoning `none`; standard rates are $0.10/M input and $0.50/M output. Account access/billing still requires a live test. Unknown models are disabled until their schema/pricing is reviewed; there is no automatic expensive fallback.

Apply `20261029180854_world_ai_budget.sql` before enabling. A server-only SECURITY INVOKER RPC atomically reserves $0.002 per attempt against UTC day/month counters and a shared 12 requests/minute cap. Reservations are deliberately never refunded (including failures), survive restarts, and bound cost conservatively at current published prices: at most 12,000 prompt UTF-8 bytes plus token framing allowance and 256 output tokens. The counters report reserved allowance, not an invoice. Do not bypass the cap by changing model/pricing without review. Also set project billing limits/alerts in OpenAI and monitor actual invoices; account billing settings are managed by the owner.

Additional controls: six accepted AI turns/player/minute across rooms; one in-flight generation/room; two globally; a maximum eight-person pending queue (latest message per player); 30-second stale-result cutoff; at least three seconds between delivered replies; a 60-second circuit breaker after provider failures. Each HTTP operation has an eight-second timeout and no redirects or retries. Empty rooms make no calls. Input/output moderation fails closed, output is plain bounded text, and near-duplicate answers are dropped. Provider requests use `store:false` with no tools or previous response ID. This does not override OpenAI's account-level data retention policy.

`/health` and the startup diagnostic expose only key-presence boolean, enabled/model state, and aggregate counters. `resident_ai_usage` logs requests, completions, failures, moderation/limit counts, and token totals—never keys, prompts, responses, usernames or raw provider errors. Database budget rows contain only aggregate bucket counters. Missing credentials, disabled configuration, exhausted budget or provider/moderation outages do not break World. Directly addressed users get an honest temporary-unavailable toast; residents never masquerade scripted text as generated answers.

## Privacy and persistence

Memory starts off. Explicit AI friendship can be saved independently of memory consent. Turning memory off erases saved facts while preserving friendships. Players can inspect all saved facts and forget one resident or all. Account deletion cascades to both private tables. No transcripts, human friends' data, chat messages or other players' scores enter resident memory. Existing private memory preferences remain separate from public speech. AI memory stays out of room broadcasts, presence counts, human messages and telemetry.

`world_residents` is a service-only SECURITY INVOKER RPC. Tables live in the private `earnly_world` schema, have RLS enabled and deny client grants. The authenticated server adapter binds actor and current room; supplied user IDs cannot select someone else's records. All account and room checks are repeated. No browser service credentials.

Invitations require an existing AI friendship and the host's current owned room. One AI visitor can join at a time, with independent exploration and contextual furniture replies. The owner can dismiss it immediately. It leaves on host disconnect/room change or after ten minutes of active simulation. Invitations never follow players or grant access to another player's room. Visiting AI still does not affect human occupancy.

## Review and rollout

The implementation is split into stacked PRs: simulation, Natural social mode, private memory, then invited visits and end-to-end QA. No Apple upload or App Store submission is included. Normal simulator compile checks may run.

Apply `20261029131420_world_ai_resident_memory.sql` through the usual database release workflow before enabling persistence. Then deploy the reviewed World server and matching root/www client. Until the RPC is available, the server keeps World and basic residents working and hides memory/friendship/visit controls. An unavailable memory service must not be reported as successful persistence. The memory migration was applied with the Phase 4 release; this update additionally requires the AI budget migration above.

Required checks remain enabled: world engine, native simulator build, simulation/contracts, desktop Chromium and all three mobile WebKit shards. `scripts/test-world-residents.mjs` adds database isolation/consent/erasure/restart/privilege and visit-ownership checks. `tests/world-ai-residents.spec.js` exercises public chat, consent, Quiet, separate human/resident counts, friendship, consent and room invitations in both browser projects.

## Resident homes

Ten permanent, system-owned showcase rooms give each resident a named home with 15 pieces from the existing catalog. The rooms have a bed, seating, lighting, plants, a Tidal Glass Aquarium, and personality-specific decor. The aquarium's existing renderer animates swimming fish and bubbles; Reduce Motion remains respected. Catalog scenery is stored as public room decor, never minted into tradable inventory. No player balance, furniture ownership, item supply, or player room is changed.

Rooms are an optional destination under Residents → Resident rooms and each resident profile's About my room / Visit room controls. There are no automatic teleports or invitation popups. They are excluded from the ordinary Public Hangouts list. The named resident remains as the single host even when a room is busy; ordinary movement, seating, public chat and eight-tile hearing still apply. Resident identities can be represented in their home and a hangout, without creating human accounts or inflating human occupancy.

The server reads only actual public home names and furniture from `world_resident_home_catalog`. Missing metadata hides the feature and gives the model no invented home facts. Public AI prompts receive a bounded projection of these system-room facts, never player room inventories. The prompt permits room discussion/optional visits only when a human asks about the resident's home, decor, aquarium or visiting; it forbids unsolicited promotion, repeated invitations and fictional new purchases. The model cannot navigate or alter rooms.

Apply `20261029191500_world_resident_homes.sql` before the matching server deployment. Generate it from `world-server/src/resident-homes.ts` using `node scripts/build-resident-homes.mjs`; CI checks that the migration matches the source. The migration fails if catalog prerequisites are absent or a reserved room ID belongs to a player. Reapplying it preserves existing rooms. Its metadata RPC is service-only. Database tests verify all ten layouts, connected floor, exact facts, host persistence, no charges/minting, ownership and role boundaries; browser tests verify explicit visits, phone layout, and noneditable scenery.

Responses parsing selects the final assistant message rather than concatenating commentary/draft messages, preventing a repeated-draft edge case observed during the live rollout.
