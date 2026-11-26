create table public.spuddy_patch_records (
  week text not null, player uuid not null references auth.users(id) on delete cascade,
  waves integer not null check(waves between 1 and 5),
  lives integer not null check(lives between 1 and 100),
  cash integer not null check(cash >= 0),
  primary key(week,player)
);
alter table public.spuddy_patch_records enable row level security;
revoke all on public.spuddy_patch_records from public, anon, authenticated;
grant select,insert,update on public.spuddy_patch_records to service_role;
create function public.patch_cup_keep(w text,p uuid,n integer,h integer,c integer)
returns void language sql security invoker set search_path='' as $$
 insert into public.spuddy_patch_records as old values(w,p,n,h,c)
 on conflict(week,player) do update set waves=excluded.waves,lives=excluded.lives,cash=excluded.cash
 where (excluded.waves,excluded.lives,excluded.cash)>(old.waves,old.lives,old.cash)
$$;
create function public.patch_cup_list(w text)
returns table("position" bigint, username text,waves integer,lives integer,cash integer)
language sql stable security invoker set search_path='' as $$
 select rank() over(order by r.waves desc,r.lives desc,r.cash desc),p.username::text,r.waves,r.lives,r.cash
 from public.spuddy_patch_records r join public.profiles p on p.user_id=r.player
 where r.week=w and p.username is not null and not exists(select 1 from public.leaderboard_bans b where b.user_id=r.player)
 order by 1,p.username limit 50
$$;
revoke all on function public.patch_cup_keep(text,uuid,integer,integer,integer),public.patch_cup_list(text) from public,anon,authenticated;
grant execute on function public.patch_cup_keep(text,uuid,integer,integer,integer),public.patch_cup_list(text) to service_role;
