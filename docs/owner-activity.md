# Owner activity

`owner.html` is an aggregate dashboard. Its URL is not a security boundary: every report request verifies the bearer with Supabase Auth, checks a private account allowlist, then calls a service-only reporting RPC. No player can grant themselves access through profile names, user metadata, or request actor fields.

Deploy `20261017005656_owner_activity_dashboard.sql` and `20261017010115_owner_activity_auth_columns.sql` first, then the `activity` Edge Function with its own bearer verification, then the checked World server and website. Existing Pages automation remains the publication gate. Add the verified owner's UUID to `earnly_metrics.accounts` through privileged SQL (`owner=true,excluded=true`). Mark known test accounts with `owner=false,excluded=true`. Never resolve authorization from a runtime username. No new permissions are granted to other accounts.

## Definitions

- Accounts: current confirmed, non-anonymous, nondeleted Auth users, grouped by account creation time. Today and last seven calendar days use America/Chicago.
- World players: unique accounts with a server-confirmed admission during the selected calendar period. Room switches and reconnects count as entries. Returning means entry on at least two separate Chicago dates in that period, not retention or all-time returning users.
- Peak: largest room member count observed at a recorded admission, not a continuously sampled concurrency metric. NPCs are excluded; other marked testers in a room can still contribute to its observed occupancy.
- Shop views and purchase attempts: signed-in client reports for coin packs. They are approximate, not proof of purchase. They can be blocked or lost offline. No historical events are inferred.
- Verified purchases: fulfilled, wholly nonrefunded Stripe coin orders plus nonrevoked Production Apple coin transactions. Sandbox receipts and VIP subscriptions are not included. Counts are not revenue.
- Filtering: explicitly marked owner/test accounts are excluded by default. Counts may include unmarked testers. Existing account/purchase records predate the new telemetry; the UI displays new tracking start separately.

Telemetry uses server timestamps, UUID deduplication, and a serialized cap of 120 accepted events/account/hour. Browser payload properties, chat, email, device identifiers and tokens are not stored. Events are restricted to known event kinds; only the World server can record admissions. Intake failure never blocks gameplay or payment. Auth-account deletion cascades its new analytics rows; no gameplay, wallet, or purchase tables are written by reporting.

Verification: `node scripts/test-activity.mjs`, `node --experimental-strip-types --test scripts/test-activity-handler.ts`, `npx playwright test tests/owner.spec.js`, and the existing World engine and commerce suites. Test anonymous/nonowner denial, exclusion filters, duplicate IDs, refunds, returning-day definitions and failure isolation.
