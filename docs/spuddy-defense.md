# Spuddy Defense

Original mobile-first tower defense for Earnly Arcade. Release requires explicit owner approval; this branch must not be merged, deployed to the production backend, or submitted to Apple automatically.

## Included

- Eight towers, six upgrades per tower (two paths, maximum 3/2 crosspath), four targeting priorities, 70% sell refunds, previews and explicit placement confirmation.
- Fourteen enemy types including splitting, stealth, regenerating, armored and shielded Glooplings; two three-stage bosses.
- Five maps with different paths and build obstructions. Easy 40, Normal 60, Hard 100, scalable Endless. Ten encounter patterns per act, staged enemy introductions.
- Fixed 30 Hz deterministic engine shared by browser and server, bounded enemy/tower/effect counts, 1×/2× simulation, automatic waves, pause, zoom/pan and responsive portrait/landscape controls.
- Device saves, XP, map/mode unlocks, tower mastery, achievements, daily and weekly UTC challenges, personal and boss records.
- Original generated cover, original Canvas scenery/characters/weapon animation, synthesized original sound cues.
- Isolated authenticated server replay, cloud saves/progression, map/mode leaderboards and Arcade Coin rewards through the existing ledger. Match money never spends Arcade Coins.

## Security and release boundaries

The production migration and Edge Function are prepared, not deployed. Until deployed after approval, the game remains playable with device saves and honestly reports unavailable cloud verification. The practice export explicitly disables account and wallet calls.

Every ranked action is replayed on the server. Client snapshots, money, waves, XP and reward amounts are ignored. Server-owned snapshots use ordered compare-and-swap checkpoints with idempotent receipts. Runs are scoped to authenticated users; starting a new ranked run closes the previous one. All new tables have RLS enabled and browser permissions revoked. Only the service role can execute privileged RPCs. Existing payment/subscription and other game rules are untouched.

Rewards: 5 Arcade Coins per 10 completed waves, plus 5 for victory; maximum 50 per run and 60 per account per UTC day. Coins use `apply_coin_ledger_event`, with account wallet locking and unique event IDs. Progression and gameplay continue at the cap. Challenge runs do not enter ordinary map/mode rankings.

Cross-device cloud resume starts from the last acknowledged server checkpoint. Local pending batches survive reloads; offline/practice progress is not trusted for coins or global rankings. The verifier supports 2× speed but rejects runs exceeding elapsed wall time. Future multiplayer should run separate engine instances and submit ordered commands; no multiplayer UI or networking is shipped.

## Validation

Run from the repository root:

```sh
node --test scripts/test-spuddy-defense.cjs scripts/test-spuddy-defense-online.cjs
node scripts/test-spuddy-defense-rewards.mjs
node --experimental-strip-types --test scripts/test-spuddy-defense-handler.ts
npx playwright test tests/spuddy-defense.spec.js
node scripts/build-spuddy-defense-preview.mjs
```

The game workflow runs simulation, SQL, API, client retry and Chromium/mobile WebKit tests. Existing Earnly QA and unsigned native iOS compilation also run on the PR. The practice HTML is packaged as a workflow artifact. Before release, inspect all checks on the exact PR head, deploy only the reviewed new backend assets after approval, verify live authenticated rewards/cloud saves and leaderboard isolation, then verify the Pages publish and actual-site checks. Passing a local simulation does not certify human balance or native device performance.

## Artwork provenance

The cover was generated with the built-in image tool for this project. Prompt: original colorful mobile tower-defense illustration, potato defender with teal helmet and seed sprayer, orange cannon, icy fan and purple electric coil, winding meadow path, expressive jelly Glooplings and crowned purple jelly boss; polished rounded 3D-toon style; no Ninja Kiwi assets. Runtime maps, towers and enemies are original code-drawn vector art, and audio is synthesized.

## Remaining before release

- Complete and inspect browser/mobile/native CI on the final commit.
- Conduct a real-iPhone human playtest to tune pacing, small-screen placement and late-game challenge.
- Obtain owner approval, then apply the isolated migration and deploy the new function; verify a real signed-in cloud save and coin receipt.
- Merge/publish only after the approved release checks pass. Multiplayer remains future work.
