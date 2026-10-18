ALTER TABLE earnly_world.items ADD COLUMN IF NOT EXISTS centered boolean NOT NULL DEFAULT false;
DO $patch$
DECLARE source text:=pg_get_functiondef('public.world_api(uuid,text,jsonb)'::regprocedure);
BEGIN
 IF strpos(source,'''centeredTables''')=0 THEN
  IF strpos(source,$old$return jsonb_build_object('furnitureColors',$old$)=0 OR strpos(source,$old$rotation=(p_data->>'rotation')::int where id=iid$old$)=0 THEN RAISE EXCEPTION 'Unexpected World API for centered tables';END IF;
  source:=replace(source,$old$return jsonb_build_object('furnitureColors',$old$,$new$return jsonb_build_object('centeredTables',true,'furnitureColors',$new$);
  source:=replace(source,$old$rotation=(p_data->>'rotation')::int where id=iid$old$,$new$rotation=(p_data->>'rotation')::int,centered=coalesce((p_data->>'centered')::boolean,false) where id=iid$new$);
  source:=replace(source,$old$room_id=null,x=null,y=null,z=null where id=iid$old$,$new$room_id=null,x=null,y=null,z=null,centered=false where id=iid$new$);
  EXECUTE source;
 END IF;
 source:=pg_get_functiondef('public.world_room_snapshot(uuid,uuid)'::regprocedure);
 IF strpos(source,'''centered'',i.centered')=0 THEN
  IF strpos(source,$old$'canStack',d.can_stack$old$)=0 THEN RAISE EXCEPTION 'Unexpected room snapshot for centered tables';END IF;
  source:=replace(source,$old$'canStack',d.can_stack$old$,$new$'centered',i.centered,'canStack',case when i.centered then false else d.can_stack end$new$);
  EXECUTE source;
 END IF;
END $patch$;
