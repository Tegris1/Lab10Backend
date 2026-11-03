-- Execute with psql as the migration owner after every schema deployment:
-- psql --set=ON_ERROR_STOP=1 --set=runtime_role=shop_runtime --file=scripts/sql/runtime-grants.sql
-- Use a secure operator connection (PGSERVICE / process environment), never a committed password.
-- Create the login role and set its password in the provider's protected console first.
\if :{?runtime_role}
\else
  \echo 'Supply --set=runtime_role=the_existing_runtime_role.'
  \quit 1
\endif

BEGIN;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM :"runtime_role";
GRANT CONNECT ON DATABASE :"DBNAME" TO :"runtime_role";
GRANT USAGE ON SCHEMA public TO :"runtime_role";
GRANT SELECT ON TABLE public."Category" TO :"runtime_role";
GRANT SELECT ON TABLE public."Product" TO :"runtime_role";
GRANT UPDATE ("amount") ON TABLE public."Product" TO :"runtime_role";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."User", public."Session", public."Account", public."Verification", public."Cart", public."CartItem" TO :"runtime_role";
GRANT SELECT, INSERT ON TABLE public."Order", public."OrderItem" TO :"runtime_role";
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO :"runtime_role";
-- Applies to future sequences created by this migration owner. Grant future tables explicitly.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO :"runtime_role";
COMMIT;
