-- LOCAL AND TEST USE ONLY. Never run this against the hosted database.
--
-- Supabase already has these three roles, and the migrations must not create
-- them. A plain local Postgres (or the in-memory one the tests use) does not,
-- so this file makes them before the migrations run.
--
--   anon           a request with nobody signed in. Gets nothing in schema app.
--   authenticated  a request made for a signed-in person. Row-level security applies.
--   service_role   the server's background work. Bypasses row-level security.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end
$$;
