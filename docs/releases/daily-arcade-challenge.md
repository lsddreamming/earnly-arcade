# Daily Arcade Challenge — next release

Keep version 1.11/build 903 and its current Apple review unchanged. This branch is preparation for the following release; do not dispatch an iOS build, withdraw 1.11, or deploy this feature as part of that review.

Home shows three rotating game goals with direct play links, server-recorded best progress and four weekly stamps. Complete all three goals on four different days in a Monday–Sunday UTC week to earn the Arcade All-Star Cup. Skipped days do not erase stamps; each new week starts fresh. Earned cups are permanent, nontradeable room decorations. A full Backpack retains the award for delivery on the next Home status check with capacity, even after the week ends.

The existing missions and XP remain unchanged. No coins, ads, purchases or new currency are required for the trophy. Guests can play, but must sign in before earning stamps. The current implementation uses existing reward-ledger receipts: up to nine eligible runs per game per day; Neon Slice writes receipts for its first three rewarded runs. Rejected, unsynced, practice-only or legacy best-score uploads do not grant progress. Additional mastery progression beyond these limits is a separate feature.

## Release sequence

1. Run the Daily Arcade challenge QA workflow (desktop Chromium and mobile WebKit), the existing automated gates, and an actual iPhone/TestFlight check for the following release.
2. Apply `20261104145627_daily_arcade_challenge.sql` to staging and deploy the updated `activity` function there. Verify signed-in game -> receipt -> Home progress -> trophy -> World Backpack -> placement. Verify an ordinary catalog purchase still works, while direct purchase/trade of the cup is rejected.
3. When ready to release after 1.11, deploy the additive database migration first, then the `activity` edge function, then the web/native assets. Do not publish the Home card before its backend is ready. No World service code change is required: catalog and inventory already return definition fields.
4. For rollback, revert the Home/World client changes and activity action, drop only the `arcade_challenge_result` trigger to stop recording, and retain the progress/award tables and earned inventory. Do not delete players' prizes.

## Verification

- `node scripts/test-daily-arcade.mjs`: executable PostgreSQL tests for daily maxima, duplicates, skipped days, rollover, capacity, idempotency, roles, bans, purchase denial and RLS.
- `node --experimental-strip-types --test scripts/test-activity-handler.ts`: authenticated actor binding and existing owner-report isolation.
- `npx playwright test tests/daily-arcade.spec.js tests/daily-results.spec.js`: guest, signed-in, stale-account response, retry, trophy states, direct links, mobile overflow and existing results/XP behavior. UI fixtures deliberately mock only the challenge service; staging verification above is still required.
- Keep root assets and their `www/` copies identical. Native builds use the existing bundling script.

## Evaluate after launch

Use the existing owner activity reporting for next-day/weekly return trends. The new private tables provide daily challenge completion and trophy delivery counts without collecting chat or personal content. Compare challenge completion and subsequent return among eligible players; keep test accounts excluded and treat small samples cautiously. Do not treat more trophy claims alone as proof of better retention.
