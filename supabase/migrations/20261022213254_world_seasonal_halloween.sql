-- Annual UTC offers; ownership, placement and snapshots remain year-round.
alter table earnly_world.item_definitions add column if not exists season text
 check (season is null or season = 'halloween');
create or replace function earnly_world.season_available(p_season text,p_at timestamptz default now())
returns boolean language sql stable security invoker set search_path = '' as $$
 select case when p_season is null then true when p_season = 'halloween' then
 (extract(month from p_at at time zone 'UTC') * 100 + extract(day from p_at at time zone 'UTC')) between 1001 and 1102
 else false end;
$$;
revoke all on function earnly_world.season_available(text,timestamptz) from public, anon, authenticated;
grant execute on function earnly_world.season_available(text,timestamptz) to service_role;
insert into earnly_world.item_definitions (id,name,sprite_id,price,color,width,length,category,item_height,can_sit,can_lay,can_stack,walkable,tradeable,supply_limit,minted,season) values
 ('halloween-lantern','Lantern Grin Pumpkin','season-lantern',100,'#f5a34c',1,1,'Halloween',1,false,false,false,false,true,null,0,'halloween'),
 ('halloween-patch','Harvest Pumpkin Patch','season-patch',180,'#dc8f47',2,2,'Halloween',0.5,false,false,false,false,true,null,0,'halloween'),
 ('halloween-ghost','Friendly Lantern Ghost','season-ghost',140,'#b8dbd3',1,1,'Halloween',1.5,false,false,false,false,true,null,0,'halloween'),
 ('halloween-memorial','Sleepy Skeleton Memorial','season-memorial',160,'#9f9ab5',1,1,'Halloween',1.5,false,false,false,false,true,null,0,'halloween'),
 ('halloween-cauldron','Bubblebrew Cauldron','season-cauldron',220,'#a68bc5',1,1,'Halloween',1,false,false,false,false,true,null,0,'halloween'),
 ('halloween-flame','Violet Wisp Flame','season-flame',90,'#b28be8',1,1,'Halloween',1,false,false,false,false,true,null,0,'halloween'),
 ('halloween-mirror','Moonface Haunted Mirror','season-mirror',200,'#a18abe',1,1,'Halloween',2,false,false,false,false,true,null,0,'halloween'),
 ('halloween-tub','Batwing Bubble Bath','season-tub',260,'#a18abe',1,2,'Halloween',1,false,false,false,false,true,null,0,'halloween'),
 ('halloween-web','Silver Cobweb Mat','season-web',60,'#bdb1cf',1,1,'Halloween',0.25,false,false,true,true,true,null,0,'halloween'),
 ('home-computer','Retro Desktop Computer','home-computer',180,'#8db7b1',1,1,'Home Essentials',1.5,false,false,false,false,true,null,0,null),
 ('home-medicine','Mint Medicine Cabinet','home-medicine',130,'#8db7b1',1,1,'Home Essentials',1.5,false,false,false,false,true,null,0,null)
on conflict (id) do nothing;
-- Patch the current function, retaining later color/VIP/idempotency protections.
-- All definitions stay in bootstrap so Backpacks and saved rooms can resolve them.
do $patch$
declare body text; target regprocedure:=coalesce(to_regprocedure('public.world_api_before_personal_pets(uuid,text,jsonb)'),to_regprocedure('public.world_api(uuid,text,jsonb)'));
begin
 select pg_get_functiondef(target) into body;
 if position('seasonal_shop_v1' in body)=0 then
  if position('jsonb_agg(to_jsonb(c) order by category,price)' in body)=0 or
     position('if w.balance<d.price then' in body)=0 then
   raise exception 'Seasonal shop migration: world_api anchors changed';
  end if;
  body:=replace(body,'jsonb_agg(to_jsonb(c) order by category,price)',
    'jsonb_agg(to_jsonb(c) || jsonb_build_object(''shop_available'',earnly_world.season_available(c.season)) order by category,price)');
  body:=replace(body,'if w.balance<d.price then',
    '-- seasonal_shop_v1: receipt replay precedes eligibility; new buys use server time.
   if not earnly_world.season_available(d.season) then raise exception ''This seasonal item returns October 1'';end if;
   if w.balance<d.price then');
  execute body;
 end if;
end;
$patch$;
