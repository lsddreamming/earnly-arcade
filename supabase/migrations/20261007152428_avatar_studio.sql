-- Apply to the existing Earnly database. Does not replace accounts or mint Coins.
-- Dependencies: public.profiles(user_id,username), coin_wallets(user_id,balance,
-- lifetime_earned,updated_at), leaderboard_scores(user_id,game,score,achieved_at),
-- leaderboard_bans(user_id), and auth.users(id).


CREATE TABLE IF NOT EXISTS public.cosmetic_items (
  id text PRIMARY KEY CHECK (id ~ '^[a-z0-9-]{1,64}$'),
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  slot text NOT NULL CHECK (slot IN ('avatar','outfit','weapon')),
  coin_price integer NOT NULL CHECK (coin_price BETWEEN 0 AND 1000000),
  rarity text NOT NULL CHECK (rarity IN ('common','rare','legendary')),
  asset_path text NOT NULL CHECK (asset_path ~ '^cosmetic-[a-z0-9-]+[.]svg$'),
  is_starter boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  CHECK (NOT is_starter OR coin_price = 0),
  UNIQUE(id,slot)
);
CREATE UNIQUE INDEX IF NOT EXISTS cosmetic_starter_slot ON public.cosmetic_items(slot) WHERE is_starter;

-- Inventory is normalized to avoid duplicate ownership. APIs return it as an array.
CREATE TABLE IF NOT EXISTS public.cosmetic_inventory (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id text NOT NULL REFERENCES public.cosmetic_items(id),
  acquired_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,item_id)
);
CREATE TABLE IF NOT EXISTS public.cosmetic_loadouts (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slot text NOT NULL CHECK (slot IN ('avatar','outfit','weapon')),
  item_id text NOT NULL,
  PRIMARY KEY(user_id,slot),
  FOREIGN KEY(user_id,item_id) REFERENCES public.cosmetic_inventory(user_id,item_id),
  FOREIGN KEY(item_id,slot) REFERENCES public.cosmetic_items(id,slot)
);
CREATE TABLE IF NOT EXISTS public.cosmetic_receipts (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id uuid NOT NULL,
  item_id text NOT NULL REFERENCES public.cosmetic_items(id),
  amount integer NOT NULL CHECK (amount >= 0),
  purchased_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,request_id)
);
INSERT INTO public.cosmetic_items(id,name,slot,coin_price,rarity,asset_path,is_starter) VALUES
 ('cyber-starter','Cyber Starter','avatar',0,'common','cosmetic-cyber-starter.svg',true),
 ('neon-phantom','Neon Phantom','avatar',250,'rare','cosmetic-neon-phantom.svg',false),
 ('vortex-mech','Vortex Mech','avatar',500,'rare','cosmetic-vortex-mech.svg',false),
 ('astra-prime','Astra Prime','avatar',1000,'legendary','cosmetic-astra-prime.svg',false),
 ('starter-suit','Pilot Suit','outfit',0,'common','cosmetic-starter-suit.svg',true),
 ('neon-jacket','Neon Jacket','outfit',300,'rare','cosmetic-neon-jacket.svg',false),
 ('astral-armor','Astral Armor','outfit',800,'legendary','cosmetic-astral-armor.svg',false),
 ('starter-blaster','Training Blaster','weapon',0,'common','cosmetic-starter-blaster.svg',true),
 ('pulse-blade','Pulse Blade','weapon',400,'rare','cosmetic-pulse-blade.svg',false),
 ('solar-cannon','Solar Cannon','weapon',900,'legendary','cosmetic-solar-cannon.svg',false)
ON CONFLICT(id) DO NOTHING;

-- These tables are server-owned; browser REST clients cannot forge ownership.
ALTER TABLE public.cosmetic_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cosmetic_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cosmetic_loadouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cosmetic_receipts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.cosmetic_items,public.cosmetic_inventory,public.cosmetic_loadouts,
 public.cosmetic_receipts FROM PUBLIC,anon,authenticated;


-- Browser roles cannot call these routines. The Edge Function validates identity
-- and calls them with its service credential; SECURITY INVOKER preserves grants.
GRANT SELECT,INSERT,UPDATE,DELETE ON public.cosmetic_items,public.cosmetic_inventory,
 public.cosmetic_loadouts,public.cosmetic_receipts TO service_role;
CREATE INDEX cosmetic_inventory_item_idx ON public.cosmetic_inventory(item_id);
CREATE INDEX cosmetic_loadouts_item_slot_idx ON public.cosmetic_loadouts(item_id,slot);
CREATE INDEX cosmetic_receipts_item_idx ON public.cosmetic_receipts(item_id);
CREATE INDEX IF NOT EXISTS coin_ledger_game_count_idx ON public.coin_ledger(user_id) WHERE source_type='game';

CREATE FUNCTION public.cosmetic_item_json(i public.cosmetic_items) RETURNS jsonb
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT jsonb_build_object('id',i.id,'name',i.name,'slot',i.slot,'coinPrice',i.coin_price,'rarity',i.rarity,'imageUrl',i.asset_path)
$$;
CREATE FUNCTION public.cosmetic_loadout_json(p_user_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT jsonb_object_agg(s.slot,public.cosmetic_item_json(i))
 FROM public.cosmetic_items s LEFT JOIN public.cosmetic_loadouts l ON l.user_id=p_user_id AND l.slot=s.slot
 JOIN public.cosmetic_items i ON i.id=COALESCE(l.item_id,s.id) WHERE s.is_starter
$$;
CREATE FUNCTION public.cosmetic_user_state(p_user_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT jsonb_build_object('username',p.username,'coins',w.balance::text,'lifetimeEarned',w.lifetime_earned::text,
  'inventory',COALESCE((SELECT jsonb_agg(o.item_id ORDER BY o.item_id) FROM public.cosmetic_inventory o WHERE o.user_id=p.user_id),'[]'::jsonb),
  'equipped',public.cosmetic_loadout_json(p.user_id),
  'equippedAvatarId',public.cosmetic_loadout_json(p.user_id)->'avatar'->>'id',
  'highScore',COALESCE((SELECT s.score::text FROM public.leaderboard_scores s WHERE s.user_id=p.user_id AND s.game='snake'),'0'),
  'gamesPlayed',(SELECT count(*) FROM public.coin_ledger g WHERE g.user_id=p.user_id AND g.source_type='game'),
  'totalSkinsUnlocked',(SELECT count(*) FROM public.cosmetic_inventory o JOIN public.cosmetic_items i ON i.id=o.item_id WHERE o.user_id=p.user_id AND i.slot='avatar'))
 FROM public.profiles p JOIN public.coin_wallets w USING(user_id) WHERE p.user_id=p_user_id
$$;
CREATE FUNCTION public.cosmetic_lock_player(p_user_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' SET statement_timeout='5s' AS $$
BEGIN
 PERFORM 1 FROM public.coin_wallets WHERE user_id=p_user_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'WALLET_UNAVAILABLE' USING ERRCODE='P0001'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE user_id=p_user_id AND username IS NOT NULL) THEN
  RAISE EXCEPTION 'PROFILE_REQUIRED' USING ERRCODE='P0001'; END IF;
 INSERT INTO public.cosmetic_inventory(user_id,item_id) SELECT p_user_id,id FROM public.cosmetic_items WHERE is_starter ON CONFLICT DO NOTHING;
 INSERT INTO public.cosmetic_loadouts(user_id,slot,item_id) SELECT p_user_id,slot,id FROM public.cosmetic_items WHERE is_starter ON CONFLICT DO NOTHING;
END $$;
CREATE FUNCTION public.cosmetic_me(p_user_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' SET statement_timeout='5s' AS $$
BEGIN
 PERFORM public.cosmetic_lock_player(p_user_id);
 RETURN jsonb_build_object('user',public.cosmetic_user_state(p_user_id));
END $$;
CREATE FUNCTION public.cosmetic_buy(p_user_id uuid,p_item_id text,p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' SET statement_timeout='5s' AS $$
DECLARE item public.cosmetic_items%rowtype; receipt public.cosmetic_receipts%rowtype; owned boolean; price integer; balance bigint;
BEGIN
 PERFORM public.cosmetic_lock_player(p_user_id);
 SELECT * INTO receipt FROM public.cosmetic_receipts WHERE user_id=p_user_id AND request_id=p_request_id;
 IF FOUND THEN
  IF receipt.item_id<>p_item_id THEN RAISE EXCEPTION 'REQUEST_REUSED' USING ERRCODE='P0001'; END IF;
  RETURN jsonb_build_object('charged',false,'amount',receipt.amount,'user',public.cosmetic_user_state(p_user_id));
 END IF;
 SELECT * INTO item FROM public.cosmetic_items WHERE id=p_item_id AND active FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'ITEM_NOT_FOUND' USING ERRCODE='P0001'; END IF;
 SELECT EXISTS(SELECT 1 FROM public.cosmetic_inventory WHERE user_id=p_user_id AND item_id=p_item_id) INTO owned;
 price:=CASE WHEN owned THEN 0 ELSE item.coin_price END;
 SELECT w.balance INTO balance FROM public.coin_wallets w WHERE w.user_id=p_user_id;
 IF balance<price THEN RAISE EXCEPTION 'INSUFFICIENT_COINS' USING ERRCODE='P0001'; END IF;
 IF NOT owned THEN
  UPDATE public.coin_wallets SET balance=coin_wallets.balance-price,updated_at=now() WHERE user_id=p_user_id;
  INSERT INTO public.cosmetic_inventory(user_id,item_id) VALUES(p_user_id,p_item_id);
 END IF;
 INSERT INTO public.cosmetic_loadouts(user_id,slot,item_id) VALUES(p_user_id,item.slot,p_item_id)
  ON CONFLICT(user_id,slot) DO UPDATE SET item_id=EXCLUDED.item_id;
 INSERT INTO public.cosmetic_receipts(user_id,request_id,item_id,amount) VALUES(p_user_id,p_request_id,p_item_id,price);
 RETURN jsonb_build_object('charged',price>0,'amount',price,'user',public.cosmetic_user_state(p_user_id));
END $$;
CREATE FUNCTION public.cosmetic_equip(p_user_id uuid,p_item_id text) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' SET statement_timeout='5s' AS $$
DECLARE item public.cosmetic_items%rowtype;
BEGIN
 PERFORM public.cosmetic_lock_player(p_user_id);
 SELECT i.* INTO item FROM public.cosmetic_items i JOIN public.cosmetic_inventory o ON o.item_id=i.id WHERE o.user_id=p_user_id AND i.id=p_item_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'ITEM_NOT_OWNED' USING ERRCODE='P0001'; END IF;
 INSERT INTO public.cosmetic_loadouts(user_id,slot,item_id) VALUES(p_user_id,item.slot,p_item_id)
  ON CONFLICT(user_id,slot) DO UPDATE SET item_id=EXCLUDED.item_id;
 RETURN jsonb_build_object('user',public.cosmetic_user_state(p_user_id));
END $$;
CREATE FUNCTION public.cosmetic_public_profiles(p_game text DEFAULT 'snake',p_username text DEFAULT NULL,p_limit integer DEFAULT 25) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' SET statement_timeout='5s' AS $$
 WITH ranked AS (
  SELECT s.user_id,s.score,s.achieved_at,rank() OVER(ORDER BY CASE WHEN p_game='memory' THEN -s.score ELSE s.score END DESC) AS rank
  FROM public.leaderboard_scores s JOIN public.profiles p USING(user_id)
  WHERE s.game=p_game AND p.username IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.leaderboard_bans b WHERE b.user_id=s.user_id)
 ), visible AS (
  SELECT p.user_id,p.username,r.rank,r.score,r.achieved_at FROM public.profiles p LEFT JOIN ranked r USING(user_id)
  WHERE p.username IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.leaderboard_bans b WHERE b.user_id=p.user_id)
   AND ((p_username IS NULL AND r.rank IS NOT NULL) OR (p_username IS NOT NULL AND lower(p.username)=lower(p_username)))
  ORDER BY r.rank NULLS LAST,r.achieved_at,p.username LIMIT greatest(1,least(p_limit,100))
 ) SELECT COALESCE(jsonb_agg(jsonb_build_object(
  'username',v.username,'rank',v.rank::text,'highScore',COALESCE(v.score,0)::text,'game',p_game,
  'gamesPlayed',(SELECT count(*) FROM public.coin_ledger g WHERE g.user_id=v.user_id AND g.source_type='game'),
  'totalSkinsUnlocked',(SELECT count(*) FROM public.cosmetic_inventory o JOIN public.cosmetic_items i ON i.id=o.item_id WHERE o.user_id=v.user_id AND i.slot='avatar')+
   CASE WHEN EXISTS(SELECT 1 FROM public.cosmetic_inventory o JOIN public.cosmetic_items i ON i.id=o.item_id WHERE o.user_id=v.user_id AND i.is_starter AND i.slot='avatar') THEN 0 ELSE 1 END,
  'equipped',public.cosmetic_loadout_json(v.user_id),'equippedAvatar',public.cosmetic_loadout_json(v.user_id)->'avatar')),'[]'::jsonb) FROM visible v
$$;

REVOKE ALL ON FUNCTION public.cosmetic_item_json(public.cosmetic_items),public.cosmetic_loadout_json(uuid),
 public.cosmetic_user_state(uuid),public.cosmetic_lock_player(uuid),public.cosmetic_me(uuid),
 public.cosmetic_buy(uuid,text,uuid),public.cosmetic_equip(uuid,text),public.cosmetic_public_profiles(text,text,integer)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cosmetic_item_json(public.cosmetic_items),public.cosmetic_loadout_json(uuid),
 public.cosmetic_user_state(uuid),public.cosmetic_lock_player(uuid),public.cosmetic_me(uuid),
 public.cosmetic_buy(uuid,text,uuid),public.cosmetic_equip(uuid,text),public.cosmetic_public_profiles(text,text,integer)
 TO service_role;
