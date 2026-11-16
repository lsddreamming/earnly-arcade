# BIG FISH ENERGY: first playable

Development branch: `feat/big-fish-energy`. Production catalog stays unchanged pending owner playtest approval.

1. Deterministic, bounded simulation: permanent physical sizes, proportional growth emphasizing near-sized prey, six ocean tiers, endless progression, flock/flee/hunt behavior, boost and safe spawn.
2. Original Canvas 2.5D renderer: shaded animated creatures, layered reefs/water, smooth scaling camera, mobile pixel-density budget.
3. Finger-follow interface: clean menus/HUD, multitouch boost, keyboard support, explicit resume after app switching, local personal best.
4. Secure rewards and global scores: server replay, idempotent settlement and slow milestones; unavailable endpoints fail closed into clearly labeled practice mode. No production backend deployment during playtest.
5. Independent inspection and review: engine invariants, mobile WebKit and desktop interaction tests, economy validation, mirrored native assets; existing CI and iOS compile remain required.
6. Separate hosted playtest, pull request, owner feedback. Only after approval add to bottom of catalog and release.

## Approved release polish

Owner played the first preview, reported it was very fun, and authorized polish plus production publication. Release adds visible player evolution, bite feedback, growth rings, hunting and boss warnings, and a pause-menu Finish & save score action. Catalog integration places the game last and includes the original cover in rotating picks. Owner also requested plain Play catalog buttons with no visible Beta or repeated play-count badges.

Backend deployed to Earnly Arcade project zdwziebtbpuolusztede: migration version 20261112001651, function big-fish-energy v1. Verified public leaderboard response 200 and unsigned start/checkpoint 401. Both new tables have RLS, no client read/write grants; RPCs are service-role only. Security advisor no-policy info is intentional for these server-only tables. Exact browser and server engines match.

Original generated cover: game-preview-big-fish-energy.webp. Brief: original golden tropical fish, teal shark, distant bioluminescent sea monster, coral and ocean rays; no text or logos. Built-in image generation, optimized WebP.

Separate practice preview: https://big-fish-energy-playtest.differentreality.chatgpt.site. Export with node scripts/build-big-fish-preview.mjs <directory>; this removes the Supabase SDK and uses public Games return links.
