-- World economy and social persistence. All writes are service-only.
alter table earnly_world.item_definitions add column category text not null default 'Essentials', add column color text not null default '#4fe6d3', add column available_from timestamptz, add column available_until timestamptz;
alter table earnly_world.rooms add column updated_at timestamptz not null default now(), add column public_items jsonb not null default '[]' check(jsonb_typeof(public_items)='array');
create table earnly_world.purchase_receipts (user_id uuid not null references auth.users(id) on delete cascade,request_id uuid not null,definition_id text not null references earnly_world.item_definitions(id),item_id uuid not null,price bigint not null,purchased_coins bigint not null default 0,created_at timestamptz not null default now(),primary key(user_id,request_id));
create table earnly_world.social_members(user_id uuid primary key references auth.users(id) on delete cascade,accepted_at timestamptz,suspended_until timestamptz,last_sent timestamptz);
create table earnly_world.friends(requester uuid not null references auth.users(id) on delete cascade,recipient uuid not null references auth.users(id) on delete cascade,accepted boolean not null default false,created_at timestamptz not null default now(),primary key(requester,recipient),check(requester<>recipient));
create unique index world_friend_pair on earnly_world.friends(least(requester,recipient),greatest(requester,recipient));
create index on earnly_world.friends(recipient);
create table earnly_world.blocks(user_id uuid not null references auth.users(id) on delete cascade,blocked_id uuid not null references auth.users(id) on delete cascade,primary key(user_id,blocked_id),check(user_id<>blocked_id));
create index on earnly_world.blocks(blocked_id);
create table earnly_world.messages(id uuid primary key default gen_random_uuid(),sender uuid not null references auth.users(id) on delete cascade,request_id uuid not null,room_id uuid references earnly_world.rooms(id) on delete cascade,recipient uuid references auth.users(id) on delete cascade,mode text not null check(mode in ('normal','shout','whisper','private')),body text not null check(length(body) between 1 and 280),viewers uuid[] not null default '{}',hidden boolean not null default false,created_at timestamptz not null default now(),unique(sender,request_id),check((mode='private' and recipient is not null and room_id is null) or (mode<>'private' and room_id is not null)));
create index on earnly_world.messages(sender,created_at desc);
create index on earnly_world.messages(recipient,created_at desc);
create index on earnly_world.messages(room_id,created_at desc);
create table earnly_world.reports(message_id uuid not null references earnly_world.messages(id) on delete cascade,reporter uuid not null references auth.users(id) on delete cascade,reason text not null check(reason in ('spam','harassment','unsafe','other')),resolved boolean not null default false,created_at timestamptz not null default now(),primary key(message_id,reporter));
create index on earnly_world.reports(reporter);
create index on earnly_world.reports(created_at) where not resolved;
do $$ declare t text; begin foreach t in array array['purchase_receipts','social_members','friends','blocks','messages','reports'] loop execute format('alter table earnly_world.%I enable row level security',t); execute format('revoke all on earnly_world.%I from public,anon,authenticated',t);execute format('grant all on earnly_world.%I to service_role',t);end loop;end $$;

insert into earnly_world.item_definitions(id,name,sprite_id,item_height,price,width,length,can_sit,can_lay,can_stack,walkable,category,color,supply_limit) values
('mint-sofa','Mint Cloud Sofa','sofa',.5,180,2,1,true,false,false,false,'Neon Living','#59dcc5',null),
('rose-sofa','Rose Cloud Sofa','sofa',.5,180,2,1,true,false,false,false,'Neon Living','#f599bd',null),
('arcade-chair','Arcade Chair','chair',.5,60,1,1,true,false,false,false,'Essentials','#799ff5',null),
('low-table','Orbit Table','table',.5,80,1,1,false,false,true,false,'Essentials','#e1b786',null),
('fern','Moon Fern','plant',1,70,1,1,false,false,false,false,'Garden','#64c786',null),
('neon-lamp','Neon Tube Lamp','lamp',1.5,90,1,1,false,false,false,false,'Neon Living','#c293f3',null),
('arcade-cabinet','Pocket Arcade Cabinet','arcade',1.5,450,1,1,false,false,false,false,'Arcade','#f6c35e',null),
('cloud-bed','Cloud Bed','bed',.5,250,1,2,false,true,false,false,'Essentials','#8cbbf4',null),
('mint-rug','Mint Tile Rug','rug',.25,40,2,2,false,false,true,true,'Essentials','#61bfbb',null),
('display-plinth','Display Plinth','plinth',.5,100,1,1,false,false,true,false,'Collectors','#8595b4',null),
('star-trophy','First Light Trophy','trophy',1,600,1,1,false,false,false,false,'Collectors','#f8d46a',250),
('pixel-speaker','Pulse Speaker','speaker',1,120,1,1,false,false,true,false,'Arcade','#c397f1',null);
insert into earnly_world.rooms(name,heightmap,access_type,max_users) values('Earnly Plaza',E'000000000000\n000000000000\n000000000000\n000000000000\n000000000000\n000000000000\n000000000000\n000000000000\n000000000000\n000000000000\n000000000000\n000000000000','open',40);

-- Server-owned public props have no player owner and can never enter trades.
update earnly_world.rooms set public_items='[{"id":"plaza-prop-0","definitionId":"mint-sofa","name":"Mint Sofa","sprite":"sofa","color":"#59dcc5","x":2,"y":2,"z":0,"width":2,"length":1,"itemHeight":0.5,"rotation":0,"walkable":false,"canStack":false,"canSit":true,"canLay":false},{"id":"plaza-prop-1","definitionId":"rose-sofa","name":"Rose Sofa","sprite":"sofa","color":"#f599bd","x":7,"y":2,"z":0,"width":2,"length":1,"itemHeight":0.5,"rotation":0,"walkable":false,"canStack":false,"canSit":true,"canLay":false},{"id":"plaza-prop-2","definitionId":"low-table","name":"Low Table","sprite":"table","color":"#e1b786","x":4,"y":3,"z":0,"width":1,"length":1,"itemHeight":0.5,"rotation":0,"walkable":false,"canStack":false,"canSit":false,"canLay":false},{"id":"plaza-prop-3","definitionId":"fern","name":"Fern","sprite":"plant","color":"#64c786","x":1,"y":1,"z":0,"width":1,"length":1,"itemHeight":1,"rotation":0,"walkable":false,"canStack":false,"canSit":false,"canLay":false},{"id":"plaza-prop-4","definitionId":"fern","name":"Fern","sprite":"plant","color":"#64c786","x":10,"y":1,"z":0,"width":1,"length":1,"itemHeight":1,"rotation":0,"walkable":false,"canStack":false,"canSit":false,"canLay":false},{"id":"plaza-prop-5","definitionId":"neon-lamp","name":"Neon Lamp","sprite":"lamp","color":"#c293f3","x":5,"y":1,"z":0,"width":1,"length":1,"itemHeight":1.5,"rotation":0,"walkable":false,"canStack":false,"canSit":false,"canLay":false},{"id":"plaza-prop-6","definitionId":"arcade-cabinet","name":"Arcade Cabinet","sprite":"arcade","color":"#f6c35e","x":2,"y":7,"z":0,"width":1,"length":1,"itemHeight":1.5,"rotation":0,"walkable":false,"canStack":false,"canSit":false,"canLay":false},{"id":"plaza-prop-7","definitionId":"pixel-speaker","name":"Pixel Speaker","sprite":"speaker","color":"#c397f1","x":9,"y":7,"z":0,"width":1,"length":1,"itemHeight":1,"rotation":0,"walkable":false,"canStack":false,"canSit":false,"canLay":false},{"id":"plaza-prop-8","definitionId":"arcade-chair","name":"Arcade Chair","sprite":"chair","color":"#799ff5","x":7,"y":5,"z":0,"width":1,"length":1,"itemHeight":0.5,"rotation":0,"walkable":false,"canStack":false,"canSit":true,"canLay":false}]'::jsonb where owner_id is null and name='Earnly Plaza';

create function public.world_api(p_actor uuid,p_action text,p_data jsonb default '{}') returns jsonb language plpgsql security invoker set search_path='' as $$
declare d earnly_world.item_definitions%rowtype; w public.coin_wallets%rowtype; receipt earnly_world.purchase_receipts%rowtype; r earnly_world.rooms%rowtype; m earnly_world.social_members%rowtype; msg earnly_world.messages%rowtype; target uuid; rid uuid; iid uuid; result jsonb; body text; v_mode text; viewers uuid[]; n integer;
begin
 if not exists(select 1 from auth.users where id=p_actor and not coalesce(is_anonymous,false) and email_confirmed_at is not null) or exists(select 1 from public.leaderboard_bans where user_id=p_actor) then raise exception 'Account unavailable';end if;
 -- Per-player serialization protects purchase receipts, message quotas and room creation.
 perform pg_advisory_xact_lock(hashtextextended(p_actor::text,174));
 if exists(select 1 from earnly_world.social_members where user_id=p_actor and suspended_until>now()) then raise exception 'World access suspended';end if;
 if p_action='bootstrap' then
   return jsonb_build_object('balance',coalesce((select balance::text from public.coin_wallets where user_id=p_actor),'0'),
   'catalog',(select coalesce(jsonb_agg(to_jsonb(c) order by category,price),'[]') from earnly_world.item_definitions c),
   'rooms',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'ownerId',owner_id,'access',access_type,'revision',revision) order by created_at),'[]') from (select * from earnly_world.rooms where access_type='open' or owner_id=p_actor order by created_at limit 100) q),
   'items',(select coalesce(jsonb_agg(to_jsonb(i) order by created_at desc),'[]') from (select * from earnly_world.items where owner_id=p_actor order by created_at desc limit 500) i),
   'chatAccepted',exists(select 1 from earnly_world.social_members where user_id=p_actor and accepted_at is not null),
   'friends',(select coalesce(jsonb_agg(jsonb_build_object('userId',p.user_id,'username',p.username,'accepted',f.accepted,'incoming',f.recipient=p_actor)),'[]') from earnly_world.friends f join public.profiles p on p.user_id=case when f.requester=p_actor then f.recipient else f.requester end where (f.requester=p_actor or f.recipient=p_actor) and not exists(select 1 from earnly_world.blocks b where (b.user_id=p_actor and b.blocked_id=p.user_id) or (b.blocked_id=p_actor and b.user_id=p.user_id))));
 elsif p_action='create_room' then
   if (select count(*) from earnly_world.rooms where owner_id=p_actor)>=3 then raise exception 'You can own up to three rooms';end if;
   body:=btrim(p_data->>'name');if body is null or length(body) not between 1 and 40 or body~'[[:cntrl:]]' then raise exception 'Choose a room name';end if;
   insert into earnly_world.rooms(owner_id,name,heightmap,access_type) values(p_actor,body,E'00000000\n00000000\n00000000\n00000000\n00000000\n00000000\n00000000\n00000000','closed') returning * into r;
   return jsonb_build_object('roomId',r.id);
 elsif p_action='room_access' then
   if p_data->>'access' not in ('open','closed') then raise exception 'Invalid room access';end if;
   update earnly_world.rooms set access_type=p_data->>'access',updated_at=now() where id=(p_data->>'roomId')::uuid and owner_id=p_actor;
   if not found then raise exception 'Room unavailable';end if;
 elsif p_action='buy' then
   rid:=(p_data->>'requestId')::uuid;if rid is null then raise exception 'Purchase ID required';end if;
   select * into receipt from earnly_world.purchase_receipts where user_id=p_actor and request_id=rid;
   if found then if receipt.definition_id<>p_data->>'definitionId' then raise exception 'Purchase ID reused';end if;return to_jsonb(receipt);end if;
   select * into w from public.coin_wallets where user_id=p_actor for update;
   if not found or w.purchase_debt>0 then raise exception 'Wallet unavailable';end if;
   select * into d from earnly_world.item_definitions where id=p_data->>'definitionId' for update;
   if not found or (d.available_from is not null and now()<d.available_from) or (d.available_until is not null and now()>=d.available_until) or (d.supply_limit is not null and d.minted>=d.supply_limit) then raise exception 'Item unavailable';end if;
   if w.balance<d.price then raise exception 'Not enough Arcade Coins';end if;
   if (select count(*) from earnly_world.items where owner_id=p_actor)>=500 then raise exception 'Backpack full';end if;
   update earnly_world.item_definitions set minted=minted+1 where id=d.id returning * into d;
   insert into earnly_world.items(owner_id,definition_id,serial,origin) values(p_actor,d.id,d.minted,'catalog') returning id into iid;
   update public.coin_wallets set balance=balance-d.price,updated_at=now() where user_id=p_actor;
   insert into earnly_world.purchase_receipts(user_id,request_id,definition_id,item_id,price,purchased_coins) values(p_actor,rid,d.id,iid,d.price,least(w.purchased_balance,d.price)) returning * into receipt;
   return to_jsonb(receipt);
 elsif p_action='place' then
   -- Geometry is validated by the authoritative worker before this conditional commit.
   select * into r from earnly_world.rooms where id=(p_data->>'roomId')::uuid and owner_id=p_actor for update;
   if not found or r.revision<>(p_data->>'revision')::bigint then raise exception 'Room changed';end if;
   select id into iid from earnly_world.items where id=(p_data->>'itemId')::uuid and owner_id=p_actor and (room_id is null or room_id=r.id) for update;
   if not found then raise exception 'Item unavailable';end if;
   if exists(select 1 from earnly_world.trade_items ti join earnly_world.trades t on t.id=ti.trade_id where ti.item_id=iid and t.status='open' and t.expires_at>now() and (t.locked_a or t.locked_b)) then raise exception 'Unlock the trade before placing this item';end if;
   if coalesce((p_data->>'pickup')::boolean,false) then update earnly_world.items set room_id=null,x=null,y=null,z=null where id=iid;
   else update earnly_world.items set room_id=r.id,x=(p_data->>'x')::int,y=(p_data->>'y')::int,z=(p_data->>'z')::numeric,rotation=(p_data->>'rotation')::int where id=iid;end if;
   update earnly_world.rooms set revision=revision+1,updated_at=now() where id=r.id;
 elsif p_action='accept_chat' then
   insert into earnly_world.social_members(user_id,accepted_at) values(p_actor,now()) on conflict(user_id) do update set accepted_at=now();
 elsif p_action in ('friend_request','friend_accept','friend_remove','block') then
   if p_action='friend_request' then select user_id into target from public.profiles where lower(username)=lower(btrim(p_data->>'username'));else target:=(p_data->>'userId')::uuid;end if;
   if target is null or target=p_actor or not exists(select 1 from auth.users where id=target and not coalesce(is_anonymous,false)) then raise exception 'Player unavailable';end if;
   if p_action='block' then
     if (select count(*) from earnly_world.blocks where user_id=p_actor)>=200 then raise exception 'Block list full';end if;
     insert into earnly_world.blocks values(p_actor,target) on conflict do nothing;
     delete from earnly_world.friends where (requester=p_actor and recipient=target) or (requester=target and recipient=p_actor);
   elsif p_action='friend_remove' then delete from earnly_world.friends where (requester=p_actor and recipient=target) or (requester=target and recipient=p_actor);
   else
     if exists(select 1 from earnly_world.blocks where (user_id=p_actor and blocked_id=target) or (user_id=target and blocked_id=p_actor)) then raise exception 'Player unavailable';end if;
     if p_action='friend_accept' then update earnly_world.friends set accepted=true where requester=target and recipient=p_actor;
     else
       if (select count(*) from earnly_world.friends where requester=p_actor or recipient=p_actor)>=100 then raise exception 'Friends list full';end if;
       insert into earnly_world.friends(requester,recipient) values(p_actor,target) on conflict do nothing;
     end if;
   end if;
 elsif p_action in ('say','private_send') then
   select * into m from earnly_world.social_members where user_id=p_actor for update;
   if not found or m.accepted_at is null then raise exception 'Accept the chat rules first';end if;
   rid:=(p_data->>'requestId')::uuid;if rid is null then raise exception 'Message ID required';end if;
   select * into msg from earnly_world.messages where sender=p_actor and request_id=rid;
   if found then return jsonb_build_object('duplicate',true,'id',msg.id);end if;
   if m.last_sent>now()-interval '5 seconds' or (select count(*) from earnly_world.messages where sender=p_actor and created_at>now()-interval '10 minutes')>=30 then raise exception 'Please slow down';end if;
   body:=btrim(regexp_replace(coalesce(p_data->>'text',''),'[[:space:]]+',' ','g'));
   if length(body) not between 1 and 280 or body~'[[:cntrl:]]' or body~*'(https?://|www\.|[[:alnum:]]+@[[:alnum:]]+\.|\m(fuck|shit|nigger|faggot)\M)' or body~'[​‌‍‎‏‪-‮⁠⁦-⁩]' then raise exception 'Please edit that message';end if;
   if p_action='private_send' then
     target:=(p_data->>'userId')::uuid;
     if not exists(select 1 from earnly_world.friends where accepted and ((requester=p_actor and recipient=target) or (requester=target and recipient=p_actor))) then raise exception 'Private messages are for accepted friends';end if;
     if exists(select 1 from earnly_world.blocks where (user_id=p_actor and blocked_id=target) or (user_id=target and blocked_id=p_actor)) then raise exception 'Player unavailable';end if;
     insert into earnly_world.messages(sender,request_id,recipient,mode,body,viewers) values(p_actor,rid,target,'private',body,array[p_actor,target]) returning * into msg;
   else
     -- Target viewers are selected by server-side room positions, never supplied directly by a browser.
     v_mode:=p_data->>'mode';if v_mode not in ('normal','shout','whisper') then raise exception 'Invalid chat mode';end if;
     select array_agg(v::uuid) into viewers from jsonb_array_elements_text(p_data->'viewers') v;
     if coalesce(cardinality(viewers),0)>100 or not p_actor=any(viewers) then raise exception 'Invalid recipients';end if;
     select array_agg(v) into viewers from unnest(viewers) v where not exists(select 1 from earnly_world.blocks where (user_id=p_actor and blocked_id=v) or (user_id=v and blocked_id=p_actor));
     insert into earnly_world.messages(sender,request_id,room_id,mode,body,viewers) values(p_actor,rid,(p_data->>'roomId')::uuid,v_mode,body,viewers) returning * into msg;
   end if;
   update earnly_world.social_members set last_sent=now() where user_id=p_actor;
   return jsonb_build_object('id',msg.id,'text',msg.body,'viewers',msg.viewers,'mode',msg.mode,'userId',msg.sender);
 elsif p_action='private_feed' then
   target:=(p_data->>'userId')::uuid;
   if not exists(select 1 from earnly_world.friends where accepted and ((requester=p_actor and recipient=target) or (requester=target and recipient=p_actor))) then raise exception 'Player unavailable';end if;
   if exists(select 1 from earnly_world.blocks where (user_id=p_actor and blocked_id=target) or (user_id=target and blocked_id=p_actor)) then raise exception 'Player unavailable';end if;
   return (select coalesce(jsonb_agg(to_jsonb(q) order by created_at),'[]') from (select dm.id,dm.sender,dm.body,dm.created_at from earnly_world.messages dm where mode='private' and not hidden and ((sender=p_actor and recipient=target) or (sender=target and recipient=p_actor)) order by created_at desc limit 50) q);
 elsif p_action='report' then
   iid:=(p_data->>'messageId')::uuid;
   if not exists(select 1 from earnly_world.messages report_message where id=iid and p_actor=any(report_message.viewers)) then raise exception 'Message unavailable';end if;
   insert into earnly_world.reports(message_id,reporter,reason) values(iid,p_actor,p_data->>'reason') on conflict do nothing;
 elsif p_action='trade_create' then
   target:=(p_data->>'userId')::uuid;
   if target=p_actor or target is null or not exists(select 1 from auth.users where id=target and not coalesce(is_anonymous,false)) then raise exception 'Player unavailable';end if;
   if exists(select 1 from earnly_world.blocks where (user_id=p_actor and blocked_id=target) or (user_id=target and blocked_id=p_actor)) then raise exception 'Player unavailable';end if;
   if (select count(*) from earnly_world.trades where status='open' and expires_at>now() and (player_a=p_actor or player_b=p_actor))>=3 then raise exception 'Finish or cancel your existing trades';end if;
   insert into earnly_world.trades(player_a,player_b) values(p_actor,target) returning id into iid;
   return jsonb_build_object('id',iid,'revision',0,'playerA',p_actor,'playerB',target,'status','open','offers','[]'::jsonb);
 elsif p_action='trade_read' then
   return (select to_jsonb(t)||jsonb_build_object('offers',coalesce((select jsonb_agg(jsonb_build_object('userId',o.offered_by,'itemId',o.item_id,'name',catalog_def.name)) from earnly_world.trade_items o left join earnly_world.items i on i.id=o.item_id left join earnly_world.item_definitions catalog_def on catalog_def.id=i.definition_id where o.trade_id=t.id),'[]')) from earnly_world.trades t where id=(p_data->>'tradeId')::uuid and p_actor in(player_a,player_b));
 else raise exception 'Unknown action';end if;
 return jsonb_build_object('ok',true);
end $$;
revoke all on function public.world_api(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.world_api(uuid,text,jsonb) to service_role;

create function public.world_moderate(p_action text,p_id uuid,p_hours integer default 24) returns jsonb language plpgsql security invoker set search_path='' as $$
begin
 if p_action='queue' then return(select coalesce(jsonb_agg(to_jsonb(q)),'[]') from(select r.*,m.body,m.sender from earnly_world.reports r join earnly_world.messages m on m.id=r.message_id where not r.resolved order by r.created_at limit 100) q);
 elsif p_action='remove' then update earnly_world.messages set hidden=true where id=p_id;update earnly_world.reports set resolved=true where message_id=p_id;
 elsif p_action='suspend' then insert into earnly_world.social_members(user_id,suspended_until) values(p_id,now()+make_interval(hours=>least(720,greatest(1,p_hours)))) on conflict(user_id) do update set suspended_until=excluded.suspended_until;
 elsif p_action='restore' then update earnly_world.social_members set suspended_until=null where user_id=p_id;
 elsif p_action='prune' then delete from earnly_world.messages where created_at<now()-interval '30 days' and not exists(select 1 from earnly_world.reports where message_id=messages.id and not resolved);
 else raise exception 'Unknown moderation action';end if;return jsonb_build_object('ok',true);
end $$;
revoke all on function public.world_moderate(text,uuid,integer) from public,anon,authenticated;
grant execute on function public.world_moderate(text,uuid,integer) to service_role;

create or replace function public.world_room_snapshot(p_actor uuid,p_room uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare r earnly_world.rooms%rowtype; player_name text;
begin
 if not exists(select 1 from auth.users where id=p_actor and not coalesce(is_anonymous,false) and email_confirmed_at is not null)
 or exists(select 1 from public.leaderboard_bans where user_id=p_actor) or exists(select 1 from earnly_world.social_members where user_id=p_actor and suspended_until>now()) then raise exception 'Account unavailable'; end if;
 select username into player_name from public.profiles where user_id=p_actor;
 if player_name is null then raise exception 'Profile required'; end if;
 select * into r from earnly_world.rooms where id=p_room;
 if not found or (r.owner_id is distinct from p_actor and r.access_type<>'open') then raise exception 'Room unavailable'; end if;
 return jsonb_build_object('roomId',r.id,'name',r.name,'ownerId',r.owner_id,'access',r.access_type,'equipped',public.cosmetic_loadout_json(p_actor),'username',player_name,'heightmap',r.heightmap,'revision',r.revision,'capacity',r.max_users,
 'items',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'x',i.x,'y',i.y,'z',i.z,'rotation',i.rotation,
 'definitionId',d.id,'name',d.name,'sprite',d.sprite_id,'color',d.color,'width',d.width,'length',d.length,'itemHeight',d.item_height,'walkable',d.walkable,'canStack',d.can_stack,'canSit',d.can_sit,'canLay',d.can_lay))
 from earnly_world.items i join earnly_world.item_definitions d on d.id=i.definition_id where i.room_id=r.id),'[]'::jsonb)||r.public_items);
end $$;
revoke all on function public.world_room_snapshot(uuid,uuid) from public,anon,authenticated;
grant execute on function public.world_room_snapshot(uuid,uuid) to service_role;

-- Revalidate blocks, suspension, debt and inventory limits when settling trades.
create or replace function public.world_trade_action(p_actor uuid,p_trade uuid,p_revision integer,p_action text,p_items uuid[] default '{}')
returns jsonb language plpgsql security invoker set search_path='' as $$
declare t earnly_world.trades%rowtype; is_a boolean; item_count integer; expected_count integer;
begin
 if not exists(select 1 from auth.users where id=p_actor and not coalesce(is_anonymous,false) and email_confirmed_at is not null)
 or exists(select 1 from public.leaderboard_bans where user_id=p_actor) then raise exception 'Account unavailable'; end if;
 select * into t from earnly_world.trades where id=p_trade for update;
 if not found or p_actor not in (t.player_a,t.player_b) then raise exception 'Trade unavailable'; end if;
 if p_revision is distinct from t.revision then raise exception 'Stale trade revision'; end if;
 if t.status='complete' and p_action='confirm' then return jsonb_build_object('id',t.id,'revision',t.revision,'status',t.status); end if;
 if t.status<>'open' or t.expires_at<=now() then raise exception 'Trade closed or expired'; end if;
 if p_action<>'cancel' and (
 exists(select 1 from earnly_world.social_members where user_id in(t.player_a,t.player_b) and suspended_until>now())
 or exists(select 1 from earnly_world.blocks where (user_id=t.player_a and blocked_id=t.player_b) or (user_id=t.player_b and blocked_id=t.player_a))
 ) then raise exception 'Player unavailable';end if;
 is_a:=p_actor=t.player_a;
 if p_action='edit' then
   if p_items is null or cardinality(p_items)>12 or cardinality(p_items)<>(select count(distinct v) from unnest(p_items) v) then raise exception 'Invalid items'; end if;
   perform id from earnly_world.items where id=any(p_items) order by id for update;
   select count(*) into item_count from earnly_world.items i join earnly_world.item_definitions d on d.id=i.definition_id
     where i.id=any(p_items) and i.owner_id=p_actor and i.room_id is null and d.tradeable and i.origin<>'starter';
   if item_count<>cardinality(p_items) then raise exception 'Items unavailable'; end if;
   delete from earnly_world.trade_items where trade_id=t.id and offered_by=p_actor;
   insert into earnly_world.trade_items(trade_id,item_id,offered_by) select t.id,v,p_actor from unnest(p_items) v;
   update earnly_world.trades set revision=revision+1,locked_a=false,locked_b=false,confirmed_a=false,confirmed_b=false where id=t.id;
 elsif p_action='lock' then
   update earnly_world.trades set locked_a=locked_a or is_a,locked_b=locked_b or not is_a where id=t.id;
 elsif p_action='cancel' then
   update earnly_world.trades set status='cancelled' where id=t.id;
 elsif p_action='confirm' then
   if not t.locked_a or not t.locked_b then raise exception 'Both offers must be locked'; end if;
   update earnly_world.trades set confirmed_a=confirmed_a or is_a,confirmed_b=confirmed_b or not is_a where id=t.id returning * into t;
   if t.confirmed_a and t.confirmed_b then
     if exists(select 1 from public.leaderboard_bans where user_id in(t.player_a,t.player_b))
     or (select count(*) from auth.users where id in(t.player_a,t.player_b) and not coalesce(is_anonymous,false) and email_confirmed_at is not null)<>2 then raise exception 'Account unavailable'; end if;
     -- Wallet locks also serialize receipt purchases with inventory transfers.
     perform user_id from public.coin_wallets where user_id in(t.player_a,t.player_b) order by user_id for update;
     if exists(select 1 from public.coin_wallets where user_id in(t.player_a,t.player_b) and purchase_debt>0) then raise exception 'Wallet unavailable';end if;
     if exists(select 1 from unnest(array[t.player_a,t.player_b]) participant where
       (select count(*) from earnly_world.items where owner_id=participant)
       -(select count(*) from earnly_world.trade_items where trade_id=t.id and offered_by=participant)
       +(select count(*) from earnly_world.trade_items where trade_id=t.id and offered_by<>participant)>500)
       then raise exception 'Backpack full';end if;
     perform i.id from earnly_world.items i join earnly_world.trade_items o on o.item_id=i.id where o.trade_id=t.id order by i.id for update of i;
     select count(*) into expected_count from earnly_world.trade_items where trade_id=t.id;
     select count(*) into item_count from earnly_world.trade_items o join earnly_world.items i on i.id=o.item_id join earnly_world.item_definitions d on d.id=i.definition_id
       where o.trade_id=t.id and o.offered_by in(t.player_a,t.player_b) and i.owner_id=o.offered_by and i.room_id is null and d.tradeable and i.origin<>'starter';
     if expected_count=0 or expected_count<>item_count then raise exception 'Items unavailable'; end if;
     insert into earnly_world.item_history(item_id,trade_id,previous_owner,new_owner)
       select item_id,t.id,offered_by,case when offered_by=t.player_a then t.player_b else t.player_a end from earnly_world.trade_items where trade_id=t.id;
     update earnly_world.items i set owner_id=case when o.offered_by=t.player_a then t.player_b else t.player_a end
       from earnly_world.trade_items o where o.trade_id=t.id and o.item_id=i.id;
     update earnly_world.trades set status='complete',completed_at=now() where id=t.id;
   end if;
 else raise exception 'Unknown trade action'; end if;
 select * into t from earnly_world.trades where id=p_trade;
 return jsonb_build_object('id',t.id,'revision',t.revision,'status',t.status,'lockedA',t.locked_a,'lockedB',t.locked_b,'confirmedA',t.confirmed_a,'confirmedB',t.confirmed_b,
 'offers',coalesce((select jsonb_agg(jsonb_build_object('userId',offered_by,'itemId',item_id) order by item_id) from earnly_world.trade_items where trade_id=t.id),'[]'::jsonb));
end $$;
revoke all on function public.world_trade_action(uuid,uuid,integer,text,uuid[]) from public,anon,authenticated;
grant execute on function public.world_trade_action(uuid,uuid,integer,text,uuid[]) to service_role;

