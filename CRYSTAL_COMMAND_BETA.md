# Crystal Command beta

Earnly's first real-time strategy game has automatic crystal mining, construction, production queues, supply relays, timed weapons and armor research, rally points, scouting under fog of war, attack-move, three combat robot types, turrets, expansions, and a dangerous double-yield central crystal field. Practice offers Easy (smaller waves after three minutes), Normal (the original pressure), and Hard (earlier rushes). All use the same player resources and unit stats. Battles end when all command bases are destroyed or at twenty minutes. Each starting crystal line has six 2,400-crystal patches (14,400 total), with two mirrored expansion lines per side. Miners distribute across fields and one Miner extracts from a patch at a time. Resource quantities outside current vision retain their last observed value.

## Friend battles

Signed-in players create or join an eight-character room code. Invite links prefill the code. Only the two room members can receive private Broadcast messages; each can send only on their own side's channel. The host validates both players' commands and simulates at 20 Hz. Engine version 4 requires both players to refresh; mismatched-version heartbeats display a refresh message and do not start the battle. Guest snapshots are projected through the guest's vision so hidden enemy units and enemy resources are not sent. Commands have sequence checks and a 12-order/second cap. Snapshots run at roughly 4.5 Hz. Expired and closed rooms cannot be joined; a third member cannot claim an occupied room.

This is a casual, host-authoritative beta, with no Coins, wallet debits, ranked scores, or leaderboard submission. The host is trusted: a modified host client can cheat. Ranked play needs an independent authoritative simulation server before rewards can be enabled.

## Connections

Both participants subscribe before starting. Heartbeats pause the battle when either participant backgrounds the app or disconnects. A guest can reload and rejoin the same room to receive a current snapshot. A lost connection ends as a draw after 60 seconds. Full host reload does not restore an active simulation; create another room. Use Leave room to close waiting rooms. Rooms expire after 30 minutes. Online battles have no individual pause button; practice does.

## Controls

Tap your base or factory to select its training palette. Tap Army or Miners to select groups. Tap ground to attack-move, or choose Move only. Tap a visible enemy to focus fire; a target leaving vision is pursued only to its last observed position. Army opens compact controls for Select + (tap fighters to add/remove), Stop, Save 1/2, and Squad 1/2. Saved squads recall surviving units and reset between battles. Drag to pan; tap the minimap to jump. Build selects a blueprint, then tap visible, clear ground within eight tiles of a Miner. Base returns the camera and selection to a command base. Select Rally at a base or factory and tap a destination; new Miners can rally directly to a crystal field. Select a Tech core to research Weapons or Armor through three levels, with costs and timers; destroying the researching core cancels that project. Tap a crystal patch to inspect its reserve. Compact alerts locate base/worker attacks, visible approaching enemies, full supply and idle factories. They use game-time cooldowns and do not expose hidden enemies. Keyboard: 1/2 recall squads (Shift saves), R sets a rally point, A selects army, H returns home, B opens build, Space pauses practice, Escape cancels placement or asks to quit.

## Backend and validation

Migrations `supabase/migrations/20261005220225_crystal_command_friend_rooms.sql` and `supabase/migrations/20261005220843_crystal_command_nonanonymous_rooms.sql` create isolated rooms, member-only RLS, private security-definer room operations with auth checks, a public invoker wrapper, and side-specific Realtime policies. It leaves existing economy tables unchanged.

Run `npx playwright test tests/crystal-command.spec.js` for deterministic simulation and browser controls on Chromium and iPhone WebKit. Local validation: 16 Crystal Command checks across Chromium and iPhone WebKit, 16 existing catalog/source-contract checks, and 34 mobile-density checks passed. Live integration uses separate signed-in accounts to check room creation, joining, shared commands, guest reconnect, surrender, a third-account rejection, and outsider row isolation. The outsider private-channel subscription timed out rather than returning a definitive authorization error; do not treat that timeout as an affirmative channel-denial test. Side-specific policies were inspected and no new security-advisor findings were reported for the beta schema. Beta access is separate from the arcade catalog and its score/plays contracts.

### Living battlefield graphics

Miners use moving drill arms and glowing cargo, Strikers walk with aimed weapons, and Siege bots have rolling tracks. Factories open their doors near production completion and briefly after spawning. Construction shows scaffolding before the finished structure. Damaged visible units and buildings smoke. Projectiles, impact sparks, explosions and temporary wreckage use game time, so pause freezes effects. Reduced motion removes travel, flying debris and smoke. Terrain includes cracks, inset metal panels and subtle crystal light; detailed production and research labels appear only on selected buildings. A bounded, fog-filtered visual event buffer preserves brief effects between friend snapshots without changing combat or resource balance. Glow work is capped per frame for crowded phone scenes.

### Box selection and radar orders

Press Box and drag a yellow rectangle to select troops, double-tap then drag on phones, or left-drag with a mouse. Normal phone drags and right/middle mouse drags pan the battlefield. Shift or Select + adds boxed units to the current group. Selection boxes include owned living fighters; if no fighters are enclosed, they select Miners. Buildings and enemies are excluded. Empty boxes clear the selection, and cancellation, pause or leaving a battle discards pending gestures.

Tap the radar to issue Attack-move or Move only to selected units, including unexplored destinations. Drag the radar to move the camera without issuing orders. A radar tap with no troops selected moves the camera; right/middle/Alt taps also look around. Radar taps in Rally mode set the production rally destination. Orders for large groups are sent in validated chunks of up to 80 unit IDs.

### Faceted battlefield art
Crystal clusters now use distinct lit and shaded faces. Buildings have beveled platforms, roof seams, vents and small running lights; terrain adds stable grates, cracks and inset panels, and rocks use angular boulder faces. Unit armor and siege hulls have extra edge details. Contact shadows and restrained muzzle flashes improve depth and combat readability. These are canvas art changes only; game balance, fog, selection geometry, networking and rewards are unchanged.

### Drag construction
Drag any enabled building blueprint from the Build palette onto the field, or select it and drag its ghost on the map. Green outlines show a valid site; red outlines explain blocked ground, missing vision, no nearby Miner, insufficient crystals, or the building limit. Releasing a valid preview starts construction once; invalid/outside/canceled drops spend nothing. Cancel exits placement. Normal click-to-place remains available. The preview and authoritative command share validation; previews use only the player's fog-filtered view and the host checks the complete state again. Scaffolds now show lit corners, cross braces and a construction progress edge.


## Expanded forces and air combat

Six additional troop types: Raider (fast ground assault), Field medic (8 HP automatic ground healing each second), Skyguard (ground walker with strong anti-air missiles), Interceptor (fast air superiority, weaker ground lasers), Bomber (ground-only splash), and Storm cruiser (durable, costly dual-target aircraft). Assault bays train Raiders/medics; factories add Skyguards; Star hangars train all aircraft. A completed factory unlocks Star hangars and Arsenals. An Arsenal unlocks Skyguards/Bombers; a Tech core plus Arsenal unlocks Storm cruisers. Sky shields provide air-only static defense without a tech prerequisite, so air has an accessible counter. Existing Strikers and Sentries can shoot both layers; Scouts and Siege bots attack ground only. Ground splash and crystal surges do not damage aircraft.

Air units move directly over terrain, remain fog-filtered, and have elevated silhouettes, ground shadows, thrusters, raised selection/hit positions and radar triangles. Box selection, Army, squads, minimap orders, focus fire, production queues, supply limits, research and online host validation apply to the expanded roster. Medics heal living ground units, never buildings/air, and Move only prioritizes travel. All production buildings support Rally; air rallies can cross rocks. Core buildings and Troops & air categories keep the phone Build palette compact; cards explain roles and missing prerequisites. Practice AI builds an air branch after its difficulty-specific tech window and trains counter units while respecting its army cap. Engine version 4 prevents older clients from joining incompatible matches; both players must refresh.

Reference: Blizzard's original StarCraft guide (classic.battle.net/scc/terran/uw.shtml and /ub.shtml) informed asymmetric air/ground damage, anti-air counters and production prerequisites. Crystal Command uses its own names, art, economy and tuning.

## Guided first battle

Learn to play is the primary entry for someone who has not completed the lesson. Its five steps teach automatic mining, factory placement, three Strikers, supply relays, then Army selection and a radar attack order. A compact instruction strip shows one task, observes actual completion, highlights the relevant control and offers a Show action to reopen the correct palette or locate the factory. Advanced controls and production choices are hidden during the lesson. Pause, cancel placement and confirmed Quit remain available.

The isolated practice scenario has a single harmless rival base, no opponent workers or AI, and no time limit. The target lies beyond the default factory's spawn/weapon range so the player must send their army. It uses ordinary player mining, prices, construction, queues, supply and combat. Completion offers an Easy battle with fresh standard bases and resources, or a replay. A local completion flag changes the recommended menu action but never blocks replay. Ordinary practice and friend matches keep their full controls, AI, map, timing and economy.
