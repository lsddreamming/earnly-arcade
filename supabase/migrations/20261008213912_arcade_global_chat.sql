-- Private storage. Only the authenticated, explicitly checked RPC can access it.
CREATE SCHEMA IF NOT EXISTS earnly_chat;
REVOKE ALL ON SCHEMA earnly_chat FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA earnly_chat TO authenticated, service_role;
CREATE TABLE earnly_chat.members (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 accepted_at timestamptz, muted boolean NOT NULL DEFAULT false,
 last_sent timestamptz, suspended_until timestamptz
);
CREATE TABLE earnly_chat.messages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 request_id uuid NOT NULL, body text NOT NULL CHECK (length(body) BETWEEN 1 AND 280),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), hidden boolean NOT NULL DEFAULT false,
 UNIQUE(user_id,request_id)
);
CREATE INDEX chat_recent ON earnly_chat.messages(created_at DESC,id DESC) WHERE NOT hidden;
CREATE INDEX chat_sender_recent ON earnly_chat.messages(user_id,created_at DESC);
CREATE TABLE earnly_chat.blocks (
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 PRIMARY KEY(user_id,blocked_id), CHECK(user_id<>blocked_id)
);
CREATE INDEX chat_blocks_reverse ON earnly_chat.blocks(blocked_id,user_id);
CREATE TABLE earnly_chat.reports (
 message_id uuid NOT NULL REFERENCES earnly_chat.messages(id) ON DELETE CASCADE,
 reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 reason text NOT NULL CHECK(reason IN ('spam','harassment','unsafe','other')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), resolved_at timestamptz,
 PRIMARY KEY(message_id,reporter_id)
);
CREATE INDEX chat_reports_sender ON earnly_chat.reports(reporter_id,created_at DESC);
CREATE INDEX chat_reports_pending ON earnly_chat.reports(created_at) WHERE resolved_at IS NULL;
ALTER TABLE earnly_chat.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE earnly_chat.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE earnly_chat.blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE earnly_chat.reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA earnly_chat FROM PUBLIC,anon,authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA earnly_chat TO service_role;

CREATE FUNCTION earnly_chat.handle(p_action text,p_data jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 uid uuid:=auth.uid(); member earnly_chat.members%ROWTYPE; msg earnly_chat.messages%ROWTYPE;
 username text; v_body text; rid uuid; target uuid; result jsonb; blocked jsonb;
BEGIN
 -- Recheck the account exists and is confirmed, even with a still-valid deleted-user JWT.
 IF uid IS NULL OR NOT EXISTS(SELECT 1 FROM auth.users u WHERE u.id=uid AND NOT coalesce(u.is_anonymous,false) AND u.email_confirmed_at IS NOT NULL) THEN
  RAISE EXCEPTION 'Sign in with a confirmed account to join chat.';
 END IF;
 IF EXISTS(SELECT 1 FROM public.leaderboard_bans b WHERE b.user_id=uid) THEN RAISE EXCEPTION 'Chat is unavailable for this account.'; END IF;
 IF p_action NOT IN ('feed','accept','send','mute','block','unblock','report','delete') THEN RAISE EXCEPTION 'Unknown chat action.'; END IF;
 -- Serialize writes per account: concurrent sends cannot bypass cooldown or quotas.
 IF p_action<>'feed' THEN
  INSERT INTO earnly_chat.members(user_id) VALUES(uid) ON CONFLICT DO NOTHING;
  SELECT * INTO member FROM earnly_chat.members WHERE user_id=uid FOR UPDATE;
 ELSE
  SELECT * INTO member FROM earnly_chat.members WHERE user_id=uid;
 END IF;
 IF member.suspended_until>clock_timestamp() THEN RAISE EXCEPTION 'Your chat access is temporarily suspended. Contact Support for help.'; END IF;
 SELECT p.username INTO username FROM public.profiles p WHERE p.user_id=uid;
 IF p_action='accept' THEN
  UPDATE earnly_chat.members SET accepted_at=clock_timestamp() WHERE user_id=uid;
 ELSIF p_action='mute' THEN
  UPDATE earnly_chat.members SET muted=coalesce((p_data->>'muted')::boolean,false) WHERE user_id=uid;
 ELSIF p_action IN ('block','unblock') THEN
  target:=(p_data->>'user_id')::uuid;
  IF target IS NULL OR target=uid THEN RAISE EXCEPTION 'Choose another player.'; END IF;
  IF p_action='block' THEN
   IF (SELECT count(*) FROM earnly_chat.blocks WHERE user_id=uid)>=200 THEN RAISE EXCEPTION 'Your block list is full. Manage it in Chat settings.'; END IF;
   INSERT INTO earnly_chat.blocks VALUES(uid,target) ON CONFLICT DO NOTHING;
  ELSE DELETE FROM earnly_chat.blocks WHERE user_id=uid AND blocked_id=target; END IF;
 ELSIF p_action='send' THEN
  IF member.accepted_at IS NULL THEN RAISE EXCEPTION 'Please agree to the chat rules first.'; END IF;
  IF username IS NULL OR username !~ '^[A-Za-z0-9_]{3,18}$' THEN RAISE EXCEPTION 'Choose a username in Profile before chatting.'; END IF;
  rid:=(p_data->>'request_id')::uuid;
  IF rid IS NULL THEN RAISE EXCEPTION 'Message ID is required.'; END IF;
  SELECT * INTO msg FROM earnly_chat.messages WHERE user_id=uid AND request_id=rid;
  IF FOUND THEN RETURN jsonb_build_object('ok',true,'id',msg.id); END IF;
  v_body:=btrim(regexp_replace(coalesce(p_data->>'body',''),'[[:space:]]+',' ','g'));
  IF length(v_body) NOT BETWEEN 1 AND 280 OR octet_length(v_body)>2000 OR v_body ~ '[[:cntrl:]]' OR v_body ~ U&'[\200B-\200F\202A-\202E\2060-\206F\FEFF]' THEN RAISE EXCEPTION 'Use 1–280 readable characters.'; END IF;
  IF v_body ~* '(https?[:/]|www[.]|[a-z0-9-]+[.](com|net|org|io|gg|co|xyz|ru|link|app)(/|\M)|[a-z0-9._%+-]+@[a-z0-9.-]+[.][a-z]{2,})' THEN RAISE EXCEPTION 'Links and email addresses are not allowed in chat.'; END IF;
  -- A basic filter supplements reports and human moderation; it is not exhaustive.
  IF v_body ~* '\m(fuck[a-z]*|shit[a-z]*|bitch[a-z]*|cunt[a-z]*|nigg[a-z]*|fagg[a-z]*|porn[a-z]*)\M' THEN RAISE EXCEPTION 'Please keep chat friendly and appropriate for the arcade.'; END IF;
  IF member.last_sent>clock_timestamp()-interval '5 seconds' THEN RAISE EXCEPTION 'Slow down a little. Wait 5 seconds between messages.'; END IF;
  IF (SELECT count(*) FROM earnly_chat.messages WHERE user_id=uid AND created_at>clock_timestamp()-interval '10 minutes')>=30 THEN RAISE EXCEPTION 'You have sent a lot of messages. Take a short break.'; END IF;
  IF EXISTS(SELECT 1 FROM earnly_chat.messages WHERE user_id=uid AND lower(messages.body)=lower(v_body) AND created_at>clock_timestamp()-interval '2 minutes') THEN RAISE EXCEPTION 'You just sent that message. Try something new.'; END IF;
  INSERT INTO earnly_chat.messages(user_id,request_id,body) VALUES(uid,rid,v_body) RETURNING * INTO msg;
  UPDATE earnly_chat.members SET last_sent=clock_timestamp() WHERE user_id=uid;
  RETURN jsonb_build_object('ok',true,'id',msg.id);
 ELSIF p_action='report' THEN
  SELECT * INTO msg FROM earnly_chat.messages WHERE id=(p_data->>'message_id')::uuid AND NOT hidden AND created_at>clock_timestamp()-interval '7 days';
  IF NOT FOUND OR msg.user_id=uid THEN RAISE EXCEPTION 'This message cannot be reported.'; END IF;
  IF (SELECT count(*) FROM earnly_chat.reports WHERE reporter_id=uid AND created_at>clock_timestamp()-interval '1 day')>=20 THEN RAISE EXCEPTION 'Report limit reached. Contact Support if you need more help.'; END IF;
  INSERT INTO earnly_chat.reports(message_id,reporter_id,reason) VALUES(msg.id,uid,p_data->>'reason') ON CONFLICT DO NOTHING;
 ELSIF p_action='delete' THEN
  UPDATE earnly_chat.messages SET hidden=true WHERE id=(p_data->>'message_id')::uuid AND user_id=uid;
 END IF;
 IF p_action<>'feed' THEN RETURN jsonb_build_object('ok',true); END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('user_id',b.blocked_id,'username',coalesce(p.username,'Player'))),'[]') INTO blocked
 FROM earnly_chat.blocks b LEFT JOIN public.profiles p ON p.user_id=b.blocked_id WHERE b.user_id=uid;
 SELECT coalesce(jsonb_agg(row_data ORDER BY created_at,id),'[]') INTO result FROM (
  SELECT m.created_at,m.id,jsonb_build_object('id',m.id,'user_id',m.user_id,'body',m.body,'created_at',m.created_at,'username',coalesce(p.username,'Player'),
   'equipped',coalesce((SELECT jsonb_object_agg(l.slot,jsonb_build_object('id',i.id,'name',i.name,'imageUrl',i.asset_path)) FROM public.cosmetic_loadouts l JOIN public.cosmetic_items i ON i.id=l.item_id WHERE l.user_id=m.user_id),'{}')) AS row_data
  FROM earnly_chat.messages m LEFT JOIN public.profiles p ON p.user_id=m.user_id
  WHERE NOT m.hidden AND m.created_at>clock_timestamp()-interval '7 days'
   AND NOT EXISTS(SELECT 1 FROM earnly_chat.blocks b WHERE (b.user_id=uid AND b.blocked_id=m.user_id) OR (b.blocked_id=uid AND b.user_id=m.user_id))
   AND NOT EXISTS(SELECT 1 FROM earnly_chat.reports r WHERE r.reporter_id=uid AND r.message_id=m.id)
   AND NOT EXISTS(SELECT 1 FROM earnly_chat.members s WHERE s.user_id=m.user_id AND s.suspended_until>clock_timestamp())
   AND NOT EXISTS(SELECT 1 FROM public.leaderboard_bans b WHERE b.user_id=m.user_id)
  ORDER BY m.created_at DESC,m.id DESC LIMIT 60
 ) recent;
 RETURN jsonb_build_object('messages',result,'blocked',blocked,'muted',coalesce(member.muted,false),'accepted',member.accepted_at IS NOT NULL,'username',username);
END $$;
REVOKE ALL ON FUNCTION earnly_chat.handle(text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION earnly_chat.handle(text,jsonb) TO authenticated;
CREATE FUNCTION public.arcade_chat(p_action text,p_data jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT earnly_chat.handle(p_action,p_data) $$;
REVOKE ALL ON FUNCTION public.arcade_chat(text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.arcade_chat(text,jsonb) TO authenticated;

-- Administrative API is service-role only, never exposed through a browser key.
CREATE FUNCTION earnly_chat.moderate(p_action text,p_id uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 IF p_action='queue' THEN
  SELECT coalesce(jsonb_agg(x),'[]') INTO result FROM (
   SELECT r.message_id,r.reason,r.created_at,m.body,m.user_id,p.username
   FROM earnly_chat.reports r JOIN earnly_chat.messages m ON m.id=r.message_id LEFT JOIN public.profiles p ON p.user_id=m.user_id
   WHERE r.resolved_at IS NULL ORDER BY r.created_at LIMIT 100
  ) x;
  RETURN result;
 ELSIF p_action='remove' THEN UPDATE earnly_chat.messages SET hidden=true WHERE id=p_id;
 ELSIF p_action='suspend' THEN
  INSERT INTO earnly_chat.members(user_id,suspended_until) VALUES(p_id,clock_timestamp()+interval '30 days')
  ON CONFLICT(user_id) DO UPDATE SET suspended_until=excluded.suspended_until;
 ELSIF p_action='restore' THEN UPDATE earnly_chat.members SET suspended_until=NULL WHERE user_id=p_id;
 ELSIF p_action='resolve' THEN UPDATE earnly_chat.reports SET resolved_at=clock_timestamp() WHERE message_id=p_id;
 ELSIF p_action='prune' THEN
  DELETE FROM earnly_chat.messages WHERE created_at<clock_timestamp()-interval '30 days'
   AND NOT EXISTS(SELECT 1 FROM earnly_chat.reports r WHERE r.message_id=messages.id AND r.resolved_at IS NULL);
 ELSE RAISE EXCEPTION 'Unknown moderation action.'; END IF;
 RETURN jsonb_build_object('ok',true);
END $$;
REVOKE ALL ON FUNCTION earnly_chat.moderate(text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION earnly_chat.moderate(text,uuid) TO service_role;
CREATE FUNCTION public.arcade_chat_moderate(p_action text,p_id uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT earnly_chat.moderate(p_action,p_id) $$;
REVOKE ALL ON FUNCTION public.arcade_chat_moderate(text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.arcade_chat_moderate(text,uuid) TO service_role;
