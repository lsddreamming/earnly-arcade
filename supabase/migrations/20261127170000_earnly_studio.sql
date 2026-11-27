-- Private pilot. All money is integer micro-USD. Only service-role code can write.
create table public.studio_control (
 singleton boolean primary key default true check (singleton),
 enabled boolean not null default false,
 quote_expires timestamptz,
 daily_limit int not null default 500000 check (daily_limit between 0 and 25000000),
 monthly_limit int not null default 3000000 check (monthly_limit between 0 and 25000000),
 fal_limit int not null default 3000000 check (fal_limit between 0 and 25000000),
 user_jobs int not null default 5 check (user_jobs between 0 and 50),
 daily_jobs int not null default 25 check (daily_jobs between 0 and 200),
 concurrent_jobs int not null default 2 check (concurrent_jobs between 0 and 8)
);
insert into public.studio_control(singleton) values(true);
create table public.studio_accounts (
 user_id uuid primary key references auth.users on delete cascade,
 credits int not null default 0 check (credits>=0), pilot boolean not null default false
);
create table public.studio_jobs (
 id uuid primary key default gen_random_uuid(), user_id uuid references auth.users on delete set null,
 request_id uuid not null, kind text not null check (kind in ('image','video')),
 prompt text not null check(length(prompt) between 1 and 1200), ratio text not null check(ratio in ('9:16','16:9','1:1')),
 credits int not null, reserved_usd_micro int not null check(reserved_usd_micro>=0),
 state text not null default 'review' check(state in ('review','queued','dispatching','submitted','output_review','ready','failed','uncertain')),
 provider_request text, private_path text, title text, hidden boolean not null default false,
 created_at timestamptz not null default now(), unique(user_id,request_id)
);
create index studio_jobs_created on public.studio_jobs(created_at);
create table public.studio_receipts (
 source text not null check (source in ('admob','stripe','storekit','pilot')),
 event_id text not null, user_id uuid references auth.users on delete set null,
 credits int not null check(credits>0), created_at timestamptz not null default now(), primary key(source,event_id)
);
alter table public.studio_control enable row level security;
alter table public.studio_accounts enable row level security;
alter table public.studio_jobs enable row level security;
alter table public.studio_receipts enable row level security;
revoke all on public.studio_control, public.studio_accounts, public.studio_jobs, public.studio_receipts from public,anon,authenticated;
grant select,insert,update on public.studio_control, public.studio_accounts, public.studio_jobs, public.studio_receipts to service_role;

create function public.studio_grant(p_user uuid,p_source text,p_event text,p_credits int)
returns boolean language plpgsql set search_path=public,pg_temp as $$
declare receipt studio_receipts;
begin
 insert into studio_receipts(source,event_id,user_id,credits) values(p_source,p_event,p_user,p_credits)
 on conflict do nothing;
 if not found then
   select * into strict receipt from studio_receipts where source=p_source and event_id=p_event;
   if (receipt.user_id,receipt.credits) is distinct from (p_user,p_credits) then raise exception 'RECEIPT_CONFLICT'; end if;
   return false;
 end if;
 insert into studio_accounts(user_id,credits) values(p_user,p_credits)
 on conflict(user_id) do update set credits=studio_accounts.credits+excluded.credits;
 return true;
end $$;

create function public.studio_reserve(p_user uuid,p_request uuid,p_kind text,p_prompt text,p_ratio text)
returns uuid language plpgsql set search_path=public,pg_temp set timezone='UTC' as $$
declare cfg studio_control; existing studio_jobs; exposure int; charge int; new_id uuid;
begin
 select * into strict cfg from studio_control for update;
 select * into existing from studio_jobs where user_id=p_user and request_id=p_request;
 if found then
  if (existing.kind,existing.prompt,existing.ratio) is distinct from (p_kind,p_prompt,p_ratio) then raise exception 'REQUEST_CONFLICT'; end if;
  return existing.id;
 end if;
 if not cfg.enabled or cfg.quote_expires is null or cfg.quote_expires<=now() then raise exception 'STUDIO_PAUSED'; end if;
 if p_kind='image' then exposure:=4000; charge:=1;
 elsif p_kind='video' then exposure:=30000; charge:=10;
 else raise exception 'UNKNOWN_MODEL'; end if;
 if exists(select 1 from (select
   coalesce(sum(reserved_usd_micro),0)+exposure as lifetime,
   coalesce(sum(reserved_usd_micro) filter(where created_at>=date_trunc('day',now())),0)+exposure as daily,
   coalesce(sum(reserved_usd_micro) filter(where created_at>=date_trunc('month',now())),0)+exposure as monthly,
   count(*) filter(where created_at>=date_trunc('day',now())) as jobs,
   count(*) filter(where created_at>=date_trunc('day',now()) and user_id=p_user) as user_count,
   count(*) filter(where state in ('queued','review','submitted','uncertain','dispatching')) as active
   from studio_jobs) limits where lifetime>least(25000000,cfg.fal_limit) or daily>cfg.daily_limit or monthly>cfg.monthly_limit
   or jobs>=cfg.daily_jobs or user_count>=cfg.user_jobs or active>=cfg.concurrent_jobs) then raise exception 'STUDIO_LIMIT'; end if;
 update studio_accounts set credits=credits-charge where user_id=p_user and pilot and credits>=charge;
 if not found then raise exception 'PILOT_OR_CREDITS_REQUIRED'; end if;
 insert into studio_jobs(user_id,request_id,kind,prompt,ratio,credits,reserved_usd_micro)
 values(p_user,p_request,p_kind,p_prompt,p_ratio,charge,exposure) returning id into new_id;
 return new_id;
end $$;

-- A failed job always returns creator credits once. Once submission is possible,
-- keep the entire cost bound in the ledger even when the provider reports failure.
create function public.studio_fail(p_job uuid) returns boolean language plpgsql set search_path=public,pg_temp as $$
declare job studio_jobs;
begin
 select * into strict job from studio_jobs where id=p_job for update;
 if job.state in ('ready','failed') then return false; end if;
 update studio_jobs set state='failed',reserved_usd_micro=case when job.state in ('review','queued') then 0 else job.reserved_usd_micro end where id=p_job;
 update studio_accounts set credits=credits+job.credits where user_id=job.user_id;
 return true;
end $$;

-- The worker may only send a reviewed job once, on its reserved UTC date.
create function public.studio_claim() returns setof public.studio_jobs language plpgsql set search_path=public,pg_temp set timezone='UTC' as $$
declare cfg studio_control; job studio_jobs;
begin
 select * into strict cfg from studio_control for update;
 for job in select * from studio_jobs where state in ('review','queued') and created_at<date_trunc('day',now()) for update loop
  perform studio_fail(job.id);
 end loop;
 if not cfg.enabled or cfg.quote_expires is null or cfg.quote_expires<=now() then return; end if;
 return query update studio_jobs set state='dispatching' where id=(
  select j.id from studio_jobs j join studio_accounts a on a.user_id=j.user_id where j.state='queued' and a.pilot order by j.created_at limit 1 for update of j
 ) returning *;
end $$;
revoke all on function studio_grant(uuid,text,text,int),studio_reserve(uuid,uuid,text,text,text),studio_fail(uuid),studio_claim() from public,anon,authenticated;
grant execute on function studio_grant(uuid,text,text,int),studio_reserve(uuid,uuid,text,text,text),studio_fail(uuid),studio_claim() to service_role;
create function studio_reject(p_job uuid) returns boolean language plpgsql set search_path=public,pg_temp as $$
begin
 perform 1 from studio_jobs where id=p_job and state in ('review','output_review') for update;
 if not found then raise exception 'STAGE_CHANGED'; end if;
 return studio_fail(p_job);
end $$;
create function studio_overview() returns jsonb language sql stable set timezone='UTC' set search_path=public,pg_temp as $$
 select jsonb_build_object('images',count(*) filter(where kind='image'),'videos',count(*) filter(where kind='video'),
 'failed',count(*) filter(where state='failed'),'uncertain',count(*) filter(where state='uncertain'),
 'day_micro',coalesce(sum(reserved_usd_micro) filter(where created_at>=date_trunc('day',now())),0),
 'month_micro',coalesce(sum(reserved_usd_micro) filter(where created_at>=date_trunc('month',now())),0),
 'lifetime_micro',coalesce(sum(reserved_usd_micro),0)) from studio_jobs
$$;
revoke all on function studio_reject(uuid),studio_overview() from public,anon,authenticated;
grant execute on function studio_reject(uuid),studio_overview() to service_role;
