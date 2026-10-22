-- Owner-only metadata change. Furniture, permissions, links and grid revision stay intact.
create or replace function public.world_rename_room(p_actor uuid,p_room uuid,p_name text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare room_name text := btrim(p_name); r earnly_world.rooms%rowtype;
begin
 if not exists(select 1 from auth.users where id=p_actor and not coalesce(is_anonymous,false) and email_confirmed_at is not null)
 or exists(select 1 from public.leaderboard_bans where user_id=p_actor)
 or exists(select 1 from earnly_world.social_members where user_id=p_actor and suspended_until>now()) then raise exception 'Account unavailable';end if;
 if room_name is null or length(room_name) not between 1 and 40 or room_name~'[[:cntrl:]]' then raise exception 'Choose a room name';end if;
 update earnly_world.rooms set name=room_name where id=p_room and owner_id=p_actor returning * into r;
 if not found then raise exception 'Room unavailable';end if;
 return jsonb_build_object('roomId',r.id,'name',r.name);
end $$;
revoke all on function public.world_rename_room(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.world_rename_room(uuid,uuid,text) to service_role;
