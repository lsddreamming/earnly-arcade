-- Server-only conservative reservations. Never store chat, player identifiers or API keys.
create table if not exists earnly_world.ai_budget (
 bucket text primary key,
 reserved_usd numeric(12,6) not null default 0 check(reserved_usd>=0),
 requests integer not null default 0 check(requests>=0)
);
alter table earnly_world.ai_budget enable row level security;
revoke all on earnly_world.ai_budget from public,anon,authenticated;
grant select,insert,update,delete on earnly_world.ai_budget to service_role;

create or replace function public.world_ai_reserve(p_daily numeric,p_monthly numeric)
returns boolean language plpgsql security invoker set search_path='' as $$
declare
 d text:='day:'||to_char(now() at time zone 'UTC','YYYY-MM-DD');
 m text:='month:'||to_char(now() at time zone 'UTC','YYYY-MM');
 minute_key text:='minute:'||to_char(now() at time zone 'UTC','YYYY-MM-DD-HH24-MI');
begin
 if p_daily is null or p_monthly is null or p_daily<=0 or p_monthly<=0 or p_daily>1 or p_monthly>10 then return false;end if;
 perform pg_advisory_xact_lock(370,1);
 insert into earnly_world.ai_budget(bucket) values(d),(m),(minute_key) on conflict do nothing;
 if (select reserved_usd+0.002>p_daily from earnly_world.ai_budget where bucket=d)
 or (select reserved_usd+0.002>p_monthly from earnly_world.ai_budget where bucket=m)
 or (select requests>=12 from earnly_world.ai_budget where bucket=minute_key) then return false;end if;
 update earnly_world.ai_budget set reserved_usd=reserved_usd+0.002,requests=requests+1 where bucket in(d,m,minute_key);
 -- Bounded aggregate-only retention; reservations are never refunded, including timeouts.
 delete from earnly_world.ai_budget where bucket like 'minute:%' and bucket<>minute_key;
 delete from earnly_world.ai_budget where bucket like 'day:%' and bucket<'day:'||to_char((now() at time zone 'UTC')-interval '90 days','YYYY-MM-DD');
 return true;
end $$;
revoke all on function public.world_ai_reserve(numeric,numeric) from public,anon,authenticated;
grant execute on function public.world_ai_reserve(numeric,numeric) to service_role;
