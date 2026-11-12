# BIG FISH ENERGY: first playable

Development branch: `feat/big-fish-energy`. Production catalog stays unchanged pending owner playtest approval.

1. Deterministic, bounded simulation: permanent physical sizes, proportional growth emphasizing near-sized prey, six ocean tiers, endless progression, flock/flee/hunt behavior, boost and safe spawn.
2. Original Canvas 2.5D renderer: shaded animated creatures, layered reefs/water, smooth scaling camera, mobile pixel-density budget.
3. Finger-follow interface: clean menus/HUD, multitouch boost, keyboard support, explicit resume after app switching, local personal best.
4. Secure rewards and global scores: server replay, idempotent settlement and slow milestones; unavailable endpoints fail closed into clearly labeled practice mode. No production backend deployment during playtest.
5. Independent inspection and review: engine invariants, mobile WebKit and desktop interaction tests, economy validation, mirrored native assets; existing CI and iOS compile remain required.
6. Separate hosted playtest, pull request, owner feedback. Only after approval add to bottom of catalog and release.
