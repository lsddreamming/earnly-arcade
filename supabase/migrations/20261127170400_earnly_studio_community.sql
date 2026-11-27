-- Moderated, invite-only community. Existing Arcade access alone never grants
-- Community access. A trusted operator must first verify age and permissions.
alter table studio_control add column community_enabled boolean not null default false;
alter table studio_accounts add column community_eligible boolean not null default false;
create table studio_posts (
 job_id uuid primary key references studio_jobs, creator uuid not null references auth.users on delete cascade,
 state text not null default 'review' check(state in ('review','published','withdrawn','rejected')),
 created_at timestamptz not null default now()
);
create table studio_comments (
 id uuid primary key default gen_random_uuid(), job_id uuid not null references studio_posts on delete cascade,
 author uuid not null references auth.users on delete cascade, body text not null check(length(trim(body)) between 1 and 300),
 approved boolean not null default false,created_at timestamptz not null default now()
);
create table studio_likes(job_id uuid references studio_posts on delete cascade,user_id uuid references auth.users on delete cascade,primary key(job_id,user_id));
create table studio_follows(user_id uuid references auth.users on delete cascade,creator uuid references auth.users on delete cascade,primary key(user_id,creator),check(user_id<>creator));
create table studio_blocks(user_id uuid references auth.users on delete cascade,other_id uuid references auth.users on delete cascade,primary key(user_id,other_id),check(user_id<>other_id));
create table studio_reports(job_id uuid references studio_posts on delete cascade,user_id uuid references auth.users on delete cascade,reason text not null check(length(trim(reason)) between 1 and 300),created_at timestamptz not null default now(),primary key(job_id,user_id));
do $$
declare tbl text;
begin
 foreach tbl in array array['studio_posts','studio_comments','studio_likes','studio_follows','studio_blocks','studio_reports'] loop
 execute format('alter table %I enable row level security',tbl);
 execute format('revoke all on %I from public,anon,authenticated',tbl);
 execute format('grant select,insert,update,delete on %I to service_role',tbl);
 end loop;
end $$;
create function studio_blocked(p_left uuid,p_right uuid) returns boolean language sql stable set search_path=public,pg_temp as $$
 select exists(select from studio_blocks where (user_id,other_id) in ((p_left,p_right),(p_right,p_left)))
$$;
create function studio_community(p_user uuid,p_action text,p_id uuid,p_text text default '')
returns jsonb language plpgsql set search_path=public,pg_temp as $$
declare author uuid; payload jsonb;
begin
 if not exists(select from studio_control where community_enabled) or
    not exists(select from studio_accounts where user_id=p_user and community_eligible and pilot) then raise exception 'COMMUNITY_CLOSED'; end if;
 if p_action='submit' then
   if not exists(select from studio_jobs where id=p_id and user_id=p_user and state='ready' and private_path is not null and not hidden) then raise exception 'CONTENT_UNAVAILABLE';end if;
   insert into studio_posts(job_id,creator) values(p_id,p_user) on conflict(job_id) do update set state='review' where studio_posts.state='withdrawn';
 elsif p_action='withdraw' then
   update studio_posts set state='withdrawn' where job_id=p_id and creator=p_user;
 elsif p_action='block' then
   insert into studio_blocks values(p_user,p_id) on conflict do nothing;
   delete from studio_follows where (user_id,creator) in ((p_user,p_id),(p_id,p_user));
 elsif p_action in ('feed','trending','following') then
   select coalesce(jsonb_agg(to_jsonb(entry)),'[]') into payload from (
    select p.job_id,p.creator,coalesce(pr.username,'Creator') as username,j.kind,j.prompt,j.title,j.private_path,
     (select count(*) from studio_likes where job_id=p.job_id) as likes,
     exists(select from studio_likes where job_id=p.job_id and user_id=p_user) as liked,
     exists(select from studio_follows where creator=p.creator and user_id=p_user) as following,
     (select coalesce(jsonb_agg(to_jsonb(c)),'[]') from
        (select sc.body,coalesce(cp.username,'Creator') as username from studio_comments sc left join profiles cp on cp.user_id=sc.author
         where sc.approved and sc.job_id=p.job_id and not studio_blocked(p_user,sc.author)
         order by sc.created_at desc limit 8) c) as comments
    from studio_posts p join studio_jobs j on j.id=p.job_id left join profiles pr on pr.user_id=p.creator
    join studio_accounts a on a.user_id=p.creator and a.community_eligible and a.pilot
    where p.state='published' and not j.hidden and j.state='ready' and not studio_blocked(p_user,p.creator)
     and not exists(select from studio_reports where job_id=p.job_id and user_id=p_user)
     and (p_action<>'following' or exists(select from studio_follows where creator=p.creator and user_id=p_user))
     and (p_text='' or position(lower(left(p_text,80)) in lower(concat_ws(' ',j.title,j.prompt,pr.username)))>0)
    order by case when p_action='trending' then (select count(*) from studio_likes where job_id=p.job_id) else 0 end desc,p.created_at desc limit 20
   ) entry;
   return payload;
 else
   select p.creator into author from studio_posts p join studio_jobs j on j.id=p.job_id join studio_accounts a on a.user_id=p.creator
    where p.job_id=p_id and p.state='published' and not j.hidden and j.state='ready' and a.pilot and a.community_eligible;
   if author is null or studio_blocked(p_user,author) then raise exception 'CONTENT_UNAVAILABLE'; end if;
   if p_action='like' then insert into studio_likes values(p_id,p_user) on conflict do nothing;
   elsif p_action='unlike' then delete from studio_likes where job_id=p_id and user_id=p_user;
   elsif p_action='follow' then insert into studio_follows values(p_user,author) on conflict do nothing;
   elsif p_action='unfollow' then delete from studio_follows where user_id=p_user and creator=author;
   elsif p_action='report' then insert into studio_reports values(p_id,p_user,p_text,now()) on conflict do nothing;
   elsif p_action='comment' then
    perform 1 from studio_accounts where user_id=p_user for update;
    if (select count(*) from studio_comments sc where sc.author=p_user and created_at>now()-interval '1 hour')>=5 then raise exception 'COMMENT_LIMIT';end if;
    insert into studio_comments(job_id,author,body) values(p_id,p_user,p_text);
   else raise exception 'UNKNOWN_ACTION';end if;
 end if;
 return jsonb_build_object('ok',true);
end $$;
revoke all on function studio_blocked(uuid,uuid),studio_community(uuid,text,uuid,text) from public,anon,authenticated;
grant execute on function studio_blocked(uuid,uuid),studio_community(uuid,text,uuid,text) to service_role;
