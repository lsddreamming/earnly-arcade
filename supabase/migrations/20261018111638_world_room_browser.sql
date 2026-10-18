-- Searchable, bounded public-player directory; ownership and private rooms stay protected.
create or replace function public.world_explore_rooms(p_actor uuid,p_query text default '',p_offset integer default 0)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare results jsonb; start_at integer:=greatest(0,coalesce(p_offset,0)); term text:=lower(left(btrim(coalesce(p_query,'')),80));
begin
 if not exists(select 1 from auth.users where id=p_actor and not coalesce(is_anonymous,false) and email_confirmed_at is not null)
 or exists(select 1 from public.leaderboard_bans where user_id=p_actor)
 or exists(select 1 from earnly_world.social_members where user_id=p_actor and suspended_until>now()) then raise exception 'Account unavailable';end if;
 select coalesce(jsonb_agg(to_jsonb(q) order by q.id),'[]'::jsonb) into results from (
 select r.id,r.name,r.owner_id as "ownerId",coalesce(nullif(p.username,''),'Player') as "ownerUsername",r.access_type as access
 from earnly_world.rooms r left join public.profiles p on p.user_id=r.owner_id
 where r.owner_id is not null and r.owner_id<>p_actor and r.access_type='open'
 and not exists(select 1 from earnly_world.blocks b where (b.user_id=p_actor and b.blocked_id=r.owner_id) or (b.user_id=r.owner_id and b.blocked_id=p_actor))
 and not exists(select 1 from public.leaderboard_bans where user_id=r.owner_id)
 and not exists(select 1 from earnly_world.social_members where user_id=r.owner_id and suspended_until>now())
 and (term='' or strpos(lower(r.name),term)>0 or strpos(lower(coalesce(p.username,'')),term)>0)
 order by r.id limit 13 offset start_at
 ) q;
 return jsonb_build_object('rooms',case when jsonb_array_length(results)>12 then results-12 else results end,'nextOffset',case when jsonb_array_length(results)>12 then start_at+12 else null end);
end $$;
revoke all on function public.world_explore_rooms(uuid,text,integer) from public,anon,authenticated;
grant execute on function public.world_explore_rooms(uuid,text,integer) to service_role;
