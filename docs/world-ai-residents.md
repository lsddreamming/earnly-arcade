# Earnly World AI Spud Residents

## Implementation and scope

Public rooms start with Jax (comedian), Blitz (competitive gamer), Mochi (shy), Zippy (energetic) and Sprout. Quiet rooms have 5–10 residents based on room size. As human attendance grows, residents retire one at a time at 20-second intervals; quiet rooms repopulate gradually. Persisted friendships remain available for invitations even when a resident retires from the public room. Nameplates use ordinary names. A small, readable AI resident badge appears beside the name in avatar preview/chat and friendship panels before interaction; it is not repeated in each bubble. All use existing Spud Shop layers; no new player accounts, inventory, currency or presence records are created. The prominent room label is “Spuds here”: real occupants plus AI residents. Unvisited public rooms say “Resident hangout” rather than implying a measured population. The underlying human occupancy/capacity still comes exclusively from authenticated room members; AI does not increase real-player or friend-online counts.

Residents independently choose short walks, seating, dancing and furniture admiration. Path searches are staggered to one planning actor per room tick with bounded A*. They reserve seats, respect live player/pet occupancy and grid revisions, and never target or chase a player. AI snapshots and greetings require the new client capability, so older installed clients do not render Spuds as ordinary host NPCs. Furniture placement previews include resident occupancy. Walking uses the existing cached avatar renderer with 700ms interpolation; dancing respects Reduce Motion. Small/disconnected rooms admit only residents with safe reachable floor.

Natural mode waits 30–90 seconds after first encountering a player. A greeting requires proximity and a short reachable route. Limits: one greeting per player per three minutes across rooms, one per room per 30 seconds, and 10–15 minutes per resident/player. Greetings and chat replies are private to that player. Quiet suppresses proactive greetings, clears existing AI bubbles, and leaves manual nearby chat available.

**Dialogue is contextual, personality-specific preset dialogue, not a connected generative language model.** The UI states this. There is no free-text AI input or external inference call. Structured memories personalize replies and greetings; this foundation does not promise open-ended conversational recall. Memory is bounded to six selected topics, one explicit favorite game, eight room IDs, five server-verified score snapshots and a session count per resident.

## Privacy and persistence

Memory starts off. Explicit AI friendship can be saved independently of memory consent. Turning memory off erases saved facts while preserving friendships. Players can inspect all saved facts and forget one resident or all. Account deletion cascades to both private tables. No transcripts, human friends' data, chat messages or other players' scores enter resident memory. AI memory stays out of room broadcasts, presence counts, human messages and telemetry.

`world_residents` is a service-only SECURITY INVOKER RPC. Tables live in the private `earnly_world` schema, have RLS enabled and deny client grants. The authenticated server adapter binds actor and current room; supplied user IDs cannot select someone else's records. All account and room checks are repeated. No browser service credentials.

Invitations require an existing AI friendship and the host's current owned room. One AI visitor can join at a time, with independent exploration and contextual furniture replies. The owner can dismiss it immediately. It leaves on host disconnect/room change or after ten minutes of active simulation. Invitations never follow players or grant access to another player's room. Visiting AI still does not affect human occupancy.

## Review and rollout

The implementation is split into stacked PRs: simulation, Natural social mode, private memory, then invited visits and end-to-end QA. No Apple upload or App Store submission is included. Normal simulator compile checks may run.

Apply `20261029131420_world_ai_resident_memory.sql` through the usual database release workflow before enabling persistence. Then deploy the reviewed World server and matching root/www client. Until the RPC is available, the server keeps World and basic residents working and hides memory/friendship/visit controls. An unavailable memory service must not be reported as successful persistence. No production migration has been applied by these PRs.

Required checks remain enabled: world engine, native simulator build, simulation/contracts, desktop Chromium and all three mobile WebKit shards. `scripts/test-world-residents.mjs` adds database isolation/consent/erasure/restart/privilege and visit-ownership checks. `tests/world-ai-residents.spec.js` exercises private chat, Quiet, human-only counts, friendship, consent and room invitations in both browser projects.
