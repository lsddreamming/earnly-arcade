# Spuddy Evolution — 3D playtest

The current revision uses real WebGL 2 rendering via a pinned, locally bundled Three.js 0.170.0. Original procedural 3D models have articulated roots, leaves, eyes, armor and evolution crowns. The orthographic camera rotates in 90-degree increments; screen-relative controls rotate with it. Directional lighting, dynamic shadows, fog, instanced tiled floors, laboratory pods, botanical props, transparent gates, particles and world-space boss warnings give the scene depth. There are no remote model, texture, font or CDN dependencies. The Three.js MIT license is included.

## Expanded game
Five connected habitats: Sprout Sanctuary, Prism Laboratory, Frost Reactor, Ember Foundry, and Bloom Heart. Six paid-in-seeds upgrades; free permanent perks every 90 XP (20 choices maximum); a helper companion; banking/healing outposts in unlocked habitats; five bosses including a rectangular foundry strike and a larger faster final strike. Pods and workbenches have physical collision. Body armor and a crystal crown appear with evolution. Old three-habitat saves retain balances, upgrades and defeated bosses and gain the two new chapters.

## Research
- https://www.crazylabs.com/case-study/hyper-casual-meets-midcore-alien-invasions-journey-to-hybrid-casual-stardom/
- https://crazylabs.freshdesk.com/support/solutions/articles/201000065794-which-alien-upgrades-should-i-prioritize-to-advance-faster-
- https://crazylabs.freshdesk.com/support/solutions/articles/201000067368-the-humans
- https://www.crazylabs.com/case-study/inside-a-transformative-quarter-on-alien-invasion-what-worked-and-why/

Original Earnly creatures and environments interpret the explore/capture/bank/upgrade structure. This is not an asset copy or a claim of matching Alien Invasion's full content catalog.

## Build and QA
`npm ci && npm run build:spuddy-evolution` reproduces spuddy-evolution-3d.js. Keep the bundle and game assets identical under www. Node engine tests exercise progression, old saves, free perks, wall blocking, full campaign completion and 100 seeded expeditions. Dedicated browser tests require an actual WebGL renderer, check movement/banking, rotation, perks, pause and phone controls, and capture graphics. The cloud interactive browser disables WebGL, so graphics review uses CI screenshots. CI software rendering is not a substitute for physical iPhone performance testing.

## Playtest limits
Device-local saves only. No production catalog changes, Arcade Coins, ads, purchases, subscriptions or cloud-save claims. Free uninterrupted play. Deleting site storage removes progress. WebGL-unavailable browsers show an explicit explanation; context loss pauses play until restored. Human pacing and physical-device performance feedback remain important before public release.

## Hundredfold Bloom campaign
100 expeditions reuse the five connected habitats. Expedition 1 retains the original onboarding pace; subsequent expeditions require all five guardians, `40 + chapter × 8` captures and `200 + chapter × 60` banked seeds. Four rotating conditions alter grazer armor, spore speed, boss recovery or nest healing. Enemy health rises by 7.5% of base per expedition and damage by 1.8%; seed payouts rise by 2.5%. These are initial tuning values, not a measured claim of months/year completion time.

Advancing is explicit in Evolve → Journey. It preserves banked seeds, normal upgrades, perks, research and journal, while refreshing bosses, gates, expedition counters and carried pouch. Three research tracks have 30 ranks each; boss victories and species milestones pay crystals. The journal tracks four species and a boss in each of five habitats, with milestone rewards at 1/10/50/200 for creatures and 1/10/50/100 for bosses. There are 100 progression stages, not 100 unique maps. Future authored encounters and player pacing feedback remain necessary to establish long-term retention.

Old saves migrate without resetting progression. Journey includes JSON backup export and validated import with a separate replace-progress action; saves remain local to the device. There are no calendar locks, paid skips or missed-day penalties.

## Rescue crew and couriers
Five stranded friends (one per habitat) require two uninterrupted seconds nearby with no living enemy within 2.5m. Rescue progress pauses with the game and resets when leaving danger-free proximity. Rescues are permanent, grant three crystals once, and cumulatively build a garden, workshop, storage, healing spring and sky dock at home. Garden income accrues only during active play and does not satisfy expedition banking objectives. Rescued outposts offer travel only from a safe nest to an already unlocked habitat.

Rescuing Pip enables Courier wings (five ranks, seed purchases). A visible flying companion collects bounded cargo and delivers it to the main nest; cargo in transit is included in backups, paid once on return, and settled before advancing an expedition. It freezes while paused and does not simulate offline income. Four More roots ranks add independent simultaneous targets, preserving existing power-based target bonuses. Up to ten root links render.

Later spawn slots have a 12% rare-variant chance. Gold crests mark variants with 1.8× resistance, 3× seed value, faster attack recovery and two research crystals per capture. Rare grazers have larger marked attacks. The Journey screen records total rare captures and rescue benefits.
