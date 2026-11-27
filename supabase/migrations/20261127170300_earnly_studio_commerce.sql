-- Sandbox purchases are recorded separately and can never fund paid inference.
create table studio_test_purchases (
 provider text not null check(provider in ('apple_sandbox','stripe_test')), transaction_id text not null,
 user_id uuid references auth.users on delete set null, product text not null check(product in ('premium','pro','credits100')),
 valid_until timestamptz, revoked boolean not null, observed_at timestamptz not null,
 primary key(provider,transaction_id),
 check((product='credits100')=(valid_until is null))
);
alter table studio_test_purchases enable row level security;
revoke all on studio_test_purchases from public,anon,authenticated;
grant select,insert,update on studio_test_purchases to service_role;
create function studio_test_purchase(p_provider text,p_transaction text,p_user uuid,p_product text,p_until timestamptz,p_revoked boolean,p_observed timestamptz)
returns void language plpgsql set search_path=public,pg_temp as $$
begin
 insert into studio_test_purchases values(p_provider,p_transaction,p_user,p_product,p_until,p_revoked,p_observed)
 on conflict(provider,transaction_id) do update set
 revoked=studio_test_purchases.revoked or excluded.revoked,
 observed_at=greatest(studio_test_purchases.observed_at,excluded.observed_at)
 where studio_test_purchases.user_id=excluded.user_id and studio_test_purchases.product=excluded.product
 and studio_test_purchases.valid_until is not distinct from excluded.valid_until;
 if not found then raise exception 'PURCHASE_CONFLICT';end if;
end $$;
revoke all on function studio_test_purchase(text,text,uuid,text,timestamptz,boolean,timestamptz) from public,anon,authenticated;
grant execute on function studio_test_purchase(text,text,uuid,text,timestamptz,boolean,timestamptz) to service_role;
