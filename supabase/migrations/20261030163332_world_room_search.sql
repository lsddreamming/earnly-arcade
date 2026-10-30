-- Deliberate name/username search only. No automatic player-room listing.
create or replace function public.world_search_rooms(p_actor uuid,p_query text,p_offset integer default 0)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare results jsonb; term text:=lower(btrim(coalesce(p_query,''))); username_only boolean; start_at integer:=coalesce(p_offset,0);
begin
 if not exists(select 1 from auth.users where id=p_actor and not coalesce(is_anonymous,false) and email_confirmed_at is not null)
 or exists(select 1 from public.leaderboard_bans where user_id=p_actor)
 or exists(select 1 from earnly_world.social_members where user_id=p_actor and suspended_until>now()) then raise exception 'Account unavailable';end if;
 if char_length(term)<2 or char_length(term)>80 or term ~ '[[:cntrl:]]' then raise exception 'Enter 2–80 characters for a room name or username';end if;
 if start_at<0 or start_at>1200 then raise exception 'Search page unavailable';end if;
 username_only:=left(term,1)='@';
 if username_only then term:=substr(term,2);end if;
 if char_length(term)<2 then raise exception 'Enter at least 2 characters after @';end if;
 select coalesce(jsonb_agg(q.payload order by q.rank,q.normalized_name,q.id),'[]'::jsonb) into results from (
 select r.id,lower(r.name) as normalized_name,
 case when lower(p.username)=term or (not username_only and lower(r.name)=term) then 0
      when starts_with(lower(p.username),term) or (not username_only and starts_with(lower(r.name),term)) then 1 else 2 end as rank,
 jsonb_build_object('id',r.id,'name',r.name,'ownerId',r.owner_id,'ownerUsername',p.username,'access',r.access_type) as payload
 from earnly_world.rooms r join public.profiles p on p.user_id=r.owner_id
 join auth.users u on u.id=r.owner_id and not coalesce(u.is_anonymous,false) and u.email_confirmed_at is not null
 where r.access_type='open' and nullif(btrim(p.username),'') is not null
 and not exists(select 1 from earnly_world.blocks b where (b.user_id=p_actor and b.blocked_id=r.owner_id) or (b.user_id=r.owner_id and b.blocked_id=p_actor))
 and not exists(select 1 from public.leaderboard_bans where user_id=r.owner_id)
 and not exists(select 1 from earnly_world.social_members where user_id=r.owner_id and suspended_until>now())
 and (strpos(lower(p.username),term)>0 or (not username_only and strpos(lower(r.name),term)>0))
 order by rank,normalized_name,r.id limit 13 offset start_at
 ) q;
 return jsonb_build_object('rooms',case when jsonb_array_length(results)>12 then results-12 else results end,'nextOffset',case when jsonb_array_length(results)>12 then start_at+12 else null end);
end $$;
revoke all on function public.world_search_rooms(uuid,text,integer) from public,anon,authenticated;
grant execute on function public.world_search_rooms(uuid,text,integer) to service_role;
