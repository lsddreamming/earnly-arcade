-- Preserve the original promise for days/tickets already in progress.
-- New days pay 100 per verified session plus 100 on completion (600 maximum).
-- Play allowances and tester status deliberately have no role in eligibility.
insert into public.ad_bonus_days(user_id,day)
 select distinct user_id,day from public.ad_bonus_tickets on conflict do nothing;
alter table public.ad_bonus_days add column per_ad_coins integer not null default 0 check(per_ad_coins between 0 and 100);
alter table public.ad_bonus_days add column completion_coins integer not null default 100 check(completion_coins in (100,250));
alter table public.ad_bonus_days alter column per_ad_coins set default 100;
alter table public.ad_bonus_days alter column completion_coins set default 100;

create or replace function public.ad_bonus_status(p_actor uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare d date:=(now() at time zone 'UTC')::date; w integer; a boolean; per_ad integer; finish integer;
begin
 select watched,awarded,per_ad_coins,completion_coins into w,a,per_ad,finish from public.ad_bonus_days where user_id=p_actor and day=d;
 return jsonb_build_object('enabled',coalesce((select enabled from public.ad_bonus_settings where id),false),'watched',coalesce(w,0),'awarded',coalesce(a,false),'goal',5,'coins',coalesce(per_ad,100)*5+coalesce(finish,100),'perAdCoins',coalesce(per_ad,100),'completionBonus',coalesce(finish,100),'earnedCoins',coalesce(w,0)*coalesce(per_ad,100)+case when coalesce(a,false) then coalesce(finish,100) else 0 end,'day',d,'resetAt',((d+1)::timestamp at time zone 'UTC'));
end $$;

create or replace function public.ad_bonus_complete(p_ticket uuid,p_transaction text,p_ad_unit text,p_rewarded_at timestamptz) returns boolean language plpgsql security invoker set search_path='' as $$
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
 if d.per_ad_coins>0 then
  perform public.apply_coin_ledger_event(t.user_id,'ad-bonus:'||t.day::text||':ad:'||d.watched::text,'ad_bonus','Furniture Boost ad',null,null,null,d.per_ad_coins);
 end if;
 if d.watched=5 then
  perform public.apply_coin_ledger_event(t.user_id,'ad-bonus:'||t.day::text,'ad_bonus','Daily Furniture Boost',null,null,null,100);
  -- Preserve the shared ledger's 100-Coin event limit. All three entries
  -- commit atomically with the receipt and cannot be claimed individually.
  if d.completion_coins=250 then
   perform public.apply_coin_ledger_event(t.user_id,'ad-bonus:'||t.day::text||':finish:2','ad_bonus','Daily Furniture Boost',null,null,null,100);
   perform public.apply_coin_ledger_event(t.user_id,'ad-bonus:'||t.day::text||':finish:3','ad_bonus','Daily Furniture Boost',null,null,null,50);
  end if;
  update public.ad_bonus_days set awarded=true where user_id=t.user_id and day=t.day;
 end if;
 return true;
end $$;
