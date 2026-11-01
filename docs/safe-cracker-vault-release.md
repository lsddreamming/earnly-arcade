# Safe Cracker weekly release candidate

This candidate adds labeled Steady/Surge/Pulse timing, optional perfect-center hits, two-pin vault doors every tenth completed door, vault chapters, bounded phone/desktop controls, and clock-based movement that is independent of refresh rate. The round clock starts after the countdown. Three lives and the existing fourth-clean-lock bonus are retained. Existing high scores and account data are not reset.

## Reward pacing

The 100-Coin cap is retained, but fresh claims use 2 Coins per 5 score locks, plus milestones of 2 at 25, 4 at 50, 6 at 75 and 8 at 100. Examples: 10 → 4 Coins; 33 → 14; 50 → 26; 100 → 60; 200 → 100. Perfect pins and vault effects add no currency. Historical claim retries still return their original amount, including older 100-Coin receipts; existing balances are never debited.

## Release boundary

Prepare this for the requested weekly update. Do not publish the changed browser reward preview without activating the matching Safe Cracker reward migration. The candidate migration has been tested locally with real SQL execution, duplicate/replay guards, old-receipt preservation, and browser/server parity across all games. Production has only been read, not changed, during preparation.

At the release cutover, verify the current function still matches the guarded old rule, apply the checked-in `safe_cracker_reward_pacing` migration through the normal migration mechanism, verify the new function body and security attributes, then publish the exact green web commit. Old clients must continue to use authoritative server receipts; do not rewrite older balances or leaderboard records. Check root and www HTML/CSS/engine bytes after publication and play a real run. Coordinate the native release so displayed rewards and authoritative receipts remain understandable on older clients.

No Apple upload or App Store submission is included in this candidate.
