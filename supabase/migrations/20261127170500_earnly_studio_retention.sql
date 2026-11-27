-- Keep financial exposure after deletion. Remove the prompt and object references.
create table studio_purge_queue(path text primary key, created_at timestamptz not null default now());
alter table studio_purge_queue enable row level security;
revoke all on studio_purge_queue from public,anon,authenticated;
grant select,insert,delete on studio_purge_queue to service_role;
create function studio_scrub_job() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if old.private_path is not null then insert into studio_purge_queue values(old.private_path,now()) on conflict do nothing; end if;
 if old.reference_path is not null then insert into studio_purge_queue values(old.reference_path,now()) on conflict do nothing; end if;
 -- Also queue deterministic paths for a worker interrupted immediately after upload.
 insert into studio_purge_queue(path) values(old.id||case when old.kind='image' then '.jpg' else '.mp4' end) on conflict do nothing;
 if old.kind='animation' then insert into studio_purge_queue(path) values(old.id||'-reference.jpg') on conflict do nothing; end if;
 new.private_path=null;new.reference_path=null;new.reference_hash=null;new.prompt='[deleted]';new.title=null;new.hidden=true;
 if new.user_id is null then new.state='failed';end if;
 return new;
end $$;
create trigger studio_scrub_job before update of hidden,user_id on studio_jobs for each row
when ((new.hidden and not old.hidden) or (new.user_id is null and old.user_id is not null))
execute function studio_scrub_job();
create function studio_expire() returns void language plpgsql set search_path=public,pg_temp as $$
begin
 update studio_jobs set hidden=true where not hidden and state in ('ready','failed','output_review') and created_at < now()-interval '30 days';
end $$;
revoke all on function studio_scrub_job(),studio_expire() from public,anon,authenticated;
grant execute on function studio_expire() to service_role;
