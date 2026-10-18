-- Persist a chosen accent color on the owned item and immutable purchase receipt.
ALTER TABLE earnly_world.items ADD COLUMN IF NOT EXISTS color text CHECK (color IS NULL OR color IN ('#80c9b5','#d9a0b5','#83afd4','#b5a0d5','#d6bd94'));
ALTER TABLE earnly_world.purchase_receipts ADD COLUMN IF NOT EXISTS color text CHECK (color IS NULL OR color IN ('#80c9b5','#d9a0b5','#83afd4','#b5a0d5','#d6bd94'));
DO $patch$
DECLARE source text:=pg_get_functiondef('public.world_api(uuid,text,jsonb)'::regprocedure);
BEGIN
 IF strpos(source,'furniture_color_v1')=0 THEN
  IF strpos(source,$old$return jsonb_build_object('balance',$old$)=0 THEN RAISE EXCEPTION 'Unexpected World API for color migration';END IF;
  source:=replace(source,$old$return jsonb_build_object('balance',$old$,$new$return jsonb_build_object('furnitureColors','[{"name":"Mint","color":"#80c9b5"},{"name":"Rose","color":"#d9a0b5"},{"name":"Ocean","color":"#83afd4"},{"name":"Lavender","color":"#b5a0d5"},{"name":"Sand","color":"#d6bd94"}]'::jsonb,'balance',$new$);
  IF strpos(source,$old$elsif p_action='buy' then$old$)=0 THEN RAISE EXCEPTION 'Unexpected World API for color migration';END IF;
  source:=replace(source,$old$elsif p_action='buy' then$old$,$new$elsif p_action='buy' then
   -- furniture_color_v1: validate before charging or replaying.
   if nullif(p_data->>'color','') is not null and p_data->>'color' not in ('#80c9b5','#d9a0b5','#83afd4','#b5a0d5','#d6bd94') then raise exception 'Choose an available furniture color';end if;$new$);
  IF strpos(source,$old$receipt.definition_id<>p_data->>'definitionId'$old$)=0 THEN RAISE EXCEPTION 'Unexpected World API for color migration';END IF;
  source:=replace(source,$old$receipt.definition_id<>p_data->>'definitionId'$old$,$new$(receipt.definition_id<>p_data->>'definitionId' or receipt.color is distinct from nullif(p_data->>'color',''))$new$);
  IF strpos(source,$old$items(owner_id,definition_id,serial,origin) values(p_actor,d.id,d.minted,'catalog')$old$)=0 THEN RAISE EXCEPTION 'Unexpected World API for color migration';END IF;
  source:=replace(source,$old$items(owner_id,definition_id,serial,origin) values(p_actor,d.id,d.minted,'catalog')$old$,$new$items(owner_id,definition_id,serial,origin,color) values(p_actor,d.id,d.minted,'catalog',nullif(p_data->>'color',''))$new$);
  IF strpos(source,$old$purchase_receipts(user_id,request_id,definition_id,item_id,price,purchased_coins) values(p_actor,rid,d.id,iid,d.price,least(w.purchased_balance,d.price))$old$)=0 THEN RAISE EXCEPTION 'Unexpected World API for color migration';END IF;
  source:=replace(source,$old$purchase_receipts(user_id,request_id,definition_id,item_id,price,purchased_coins) values(p_actor,rid,d.id,iid,d.price,least(w.purchased_balance,d.price))$old$,$new$purchase_receipts(user_id,request_id,definition_id,item_id,price,purchased_coins,color) values(p_actor,rid,d.id,iid,d.price,least(w.purchased_balance,d.price),nullif(p_data->>'color',''))$new$);
  EXECUTE source;
 END IF;
 source:=pg_get_functiondef('public.world_room_snapshot(uuid,uuid)'::regprocedure);
 IF strpos(source,'coalesce(i.color,d.color)')=0 THEN
  IF strpos(source,$old$'color',d.color$old$)=0 THEN RAISE EXCEPTION 'Unexpected room snapshot for colors';END IF;
  source:=replace(source,$old$'color',d.color$old$,$new$'color',coalesce(i.color,d.color)$new$);
  EXECUTE source;
 END IF;
END $patch$;
