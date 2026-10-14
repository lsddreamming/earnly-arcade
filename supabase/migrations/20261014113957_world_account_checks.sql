-- World RPCs run as service_role and validate confirmed, non-anonymous accounts.
-- Grant only the three columns used by those checks, not emails or credentials.
grant select (id, is_anonymous, email_confirmed_at) on auth.users to service_role;
