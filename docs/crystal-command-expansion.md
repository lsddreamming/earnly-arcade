# Crystal Command expansion

## User direction, October 8, 2026

Preserve the human army's existing buildings, art and gameplay. Add two original species with unique buildings and army identities. Equal overall opportunity matters more than identical statistics. Extend the game toward public lobbies, cooperative/team battles, rankings and editable maps. Do not represent unimplemented features as available.

## Implemented in the faction branch

- Humans: existing production, prices, troop stats and models.
- Veyra Brood: original biological models and names; living growth zones; all recruitment at Roothearts after dedicated structures unlock troops. Three concurrent incubation slots; one brood charge replenishes every four seconds, maximum three stored. Queue reserves payment and troop capacity. Multiple Roothearts increase production capacity.
- Auralith: original crystalline models and names; a connected power field enables production, research and defenses. Resonators and Heartstones provide power and operate independently. Losing one connection does not disable structures covered by another.
- Organic fighters: 90% normal health, 112% movement speed, 0.5 HP/s recovery after eight seconds out of combat. Fire vulnerability +15%; ion resistance 10%.
- Crystal fighters: 93% normal total durability, 108% attack damage, 88% movement speed; 25% of durability allocated to shields. Shields regenerate over ten seconds after eight seconds out of combat. Acid deals 30% additional shield damage, with correct remaining damage spilling into health.
- Workers retain the same mining stats, price and opening count. Building prices, unit prices, supply and initial resources match. Starting workers are mirrored for equal initial mining travel.
- Race selection for local opponents and each participant in friend rooms. Protocol version 7; the room race locks while connecting. The tutorial remains human and non-aggressive.
- Fog-safe placement checks and field overlays, distinct unit/building silhouettes, shield bars, brood and power status, readable mobile recruitment cards, faction help.
- AI uses the same resource costs, unlock rules and faction production pathways.

These are starting balance values, not a claim of perfect balance. The deterministic combat probe runs 18 equal-cost engagements: infantry, mixed ground, air, all three pairings and both starting sides. It is a regression aid, not a ranked win-rate estimate. It does not model player skill, kiting, expansion pressure or the full map economy.

## Remaining requested work (not implemented or released by this branch)

1. **Online lobby service.** Public/private room browsing, explicit ready controls, race/map selection, player and bot slots, team settings, lobby ownership transfer and reconnect handling. Current friend matches remain two-player private rooms. Do not expose a public browser until database policies, capacity and cleanup are tested.
2. **Team engine.** Replace binary `side`/`1-side` assumptions throughout simulation, fog, networking and victory with player IDs and alliance/team IDs. Start with 2v2 and cooperative players-versus-bots; load-test larger lobbies before enabling up to eight players. Keep per-player resources and private queues isolated.
3. **Trusted competitive results.** Current friend simulation runs on a player's device and is unsuitable as authoritative ranked evidence. Introduce server validation/simulation, match IDs, replayable command logs, abandonment rules and idempotent result submission before persistent win/loss profiles and skill matchmaking. No Coins or ranked credit for current beta results.
4. **Economy and technology depth.** Add an original secondary resource and dedicated extraction structures per race, distinct advanced tech branches and tiers, and additional upgrades. Price from measured acquisition time and combat counters. Preserve a beginner-friendly single-resource lesson.
5. **Tactical abilities.** Human structure relocation and repair, faction-specific transports, detection versus stealth, and energy-limited area/support abilities. Specify cooldown, cost, targeting visibility, mobile control and counterplay for each before adding it.
6. **Map workshop.** Versioned map format, terrain/mineral/start-position editor, save/import/export, bounded trigger and objective definitions. Validate dimensions, reachability, spawn fairness and script-free data; carry the exact validated map hash in multiplayer. Begin with standard battle and survival-defense objectives, then custom scenarios.
7. **Learning and balance.** Faction-specific lessons, build-tree reference, army composition tips, saved replays and match summaries. Gather matchup outcomes by skill bracket, map and game version before enabling ranked play.

## Research references

Mechanics were checked against Blizzard's official material, with original names, code and art for Crystal Command:

- https://classic.battle.net/scc/protoss/bstrat.shtml — power fields and shields.
- https://classic.battle.net/scc/zerg/units/zergling.shtml — central larva-based recruitment and air counters.
- https://classic.battle.net/scc/zerg/units/hydralisk.shtml — regeneration and scouting/combat context.
- https://classic.battle.net/scc/terran/bbuild.shtml — military production roles.
- https://news.blizzard.com/en-us/article/5740264/game-guide-zerg-basics — production model explanation (StarCraft II, not evidence for original-game details).
- https://tw.shop.battle.net/en-us/product/starcraft-remastered — custom games and competitive ladder.

Balance is an ongoing process; neither this research nor a small simulation sample establishes "perfect" balance. The referenced video was blocked by a YouTube verification page and was not reviewed.
