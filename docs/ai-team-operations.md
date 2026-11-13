# Earnly inspection and review loop

Owner authorization: November 11, 2026. Scope is this repository only. ChatGPT's existing Earnly QA automation owns recurring four-hour execution; this change does not add a second scheduler or paid runner.

## Every run

1. Read `AGENTS.md`, current main SHA, open issues/PRs, exact-head required checks and deployment status. The existing Bounce Run release task owns #466; do not take over other workflows' branches.
2. Inspect public Home, Games, World, Missions, Rewards, Profile, leaderboards, shop, settings, guides, support and About. Use a fresh guest context. Run `node scripts/inspect-public-site.cjs` after `npm ci` and `npx playwright install chromium webkit` on a supported host. Its desktop Chromium and phone-sized WebKit screenshots/report are in `inspection-results/`. Local preview: `INSPECT_BASE_URL=http://127.0.0.1:4173` with the normal static server. Set distinct `INSPECT_OUTPUT` paths for before and after.
3. Review screenshots manually for overlap/clipping and confusing layout; automated width/image/error signals are triage, not proof. Use existing focused game tests for interaction, pause/resume, controls and save behavior on local fixtures. Never use production accounts to generate synthetic scores or reward claims. Never click purchases, ads, claim buttons or submit public chat during inspection.
4. Record verified problems with URL, viewport/browser, steps, expected/actual behavior, source SHA and evidence. Prioritize broken navigation/gameplay and data integrity ahead of polish. Record blocked checks as blocked, not passed or production outages.
5. Keep one `ai-team/` work branch per issue. Before editing, compare the file set against all active PRs; defer overlapping work. Preserve root/`www` parity. Do not touch payment, advertising, subscription, authentication or privacy systems, migrations or existing player data. Do not add spending.
6. Developer fixes a bounded problem and supplies test evidence. A separate reviewer agent inspects the exact final diff, repeats reproduction and compares before/after screenshots. Send specific feedback to developer; repeat up to two focused repairs per run, then record remaining blockers for the next cycle. Never weaken a failing assertion to obtain green.
7. Run relevant tests and all repository required checks on the exact current PR head. Open/update a draft PR with findings, validation, reviewer verdict and remaining limitations. Keep a dated status entry in the PR body so each scheduled run can recover state without local files.
8. Stop at review readiness. No autonomous merge or publication under this operating procedure. Ask Justin for approval of the concrete final result. After separately approved release, require successful exact-main QA, non-skipped Pages publish/verify and production verification before saying live.

## Initial inspection — November 11, 2026

- Main inspected: `3537572996294a613c197c2ce2e75201c1c62b2a`; Bounce Run #466 has merged and its postmerge checks were still active. Existing open PRs retain their own owners.
- Live homepage returned HTTP 200. Cloud-browser desktop screenshots showed Home and Games rendered; More picks changed the featured pair. Games displayed four fresh picks and 28-game discovery.
- Verified navigation issue: Games' “View today's daily missions” shortcut navigates to `index.html#dailyMissionsSection`. The outer progress disclosure opens but the target Daily Challenges disclosure remains collapsed. `revealHomeTarget` starts with the target's parent, so it never opens the target itself. The focused change starts at the target and preserves ancestor expansion. Both root and packaged mirror are updated.
- Local relative-link source scan found no missing file targets among top-level HTML pages. This is not server or interaction coverage.
- Local Chromium/WebKit execution is blocked: no installed browser binaries and official browser downloads returned truncated archives. Cloud-browser desktop inspection is real; iPhone screenshots and patched browser regression remain pending. Do not claim mobile verification or a live fix until those run successfully.

## Next priorities

1. Verify the deep-link repair in desktop and mobile WebKit; inspect its final screenshots before release approval.
2. Complete the public-page screenshot matrix using the inspector on a browser-capable runtime; review console errors and navigation without production writes.
3. Review duplicated short/long game descriptions visible on Games as a polish candidate after current discovery work is settled.
4. Inspect game start, pause/resume, quit and saved-progress behavior using existing tests and isolated local fixtures, avoiding active game PRs.
