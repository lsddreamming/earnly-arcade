-- Read-only, server-only directory. Friendship never grants entry to closed rooms.
create or replace function public.world_friend_rooms(p_actor uuid,p_friend uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from auth.users where id=p_actor and not coalesce(is_anonymous,false) and email_confirmed_at is not null)
 or exists(select 1 from public.leaderboard_bans where user_id in (p_actor,p_friend))
 or exists(select 1 from earnly_world.social_members where user_id in (p_actor,p_friend) and suspended_until>now()) then raise exception 'Account unavailable';end if;
 if not exists(select 1 from earnly_world.friends where accepted and ((requester=p_actor and recipient=p_friend) or (requester=p_friend and recipient=p_actor)))
 or exists(select 1 from earnly_world.blocks where (user_id=p_actor and blocked_id=p_friend) or (user_id=p_friend and blocked_id=p_actor)) then raise exception 'Player unavailable';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'ownerId',owner_id,'access',access_type,'capacity',max_users) order by created_at,id)
 from earnly_world.rooms where owner_id=p_friend and access_type='open'),'[]'::jsonb);
end $$;
revoke all on function public.world_friend_rooms(uuid,uuid) from public,anon,authenticated;
grant execute on function public.world_friend_rooms(uuid,uuid) to service_role;
