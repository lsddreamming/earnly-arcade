-- Distinguish budget exhaustion from rate/configuration failures without resetting counters.
-- Keep the old boolean RPC available during rolling deployment.
create or replace function public.world_ai_reserve_status(p_daily numeric,p_monthly numeric)
returns text language plpgsql security invoker set search_path='' as $$
declare
 d text:='day:'||to_char(now() at time zone 'UTC','YYYY-MM-DD');
 m text:='month:'||to_char(now() at time zone 'UTC','YYYY-MM');
 minute_key text:='minute:'||to_char(now() at time zone 'UTC','YYYY-MM-DD-HH24-MI');
 result text:='reserved';
begin
 if p_daily is null or p_monthly is null or p_daily<=0 or p_monthly<=0 or p_daily>1 or p_monthly>10 then return 'disabled';end if;
 perform pg_advisory_xact_lock(370,1);
 insert into earnly_world.ai_budget(bucket) values(d),(m),(minute_key) on conflict do nothing;
 -- Scripted turns share the same cross-process limit as generated turns.
 if (select requests>=12 from earnly_world.ai_budget where bucket=minute_key) then return 'rate_limit';end if;
 if (select reserved_usd+0.002>p_monthly from earnly_world.ai_budget where bucket=m) then result:='monthly_limit';
 elsif (select reserved_usd+0.002>p_daily from earnly_world.ai_budget where bucket=d) then result:='daily_limit';end if;
 update earnly_world.ai_budget set requests=requests+1,
 reserved_usd=reserved_usd+case when result='reserved' then 0.002 else 0 end where bucket=minute_key;
 if result='reserved' then
  update earnly_world.ai_budget set reserved_usd=reserved_usd+0.002,requests=requests+1 where bucket in(d,m);
 end if;
 delete from earnly_world.ai_budget where bucket like 'minute:%' and bucket<>minute_key;
 delete from earnly_world.ai_budget where bucket like 'day:%' and bucket<'day:'||to_char((now() at time zone 'UTC')-interval '90 days','YYYY-MM-DD');
 return result;
end $$;
revoke all on function public.world_ai_reserve_status(numeric,numeric) from public,anon,authenticated;
grant execute on function public.world_ai_reserve_status(numeric,numeric) to service_role;
