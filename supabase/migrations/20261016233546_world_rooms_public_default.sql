-- New rooms welcome visitors; preserve every existing room's access choice.
-- Patch only the creation default, retaining all current API validation and grants.
do $patch$
declare
 definition text := pg_get_functiondef('public.world_api(uuid,text,jsonb)'::regprocedure);
 old_insert text;
 new_insert text;
begin
 old_insert := substring(definition from 'insert into earnly_world.rooms[^;]+');
 if old_insert is null or strpos(old_insert,$old$,'closed') returning * into r$old$)=0 then
   raise exception 'Expected World room creation definition not found';
 end if;
 new_insert := replace(old_insert,$old$,'closed') returning * into r$old$,$new$,'open') returning * into r$new$);
 execute replace(definition,old_insert,new_insert);
end
$patch$;
alter table earnly_world.rooms alter column access_type set default 'open';
