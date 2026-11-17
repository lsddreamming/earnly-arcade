# Metal Mayhem — review candidate

One mode: Endless Arena. Original procedural 3D artwork, a local Three.js bundle,
six robot archetypes, a boss every fifth wave, swept blade/segment collisions,
severable limbs, armor breakage, crawling, parries, projectiles, nine upgrades,
device personal records, and responsive desktop/touch controls.

## Run and inspect

- `npm ci`
- `npm run build:metal-mayhem`
- Serve the repository using the project's existing preview server; open
  `metal-mayhem.html`. `?qa=1` exposes diagnostics for tests, never trusted rewards.
- `npm run test:metal-mayhem`
- `node scripts/test-metal-mayhem-rewards.mjs`
- `node --experimental-strip-types --test scripts/test-metal-mayhem-handler.ts`
- `METAL_MAYHEM_CHROMIUM_3D=1 npx playwright test tests/metal-mayhem.spec.js tests/metal-mayhem-catalog.spec.js --project=desktop-chromium`
- Run the same browser tests with `--project=mobile-webkit` on the existing Linux software-rendered WebKit CI environment.
- `node scripts/build-metal-mayhem-preview.mjs` exports a practice-only folder
  with no authentication SDK. Serve its `index.html` to play.

The cloud review browser in the development session reports its WebGL context
disabled. That environment cannot establish visual quality or iPhone frame rate.
Desktop Chromium rendered screenshots have been inspected. The initial Intel Mac
WebKit runner also lost its graphics context before constructing the scene. The
dedicated workflow uses the same software-rendered Linux WebKit setup as Earnly's
Spuddy Evolution checks; it does not replace physical-iPhone acceptance.

## Reward release is deliberately disabled

The browser records quantized inputs, never claims a score or wallet amount.
The proposed Edge Function replays each input with the exact shared simulation.
Postgres locks the wallet and run, enforces ownership, sequence compare-and-swap,
receipt idempotency, elapsed time, one active run, account daily cap and bans.
Client roles cannot read snapshots or call the award functions.

The migration and function are **not deployed**. Even after deployment the
function returns `PREVIEW_ONLY` unless `METAL_MAYHEM_ENABLED=1` is explicitly set.
Until separately approved, all play is practice with device records; no coins or
global scores are represented as confirmed.

Proposed pacing follows the existing conservative Big Fish ceiling: at most 100
coins per account per UTC day for this game. Each five coins requires all of 90
active seconds, 10 kills and three completed waves. No paid items, wallet schema
changes, generic browser minting, or edits to other games' reward rules.

## Release gates

1. Exact PR-head Metal Mayhem desktop/mobile tests, all five Earnly automated
   jobs, and native simulator compile pass. Inspect real rendered screenshots.
2. Play on a physical iPhone Safari and WKWebView: simultaneous movement, camera
   and strike; small/landscape layouts; audio after interruptions; crowded waves;
   safe areas; renderer recovery; a complete five-wave boss run.
3. Owner approval to merge and publish. Backend migration/function activation
   also needs approval, followed by signed-in staging verification of wallet
   credit, retry idempotency, account switching and global records.
4. Verify exact merged SHA publication and production assets. Apple upload or
   App Store submission remains a separate approval.

## Deliberate limits

- Requires WebGL 2. Unsupported devices get a recoverable message and Games link.
- Stylized segment severing, not arbitrary voxel mesh cutting or full rigid-body
  ragdolls. Severed pieces are bounded, lightweight ballistic debris.
- Four navigation pylons and one arena; no campaign/multiplayer.
- Device records survive reload, but an active run does not resume after closing
  the page. Pause protects the running session. Restart begins a fresh build.
- Mobile draw resolution, shadows, enemy count (12 active), projectiles (36),
  debris (100), and sparks (180) are bounded. Auto performance mode disables
  shadows and lowers pixel ratio after sustained slow frames.
- No claim of measured physical-iPhone frame rate or native-app playtesting.

Three.js MIT and Barlow Condensed OFL notices ship beside the game. All robot,
arena, card illustration, animation and sound designs are generated in project
code; no Clone Drone artwork, names, levels or audio is used.
