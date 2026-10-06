# Crystal Command beta

Earnly's first real-time strategy game has automatic crystal mining, construction, production queues, supply relays, weapon upgrades, scouting under fog of war, attack-move, three combat robot types, turrets, expansions, and a dangerous double-yield central crystal field. The practice opponent grows an economy and attacks. Battles end when all command bases are destroyed or at ten minutes.

## Friend battles

Signed-in players create or join an eight-character room code. Invite links prefill the code. Only the two room members can receive private Broadcast messages; each can send only on their own side's channel. The host validates both players' commands and simulates at 20 Hz. Guest snapshots are projected through the guest's vision so hidden enemy units and enemy resources are not sent. Commands have sequence checks and a 12-order/second cap. Snapshots run at roughly 4.5 Hz. Expired and closed rooms cannot be joined; a third member cannot claim an occupied room.

This is a casual, host-authoritative beta, with no Coins, wallet debits, ranked scores, or leaderboard submission. The host is trusted: a modified host client can cheat. Ranked play needs an independent authoritative simulation server before rewards can be enabled.

## Connections

Both participants subscribe before starting. Heartbeats pause the battle when either participant backgrounds the app or disconnects. A guest can reload and rejoin the same room to receive a current snapshot. A lost connection ends as a draw after 60 seconds. Full host reload does not restore an active simulation; create another room. Use Leave room to close waiting rooms. Rooms expire after 30 minutes. Online battles have no individual pause button; practice does.

## Controls

Tap your base or factory to select its training palette. Tap Army or Miners to select groups. Tap ground to attack-move, or choose Move only. Drag to pan; tap the minimap to jump. Build selects a blueprint, then tap visible, clear ground within eight tiles of a Miner. Base returns the camera and selection to a command base. Keyboard: A selects army, H returns home, B opens build, Space pauses practice, Escape cancels placement or asks to quit.

## Backend and validation

Migrations `supabase/migrations/20261005220225_crystal_command_friend_rooms.sql` and `supabase/migrations/20261005220843_crystal_command_nonanonymous_rooms.sql` create isolated rooms, member-only RLS, private security-definer room operations with auth checks, a public invoker wrapper, and side-specific Realtime policies. It leaves existing economy tables unchanged.

Run `npx playwright test tests/crystal-command.spec.js` for deterministic simulation and browser controls on Chromium and iPhone WebKit. Local validation: 16 Crystal Command checks across Chromium and iPhone WebKit, 16 existing catalog/source-contract checks, and 34 mobile-density checks passed. Live integration uses separate signed-in accounts to check room creation, joining, shared commands, guest reconnect, surrender, a third-account rejection, and outsider row isolation. The outsider private-channel subscription timed out rather than returning a definitive authorization error; do not treat that timeout as an affirmative channel-denial test. Side-specific policies were inspected and no new security-advisor findings were reported for the beta schema. Beta access is separate from the arcade catalog and its score/plays contracts.
