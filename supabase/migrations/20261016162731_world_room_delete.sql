-- Adds an owner-only operation; applying this migration deletes no player data.
create or replace function public.world_delete_room(p_actor uuid,p_room uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare r earnly_world.rooms%rowtype;
begin
 if not exists(select 1 from auth.users where id=p_actor and not coalesce(is_anonymous,false) and email_confirmed_at is not null)
 or exists(select 1 from public.leaderboard_bans where user_id=p_actor)
 or exists(select 1 from earnly_world.social_members where user_id=p_actor and suspended_until>now()) then raise exception 'Account unavailable';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_actor::text,174));
 select * into r from earnly_world.rooms where id=p_room and owner_id=p_actor for update;
 if not found then raise exception 'Room unavailable';end if;
 -- Preserve item IDs, ownership, serials and purchase history; only clear placement.
 update earnly_world.items set room_id=null,x=null,y=null,z=null where room_id=r.id;
 delete from earnly_world.rooms where id=r.id and owner_id=p_actor;
 return jsonb_build_object('ok',true,'roomId',r.id);
end $$;
revoke all on function public.world_delete_room(uuid,uuid) from public,anon,authenticated;
grant execute on function public.world_delete_room(uuid,uuid) to service_role;
