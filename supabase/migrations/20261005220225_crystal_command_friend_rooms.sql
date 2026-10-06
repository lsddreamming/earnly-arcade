-- Casual friend-room beta. No wallet, reward, or leaderboard access.
create schema if not exists crystal_private;
revoke all on schema crystal_private from public, anon;
grant usage on schema crystal_private to authenticated;
create table public.crystal_command_rooms (
 id uuid primary key default gen_random_uuid(),
 code text not null unique check (code ~ '^[A-F0-9]{8}$'),
 host_id uuid not null references auth.users(id) on delete cascade,
 guest_id uuid references auth.users(id) on delete set null,
 status text not null default 'waiting' check(status in ('waiting','active','closed')),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '30 minutes',
 check (guest_id is null or guest_id<>host_id)
);
create index crystal_command_rooms_host on public.crystal_command_rooms(host_id);
create index crystal_command_rooms_guest on public.crystal_command_rooms(guest_id) where guest_id is not null;
alter table public.crystal_command_rooms enable row level security;
revoke all on public.crystal_command_rooms from anon, authenticated;
grant select on public.crystal_command_rooms to authenticated;
create policy crystal_room_members_read on public.crystal_command_rooms for select to authenticated
using ((select auth.uid()) in (host_id,guest_id) and expires_at>now());

create function crystal_private.room_action(p_action text,p_code text default null,p_id uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid:=auth.uid(); r public.crystal_command_rooms; new_code text;
begin
 if uid is null or not exists(select 1 from auth.users where id=uid) then raise exception 'Sign in to play with a friend'; end if;
 if p_action='create' then
  if (select count(*) from public.crystal_command_rooms where host_id=uid and status<>'closed' and expires_at>now())>=2 then raise exception 'Leave your existing room first'; end if;
  new_code:=upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
  insert into public.crystal_command_rooms(code,host_id) values(new_code,uid) returning * into r;
 elsif p_action='join' then
  if p_code is null or p_code !~ '^[A-F0-9]{8}$' then raise exception 'Enter the eight-character room code'; end if;
  select * into r from public.crystal_command_rooms where code=p_code for update;
  if r.id is null or r.expires_at<=now() or r.status='closed' then raise exception 'Room not found or expired'; end if;
  if r.host_id=uid and r.status='active' then raise exception 'Host session cannot be restored. Close this room and create another.'; end if;
  if r.host_id<>uid and r.guest_id is distinct from uid then
   if r.status<>'waiting' or r.guest_id is not null then raise exception 'This room already has two players'; end if;
   update public.crystal_command_rooms set guest_id=uid,status='active' where id=r.id returning * into r;
  end if;
 elsif p_action='close' then
  select * into r from public.crystal_command_rooms where id=p_id for update;
  if r.id is null or uid not in (r.host_id,coalesce(r.guest_id,r.host_id)) then raise exception 'Room unavailable'; end if;
  update public.crystal_command_rooms set status='closed' where id=r.id returning * into r;
 else raise exception 'Unknown room action';
 end if;
 return jsonb_build_object('id',r.id,'code',r.code,'side',case when uid=r.host_id then 0 else 1 end,'status',r.status);
end $$;
revoke all on function crystal_private.room_action(text,text,uuid) from public,anon;
grant execute on function crystal_private.room_action(text,text,uuid) to authenticated;
create function public.crystal_room_action(p_action text,p_code text default null,p_id uuid default null)
returns jsonb language sql security invoker set search_path = ''
as $$ select crystal_private.room_action(p_action,p_code,p_id) $$;
revoke all on function public.crystal_room_action(text,text,uuid) from public,anon;
grant execute on function public.crystal_room_action(text,text,uuid) to authenticated;

-- Each participant can only send on their own authenticated channel.
-- Guest orders cannot impersonate host snapshots; outsiders have no access.
create policy crystal_broadcast_receive on realtime.messages for select to authenticated using (
 extension='broadcast' and exists(select 1 from public.crystal_command_rooms r
 where (select auth.uid()) in (r.host_id,r.guest_id) and r.status<>'closed' and r.expires_at>now()
 and (select realtime.topic()) in ('cc:'||r.id::text||':0','cc:'||r.id::text||':1'))
);
create policy crystal_broadcast_send on realtime.messages for insert to authenticated with check (
 extension='broadcast' and exists(select 1 from public.crystal_command_rooms r
 where r.status<>'closed' and r.expires_at>now()
 and (((select auth.uid())=r.host_id and (select realtime.topic())='cc:'||r.id::text||':0')
 or ((select auth.uid())=r.guest_id and (select realtime.topic())='cc:'||r.id::text||':1')))
);
