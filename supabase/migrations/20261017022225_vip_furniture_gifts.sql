-- Additive gift ledger. No prices, wallets or existing purchases are changed.
alter table earnly_world.item_definitions add column vip_only boolean not null default false;
alter table earnly_world.items add column gift_revoked boolean not null default false;
insert into earnly_world.item_definitions(id,name,sprite_id,item_height,price,can_sit,can_stack,tradeable,category,color,vip_only) values
 ('vip-neon-throne','Sovereign Neon Throne','vip-throne',.5,0,true,false,false,'VIP Collection','#b09af2',true),
 ('vip-aurora-fountain','Aurora Crystal Fountain','vip-fountain',1.5,0,false,false,false,'VIP Collection','#79e8dc',true),
 ('vip-lunar-bloom','Lunar Bloom Conservatory','vip-bloom',1.5,0,false,false,false,'VIP Collection','#b4a1f3',true);
create table public.arcade_pass_furniture_awards(
 provider text not null check(provider in ('apple','stripe')),
 transaction_id text not null,subscription_id text not null,
 user_id uuid references auth.users(id) on delete set null,
 period_start timestamptz not null,period_end timestamptz not null,
 definition_id text not null references earnly_world.item_definitions(id),
 item_id uuid references earnly_world.items(id) on delete set null,
 revoked boolean not null default false,created_at timestamptz not null default now(),
 primary key(provider,transaction_id),unique(provider,subscription_id,period_end),
 check(period_end-period_start between interval '27 days' and interval '32 days')
);
alter table public.arcade_pass_furniture_awards enable row level security;
revoke all on public.arcade_pass_furniture_awards from public,anon,authenticated;
grant select,insert,update on public.arcade_pass_furniture_awards to service_role;
create index arcade_pass_furniture_user on public.arcade_pass_furniture_awards(user_id);
create function public.arcade_pass_furniture_award(p_user_id uuid,p_provider text,p_transaction_id text,p_subscription_id text,p_period_start timestamptz,p_period_end timestamptz) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare t public.arcade_pass_transactions%rowtype; a public.arcade_pass_furniture_awards%rowtype; d earnly_world.item_definitions%rowtype; iid uuid; gift text;
begin
 if p_user_id is null or p_provider not in ('apple','stripe') or p_period_start is null or p_period_end is null or p_period_start>now() or p_period_end-p_period_start not between interval '27 days' and interval '32 days' then raise exception 'INVALID_GIFT_PERIOD';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text,174));
 select * into t from public.arcade_pass_transactions where provider=p_provider and transaction_id=p_transaction_id for update;
 if not found or t.user_id is distinct from p_user_id or t.subscription_id is distinct from p_subscription_id or t.expires_at is distinct from p_period_end then raise exception 'VERIFIED_PAYMENT_REQUIRED';end if;
 select * into a from public.arcade_pass_furniture_awards where provider=p_provider and (transaction_id=p_transaction_id or (subscription_id=p_subscription_id and period_end=p_period_end)) for update;
 if found then
  if a.user_id is distinct from p_user_id then raise exception 'TRANSACTION_OWNER_MISMATCH';end if;
  if a.item_id is not null or a.revoked then return to_jsonb(a);end if;
 else
  if t.revoked then raise exception 'PAYMENT_REVOKED';end if;
  -- Explicit three-month rotation, based on the paid period's UTC start month.
  gift:=(array['vip-neon-throne','vip-aurora-fountain','vip-lunar-bloom'])[1+mod(extract(month from p_period_start at time zone 'UTC')::integer-1,3)];
  insert into public.arcade_pass_furniture_awards(provider,transaction_id,subscription_id,user_id,period_start,period_end,definition_id) values(p_provider,p_transaction_id,p_subscription_id,p_user_id,p_period_start,p_period_end,gift) returning * into a;
 end if;

 -- Pending awards survive a full backpack and can be retried without another payment.
 if (select count(*) from earnly_world.items where owner_id=p_user_id and not gift_revoked)>=500 then return to_jsonb(a);end if;
 select * into d from earnly_world.item_definitions where id=a.definition_id and vip_only and not tradeable for update;
 if not found then raise exception 'GIFT_UNAVAILABLE';end if;
 update earnly_world.item_definitions set minted=minted+1 where id=d.id returning * into d;
 insert into earnly_world.items(owner_id,definition_id,serial,origin) values(p_user_id,d.id,d.minted,'earned') returning id into iid;
 update public.arcade_pass_furniture_awards set item_id=iid where provider=a.provider and transaction_id=a.transaction_id returning * into a;
 return to_jsonb(a);
end $$;
create function public.arcade_pass_furniture_revoke(p_user_id uuid,p_provider text,p_transaction_id text) returns void
language plpgsql security invoker set search_path='' as $$
declare a public.arcade_pass_furniture_awards%rowtype; rid uuid;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text,174));
 if not exists(select 1 from public.arcade_pass_transactions where provider=p_provider and transaction_id=p_transaction_id and user_id=p_user_id and revoked) then raise exception 'VERIFIED_REVOCATION_REQUIRED';end if;
 update public.arcade_pass_furniture_awards set revoked=true where provider=p_provider and user_id=p_user_id and (transaction_id=p_transaction_id or (subscription_id,period_end) in (select subscription_id,expires_at from public.arcade_pass_transactions where provider=p_provider and transaction_id=p_transaction_id and user_id=p_user_id)) returning * into a;
 if a.item_id is not null then
  select room_id into rid from earnly_world.items where id=a.item_id;
  update earnly_world.items set gift_revoked=true,room_id=null where id=a.item_id and owner_id=p_user_id;
  update earnly_world.rooms set revision=revision+1,updated_at=now() where id=rid;
 end if;
end $$;
revoke all on function public.arcade_pass_furniture_award(uuid,text,text,text,timestamptz,timestamptz),public.arcade_pass_furniture_revoke(uuid,text,text) from public,anon,authenticated;
grant execute on function public.arcade_pass_furniture_award(uuid,text,text,text,timestamptz,timestamptz),public.arcade_pass_furniture_revoke(uuid,text,text) to service_role;
-- Preserve the existing API and privileges; add guards at the existing boundaries.
do $patch$
declare source text:=pg_get_functiondef('public.world_api(uuid,text,jsonb)'::regprocedure);
begin
 if strpos(source,'if w.balance<d.price')=0 or strpos(source,'where owner_id=p_actor order by created_at desc limit 500')=0 then raise exception 'Unexpected World API';end if;
 source:=replace(source,'where owner_id=p_actor)>=500','where owner_id=p_actor and not gift_revoked)>=500');
 source:=replace(source,'if w.balance<d.price', 'if d.vip_only then raise exception ''VIP_GIFT_ONLY'';end if; if w.balance<d.price');
 source:=replace(source,'where owner_id=p_actor order by created_at desc limit 500','where owner_id=p_actor and not gift_revoked order by created_at desc limit 500');
 source:=replace(source,'and owner_id=p_actor and (room_id is null or room_id=r.id)','and owner_id=p_actor and not gift_revoked and (room_id is null or room_id=r.id)');
 execute source;
end $patch$;

create function public.arcade_pass_furniture_me(p_user_id uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare a public.arcade_pass_furniture_awards%rowtype;
begin
 for a in select * from public.arcade_pass_furniture_awards where user_id=p_user_id and item_id is null and not revoked order by created_at limit 50 loop
  perform public.arcade_pass_furniture_award(a.user_id,a.provider,a.transaction_id,a.subscription_id,a.period_start,a.period_end);
 end loop;
 return (select coalesce(jsonb_agg(jsonb_build_object('name',d.name,'definitionId',a.definition_id,'delivered',a.item_id is not null,'revoked',a.revoked,'periodStart',a.period_start) order by a.period_start desc),'[]') from public.arcade_pass_furniture_awards a join earnly_world.item_definitions d on d.id=a.definition_id where a.user_id=p_user_id);
end $$;
revoke all on function public.arcade_pass_furniture_me(uuid) from public,anon,authenticated;
grant execute on function public.arcade_pass_furniture_me(uuid) to service_role;
