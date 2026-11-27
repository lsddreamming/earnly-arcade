-- A dedicated Studio placement uses a pre-funded, finite credit pool.
create table studio_ad_pool(singleton boolean primary key default true check(singleton), enabled boolean not null default false,remaining int not null default 0 check(remaining>=0),reward int not null default 1 check(reward between 1 and 3));
insert into studio_ad_pool(singleton) values(true);
create table studio_ad_tickets(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users on delete cascade not null, credits int not null,unit text not null,created_at timestamptz not null default now(),transaction_id text unique);
alter table studio_ad_pool enable row level security;
alter table studio_ad_tickets enable row level security;
revoke all on studio_ad_pool,studio_ad_tickets from public,anon,authenticated;
grant select,insert,update on studio_ad_pool,studio_ad_tickets to service_role;
create function studio_ad_ticket(p_user uuid,p_unit text) returns jsonb language plpgsql set search_path=public,pg_temp as $$
declare pool studio_ad_pool; ticket studio_ad_tickets;
begin
 select * into strict pool from studio_ad_pool for update;
 if not pool.enabled or not exists(select 1 from studio_accounts where user_id=p_user and pilot) then raise exception 'ADS_PAUSED';end if;
 select * into ticket from studio_ad_tickets where user_id=p_user and transaction_id is null and created_at>now()-interval '10 minutes' and unit=p_unit order by created_at desc limit 1;
 if not found then
  if pool.remaining<pool.reward or (select count(*) from studio_ad_tickets where user_id=p_user and created_at>now()-interval '24 hours')>=3 then raise exception 'ADS_PAUSED';end if;
  update studio_ad_pool set remaining=remaining-pool.reward;
  insert into studio_ad_tickets(user_id,credits,unit) values(p_user,pool.reward,p_unit) returning * into ticket;
 end if;
 return jsonb_build_object('ticket',ticket.id,'credits',ticket.credits,'adUnit',ticket.unit);
end $$;
create function studio_ad_complete(p_ticket uuid,p_unit text,p_event text,p_time timestamptz) returns boolean language plpgsql set search_path=public,pg_temp as $$
declare ticket studio_ad_tickets;
begin
 select * into strict ticket from studio_ad_tickets where id=p_ticket for update;
 if ticket.unit<>p_unit or p_time<ticket.created_at-interval '1 minute' or p_time>ticket.created_at+interval '30 minutes' then raise exception 'INVALID_TICKET';end if;
 if ticket.transaction_id is not null then
   if ticket.transaction_id<>p_event then raise exception 'TICKET_USED';end if;
   return false;
 end if;
 update studio_ad_tickets set transaction_id=p_event where id=p_ticket;
 return studio_grant(ticket.user_id,'admob',p_event,ticket.credits);
end $$;
revoke all on function studio_ad_ticket(uuid,text),studio_ad_complete(uuid,text,text,timestamptz) from public,anon,authenticated;
grant execute on function studio_ad_ticket(uuid,text),studio_ad_complete(uuid,text,text,timestamptz) to service_role;
