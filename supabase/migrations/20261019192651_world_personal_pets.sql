-- Permanent, nontradeable room pets; all mutations are server-only and atomic.
create table earnly_world.pet_definitions (
 id text primary key check(id in ('dog','cat','rabbit')), name text not null,
 price bigint not null check(price>0), color text not null
);
insert into earnly_world.pet_definitions values
 ('dog','Cloud Pup',500,'#cc965c'),('cat','Moon Cat',500,'#8c98b2'),('rabbit','Meadow Bunny',350,'#eee0cd');
create table earnly_world.pets (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
 species text not null references earnly_world.pet_definitions(id), name text not null check(length(name) between 1 and 18 and name !~ '[[:cntrl:]]'),
 room_id uuid references earnly_world.rooms(id) on delete set null,
 created_at timestamptz not null default now()
);
create index pets_owner on earnly_world.pets(owner_id,created_at);
create index pets_room on earnly_world.pets(room_id) where room_id is not null;
create table earnly_world.pet_receipts (
 owner_id uuid not null references auth.users(id) on delete cascade, request_id uuid not null,
 species text not null references earnly_world.pet_definitions(id), pet_id uuid not null references earnly_world.pets(id),
 price bigint not null, purchased_coins bigint not null, created_at timestamptz not null default now(),primary key(owner_id,request_id)
);
do $$ declare t text; begin foreach t in array array['pet_definitions','pets','pet_receipts'] loop
 execute format('alter table earnly_world.%I enable row level security',t);
 execute format('revoke all on earnly_world.%I from public,anon,authenticated',t);
 execute format('grant all on earnly_world.%I to service_role',t);
end loop; end $$;

create function public.world_pets(p_actor uuid,p_room uuid,p_action text,p_data jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare d earnly_world.pet_definitions%rowtype; p earnly_world.pets%rowtype; receipt earnly_world.pet_receipts%rowtype; w public.coin_wallets%rowtype; r earnly_world.rooms%rowtype; rid uuid; v_name text;
begin
 if not exists(select 1 from auth.users where id=p_actor and not coalesce(is_anonymous,false) and email_confirmed_at is not null)
 or exists(select 1 from public.leaderboard_bans where user_id=p_actor)
 or exists(select 1 from earnly_world.social_members where user_id=p_actor and suspended_until>now()) then raise exception 'Account unavailable';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_actor::text,174));
 -- Same admission rules as furniture; callers cannot query private rooms via pets.
 perform public.world_room_snapshot(p_actor,p_room);
 if p_action='buy' then
  rid:=(p_data->>'requestId')::uuid;if rid is null then raise exception 'Purchase ID required';end if;
  select * into receipt from earnly_world.pet_receipts where owner_id=p_actor and request_id=rid;
  if found then
   if receipt.species is distinct from p_data->>'species' then raise exception 'Purchase ID reused';end if;
   return to_jsonb(receipt);
  end if;
  select * into d from earnly_world.pet_definitions where id=p_data->>'species';if not found then raise exception 'Pet unavailable';end if;
  select * into w from public.coin_wallets where user_id=p_actor for update;
  if not found or w.purchase_debt>0 then raise exception 'Wallet unavailable';end if;
  if w.balance<d.price then raise exception 'Not enough Arcade Coins';end if;
  if (select count(*) from earnly_world.pets where owner_id=p_actor)>=50 then raise exception 'Pet collection full';end if;
  insert into earnly_world.pets(owner_id,species,name) values(p_actor,d.id,d.name) returning * into p;
  -- Explicit purchased-first spend also works with the existing wallet trigger.
  update public.coin_wallets set balance=balance-d.price,purchased_balance=greatest(0,purchased_balance-d.price),updated_at=now() where user_id=p_actor;
  insert into earnly_world.pet_receipts(owner_id,request_id,species,pet_id,price,purchased_coins)
   values(p_actor,rid,d.id,p.id,d.price,least(w.purchased_balance,d.price)) returning * into receipt;
  return to_jsonb(receipt);
 elsif p_action in ('place','pickup','rename') then
  select * into p from earnly_world.pets where id=(p_data->>'petId')::uuid and owner_id=p_actor for update;
  if not found then raise exception 'Pet unavailable';end if;
  if p.room_id is not null and p.room_id<>p_room then raise exception 'Visit the room containing this pet first';end if;
  if p_action='rename' then
   v_name:=btrim(p_data->>'name');
   if v_name is null or length(v_name) not between 1 and 18 or v_name !~ '^[A-Za-z0-9][A-Za-z0-9 ''-]*$' then raise exception 'Use 1 to 18 letters or numbers for a pet name';end if;
   update earnly_world.pets set name=v_name where id=p.id;
  else
   select * into r from earnly_world.rooms where id=p_room and owner_id=p_actor for update;
   if not found then raise exception 'Only your own room can hold your pets';end if;
   if p_action='place' then
    if p.room_id is null and (select count(*) from earnly_world.pets where room_id=p_room)>=3 then raise exception 'Up to three pets can roam in a room';end if;
    update earnly_world.pets set room_id=p_room where id=p.id;
   else update earnly_world.pets set room_id=null where id=p.id;end if;
  end if;
 else raise exception 'Unknown pet action';end if;
 return jsonb_build_object('ok',true);
end $$;
revoke all on function public.world_pets(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.world_pets(uuid,uuid,text,jsonb) to service_role;

-- Extend the existing read surfaces without changing furniture or commerce behavior.
alter function public.world_api(uuid,text,jsonb) rename to world_api_before_personal_pets;
create function public.world_api(p_actor uuid,p_action text,p_data jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
 result:=public.world_api_before_personal_pets(p_actor,p_action,p_data);
 if p_action='bootstrap' then
  result:=result||jsonb_build_object('petsEnabled',true,
   'petCatalog',(select coalesce(jsonb_agg(to_jsonb(d) order by price,id),'[]') from earnly_world.pet_definitions d),
   'pets',(select coalesce(jsonb_agg(to_jsonb(p) order by created_at,id),'[]') from earnly_world.pets p where owner_id=p_actor));
 end if;return result;
end $$;
revoke all on function public.world_api(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.world_api(uuid,text,jsonb) to service_role;
alter function public.world_room_snapshot(uuid,uuid) rename to world_room_snapshot_before_personal_pets;
create function public.world_room_snapshot(p_actor uuid,p_room uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
 result:=public.world_room_snapshot_before_personal_pets(p_actor,p_room);
 return result||jsonb_build_object('pets',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'ownerId',p.owner_id,'name',p.name,'species',p.species,'color',d.color) order by p.created_at,p.id),'[]') from earnly_world.pets p join earnly_world.pet_definitions d on d.id=p.species where p.room_id=p_room));
end $$;
revoke all on function public.world_room_snapshot(uuid,uuid) from public,anon,authenticated;
grant execute on function public.world_room_snapshot(uuid,uuid) to service_role;
