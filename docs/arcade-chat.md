# Arcade Chat

One text-only room for confirmed Earnly accounts. Public usernames and existing equipped potato layers come from the server; clients cannot choose a sender identity. No DMs, uploads, link previews, or rendered HTML. The launcher is on browsing/account pages only, never on game pages.

## API and limits

`public.arcade_chat(p_action, p_data)` is an invoker wrapper around a private, fixed-search-path function. Private tables have RLS enabled and no client table privileges. Every operation revalidates the account and chat suspension. Actions: `feed`, `accept`, `send`, `mute`, `block`, `unblock`, `report`, `delete`. Chat changes never touch Coins, wallets, scores, or game results.

Sending requires rules acceptance and a profile username; 1–280 characters; one send per five seconds; at most 30 messages in ten minutes; repeated text blocked for two minutes. A member-row lock serializes sends across devices. Requests have caller-scoped UUID idempotency keys so an uncertain delivery can be retried safely. Basic link/email/profanity filters supplement human moderation; they are not exhaustive content classifiers.

Feed returns at most 60 messages from the last seven days. Server filtering applies blocks in both directions, the caller's reports, hidden messages, and suspensions. Only minimal public profile/loadout fields are returned; no email or save data. Block and report state is private. Own-message deletion hides a message globally; account deletion cascades all associated chat data.

Visible chat polls every eight seconds; closed, unmuted chat polls every 45 seconds. Hidden tabs stop polling. Muted closed chat stops polling. Unread markers are local to the signed-in user/device; mute and blocks sync through the account. No paid realtime infrastructure is required, though database traffic still uses project quotas.

## Moderation operations

Reports require human review. There is no unattended AI moderator or promised automatic report monitoring. Support contact is linked in the room. Using the owner-access Supabase SQL editor or service-role RPC, review:

```sql
select public.arcade_chat_moderate('queue');
-- Use an actual message_id from the queue:
select public.arcade_chat_moderate('remove', '<message UUID>');
select public.arcade_chat_moderate('resolve', '<message UUID>');
-- Use an actual user_id from the queue. Suspension lasts 30 days:
select public.arcade_chat_moderate('suspend', '<user UUID>');
select public.arcade_chat_moderate('restore', '<user UUID>');
-- Maintenance removes messages older than 30 days except unresolved reports:
select public.arcade_chat_moderate('prune');
```

Never put a service-role credential in browser code. Ordinary accounts cannot call either the administrative wrapper or private administrative function. Moderator actions do not affect game access or player balances.

## Release and verification

Apply `20261008213912_arcade_global_chat.sql` after reviewing the migration and local SQL tests, before merging the frontend. Verify anonymous RPC denial, table privileges and moderator privileges on production; never post fake public test messages. Run `node scripts/test-arcade-chat.mjs` and `npx playwright test tests/arcade-chat.spec.js`. CI includes both and requires all existing desktop/iPhone gates. Preserve native-specific page content when mirroring chat additions.

The migration does not grant any player moderator access. The owner moderates through the existing authenticated Supabase project access; a dedicated in-app moderator console can be added separately.
