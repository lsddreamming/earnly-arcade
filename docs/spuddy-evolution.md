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
