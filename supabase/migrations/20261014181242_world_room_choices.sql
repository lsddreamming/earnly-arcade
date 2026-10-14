-- Free room layouts and unlimited personal-room creation. Existing rooms are preserved.
create or replace function public.world_api(p_actor uuid,p_action text,p_data jsonb default '{}') returns jsonb language plpgsql security invoker set search_path='' as $$
declare d earnly_world.item_definitions%rowtype; w public.coin_wallets%rowtype; receipt earnly_world.purchase_receipts%rowtype; r earnly_world.rooms%rowtype; m earnly_world.social_members%rowtype; msg earnly_world.messages%rowtype; target uuid; rid uuid; iid uuid; result jsonb; body text; v_mode text; viewers uuid[]; n integer; layout_map text;
begin
 if not exists(select 1 from auth.users where id=p_actor and not coalesce(is_anonymous,false) and email_confirmed_at is not null) or exists(select 1 from public.leaderboard_bans where user_id=p_actor) then raise exception 'Account unavailable';end if;
 -- Per-player serialization protects purchase receipts, message quotas and room creation.
 perform pg_advisory_xact_lock(hashtextextended(p_actor::text,174));
 if exists(select 1 from earnly_world.social_members where user_id=p_actor and suspended_until>now()) then raise exception 'World access suspended';end if;
 if p_action='bootstrap' then
   return jsonb_build_object('balance',coalesce((select balance::text from public.coin_wallets where user_id=p_actor),'0'),
   'catalog',(select coalesce(jsonb_agg(to_jsonb(c) order by category,price),'[]') from earnly_world.item_definitions c),
   'rooms',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'ownerId',owner_id,'access',access_type,'revision',revision) order by created_at),'[]') from (select * from earnly_world.rooms where owner_id=p_actor union all select * from (select * from earnly_world.rooms where access_type='open' and owner_id is distinct from p_actor order by created_at limit 100) public_rooms) q),
   'items',(select coalesce(jsonb_agg(to_jsonb(i) order by created_at desc),'[]') from (select * from earnly_world.items where owner_id=p_actor order by created_at desc limit 500) i),
   'chatAccepted',exists(select 1 from earnly_world.social_members where user_id=p_actor and accepted_at is not null),
   'friends',(select coalesce(jsonb_agg(jsonb_build_object('userId',p.user_id,'username',p.username,'accepted',f.accepted,'incoming',f.recipient=p_actor)),'[]') from earnly_world.friends f join public.profiles p on p.user_id=case when f.requester=p_actor then f.recipient else f.requester end where (f.requester=p_actor or f.recipient=p_actor) and not exists(select 1 from earnly_world.blocks b where (b.user_id=p_actor and b.blocked_id=p.user_id) or (b.blocked_id=p_actor and b.user_id=p.user_id))));
 elsif p_action='create_room' then
   -- Starter selection is idempotent under the existing per-account lock.
   if coalesce((p_data->>'firstRoom')::boolean,false) then
     select * into r from earnly_world.rooms where owner_id=p_actor order by created_at limit 1;
     if found then return jsonb_build_object('roomId',r.id);end if;
   end if;
   body:=btrim(p_data->>'name');if body is null or length(body) not between 1 and 40 or body~'[[:cntrl:]]' then raise exception 'Choose a room name';end if;
   layout_map:=case coalesce(p_data->>'layout','classic')
     when 'studio' then E'000000\n000000\n000000\n000000\n000000\n000000'
     when 'square' then E'000000000000\n000000000000\n000000000000\n000000000000\n000000000000\n000000000000\n000000000000\n000000000000\n000000000000\n000000000000\n000000000000\n000000000000'
     when 'loft' then E'000000000000\n000000000000\n000000000000\n000000000000\n000000000000\n000000000000\n000000000000\n000000000000'
     when 'corner' then E'0000000000\n0000000000\n0000000000\n0000000000\n0000000000\n00000xxxxx\n00000xxxxx\n00000xxxxx\n00000xxxxx\n00000xxxxx'
     when 'courtyard' then E'000000000000\n000000000000\n000000000000\n000000000000\n0000xxxx0000\n0000xxxx0000\n0000xxxx0000\n0000xxxx0000\n000000000000\n000000000000\n000000000000\n000000000000'
     when 'classic' then E'00000000\n00000000\n00000000\n00000000\n00000000\n00000000\n00000000\n00000000'
     else null end;
   if layout_map is null then raise exception 'Choose a room layout';end if;
   -- Rooms are free: no wallet mutation and no ownership-count purchase gate.
   insert into earnly_world.rooms(owner_id,name,heightmap,access_type) values(p_actor,body,layout_map,'closed') returning * into r;
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

