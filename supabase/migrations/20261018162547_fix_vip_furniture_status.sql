-- Keep the pending-gift record distinct from the result query alias.
create or replace function public.arcade_pass_furniture_me(p_user_id uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare pending_award public.arcade_pass_furniture_awards%rowtype;
begin
 for pending_award in select * from public.arcade_pass_furniture_awards where user_id=p_user_id and item_id is null and not revoked order by created_at limit 50 loop
  perform public.arcade_pass_furniture_award(pending_award.user_id,pending_award.provider,pending_award.transaction_id,pending_award.subscription_id,pending_award.period_start,pending_award.period_end);
 end loop;
 return (select coalesce(jsonb_agg(jsonb_build_object('name',d.name,'definitionId',a.definition_id,'delivered',a.item_id is not null,'revoked',a.revoked,'periodStart',a.period_start) order by a.period_start desc),'[]') from public.arcade_pass_furniture_awards a join earnly_world.item_definitions d on d.id=a.definition_id where a.user_id=p_user_id);
end $$;
revoke all on function public.arcade_pass_furniture_me(uuid) from public,anon,authenticated;
grant execute on function public.arcade_pass_furniture_me(uuid) to service_role;
