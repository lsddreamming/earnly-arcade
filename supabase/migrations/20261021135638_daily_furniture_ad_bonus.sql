-- Only Google's verified receipts can advance the daily furniture bonus.
create table public.ad_bonus_settings(id boolean primary key default true check(id), enabled boolean not null default false);
insert into public.ad_bonus_settings(id) values(true);
create table public.ad_bonus_days(user_id uuid references auth.users(id) on delete cascade, day date not null, watched integer not null default 0 check(watched between 0 and 5), awarded boolean not null default false, primary key(user_id,day));
create table public.ad_bonus_tickets(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,day date not null,placement text not null check(placement in('extraPlays','bonusCoins')),created_at timestamptz not null default now(),consumed boolean not null default false);
create index ad_bonus_tickets_user_day on public.ad_bonus_tickets(user_id,day);
create table public.ad_bonus_receipts(transaction_id text primary key,ticket_id uuid not null unique references public.ad_bonus_tickets(id) on delete cascade,ad_unit text not null,rewarded_at timestamptz not null);
alter table public.ad_bonus_settings enable row level security;
alter table public.ad_bonus_days enable row level security;
alter table public.ad_bonus_tickets enable row level security;
alter table public.ad_bonus_receipts enable row level security;
revoke all on public.ad_bonus_settings,public.ad_bonus_days,public.ad_bonus_tickets,public.ad_bonus_receipts from public,anon,authenticated;
grant all on public.ad_bonus_settings,public.ad_bonus_days,public.ad_bonus_tickets,public.ad_bonus_receipts to service_role;
alter table public.coin_ledger drop constraint coin_ledger_source_type_check;
alter table public.coin_ledger add constraint coin_ledger_source_type_check check(source_type in('game','daily_bonus','daily_challenge','legacy_seed','world_mission','ad_bonus'));

create function public.ad_bonus_status(p_actor uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare d date:=(now() at time zone 'UTC')::date; w integer; a boolean;
begin
 select watched,awarded into w,a from public.ad_bonus_days where user_id=p_actor and day=d;
 return jsonb_build_object('enabled',coalesce((select enabled from public.ad_bonus_settings where id),false),'watched',coalesce(w,0),'awarded',coalesce(a,false),'goal',5,'coins',100,'day',d,'resetAt',((d+1)::timestamp at time zone 'UTC'));
end $$;

create function public.ad_bonus_ticket(p_actor uuid,p_placement text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare d date:=(now() at time zone 'UTC')::date; token uuid; s jsonb;
begin
 if p_actor is null or p_placement not in('extraPlays','bonusCoins') then raise exception 'INVALID_REQUEST'; end if;
 perform pg_advisory_xact_lock(hashtextextended('ad-bonus:'||p_actor::text,0));
 s:=public.ad_bonus_status(p_actor);
 if not (s->>'enabled')::boolean or (s->>'awarded')::boolean then return s;end if;
 if (select count(*) from public.ad_bonus_tickets where user_id=p_actor and created_at>now()-interval '1 minute')>=3 or (select count(*) from public.ad_bonus_tickets where user_id=p_actor and day=d)>=30 then raise exception 'TRY_LATER';end if;
 insert into public.ad_bonus_tickets(user_id,day,placement) values(p_actor,d,p_placement) returning id into token;
 return s||jsonb_build_object('ticket',token);
end $$;

create function public.ad_bonus_complete(p_ticket uuid,p_transaction text,p_ad_unit text,p_rewarded_at timestamptz) returns boolean language plpgsql security invoker set search_path='' as $$
declare t public.ad_bonus_tickets; d public.ad_bonus_days;
begin
 if p_transaction is null or length(p_transaction) not between 1 and 128 then raise exception 'INVALID_TRANSACTION';end if;
 select * into t from public.ad_bonus_tickets where id=p_ticket for update;
 if not found then return false;end if;
 if t.consumed then return true;end if;
 if p_rewarded_at is null or p_rewarded_at<t.created_at-interval '1 minute' or p_rewarded_at>t.created_at+interval '1 hour' then return false;end if;
 if p_ad_unit not in ('ca-app-pub-8864401806510610/8249888009','ca-app-pub-8864401806510610/1831908609') then return false;end if;
 if (t.placement='bonusCoins' and p_ad_unit<>'ca-app-pub-8864401806510610/1831908609') or (t.placement='extraPlays' and p_ad_unit<>'ca-app-pub-8864401806510610/8249888009') then return false;end if;
 insert into public.ad_bonus_receipts(transaction_id,ticket_id,ad_unit,rewarded_at) values(p_transaction,t.id,p_ad_unit,p_rewarded_at) on conflict do nothing;
 if not found then return false;end if;
 update public.ad_bonus_tickets set consumed=true where id=t.id;
 insert into public.ad_bonus_days(user_id,day) values(t.user_id,t.day) on conflict do nothing;
 select * into d from public.ad_bonus_days where user_id=t.user_id and day=t.day for update;
 if d.awarded then return true;end if;
 update public.ad_bonus_days set watched=least(5,watched+1) where user_id=t.user_id and day=t.day returning * into d;
 if d.watched=5 then
  perform public.apply_coin_ledger_event(t.user_id,'ad-bonus:'||t.day::text,'ad_bonus','Daily Furniture Boost',null,null,null,100);
  update public.ad_bonus_days set awarded=true where user_id=t.user_id and day=t.day;
 end if;
 return true;
end $$;
revoke all on function public.ad_bonus_status(uuid),public.ad_bonus_ticket(uuid,text),public.ad_bonus_complete(uuid,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.ad_bonus_status(uuid),public.ad_bonus_ticket(uuid,text),public.ad_bonus_complete(uuid,text,text,timestamptz) to service_role;
