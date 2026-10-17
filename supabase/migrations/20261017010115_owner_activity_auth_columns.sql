-- Only the eligibility/counting columns needed by service-only activity RPCs.
-- No password, email, token or user-metadata access is granted.
grant select(id,created_at,is_anonymous,email_confirmed_at,deleted_at) on auth.users to service_role;
