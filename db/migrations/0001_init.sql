-- Juris, migration 0001: the Phase 1 schema and its row-level security.
--
-- Plain SQL for Postgres 15 or newer. It creates no roles: "anon",
-- "authenticated" and "service_role" must exist already (Supabase has them;
-- db/local/roles.sql makes them for local runs and tests).
--
-- Apply it in ONE transaction, so a failure leaves nothing half-made:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 --single-transaction -f db/migrations/0001_init.sql
--
-- The rules this file keeps (db/README.md explains them):
--   1. Everything is in schema "app". "anon" has no access to that schema.
--   2. Every table has row-level security enabled AND forced.
--   3. Every policy is for "authenticated" only and compares user_id with
--      app.user_id(), the person the server said this request is for.
--   4. A column the worker owns is not granted to "authenticated" at all, so
--      no policy has to be right for it to stay out of a person's reach.
--   5. Every child row carries user_id and a foreign key (case_id, user_id),
--      so a row cannot hang off somebody else's case whatever the policies say.

create schema app;

-- Nothing here is for the public or for people who are not signed in.
revoke all on schema app from public;

-- ---------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------

-- Who this request is for: "sub" of the claims the server set for the
-- transaction, or null when it set none. Malformed claims raise an error
-- rather than fall back to anybody.
create function app.user_id() returns uuid
  language sql
  stable
  set search_path = ''
as $$
  select nullif(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub',
    ''
  )::uuid
$$;

-- Keeps updated_at current, whatever the statement tried to put there.
create function app.touch_updated_at() returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

-- A withdrawal is stamped with the database's clock, not a time the caller chose.
create function app.stamp_withdrawal() returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  if new.withdrawn_at is not null and old.withdrawn_at is null then
    new.withdrawn_at := now();
  end if;
  return new;
end
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- profiles: one row per person; id is the sign-in provider's user id.
create table app.profiles (
  id                 uuid primary key,
  phone              text not null unique,
  email              text,
  display_name       text not null default '',
  preferred_language text not null default 'mr',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint profiles_phone_e164 check (phone ~ '^\+[1-9][0-9]{6,14}$'),
  constraint profiles_email_shape check (email is null or (char_length(email) <= 254 and email ~ '^[^@[:space:]]+@[^@[:space:]]+$')),
  constraint profiles_display_name_length check (char_length(display_name) <= 80),
  constraint profiles_language_known check (preferred_language in ('mr', 'hi', 'en'))
);

-- consents: what the person agreed to and when; withdrawn, never deleted, while the account exists.
create table app.consents (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references app.profiles (id) on delete cascade,
  purpose        text not null,
  policy_version text not null,
  is_adult       boolean not null,
  granted_at     timestamptz not null default now(),
  withdrawn_at   timestamptz,
  constraint consents_purpose_shape check (purpose ~ '^[a-z][a-z0-9_]{0,63}$'),
  constraint consents_policy_version_length check (char_length(policy_version) between 1 and 64),
  constraint consents_withdrawn_after_granted check (withdrawn_at is null or withdrawn_at >= granted_at)
);

-- cases: one legal problem of one person.
create table app.cases (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references app.profiles (id) on delete cascade,
  title      text not null,
  category   text not null,
  source     text not null,
  status     text not null default 'draft',
  city       text,
  state      text,
  request_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- The target of every child's (case_id, user_id) foreign key.
  constraint cases_id_user_unique unique (id, user_id),
  constraint cases_title_length check (char_length(btrim(title)) >= 1 and char_length(title) <= 120),
  constraint cases_category_known check (category in (
    'consumer', 'tenancy', 'employment', 'family', 'criminal_complaint', 'property', 'documents_id', 'other')),
  constraint cases_source_known check (source in ('document', 'description', 'document_and_description')),
  constraint cases_status_known check (status in ('draft', 'processing', 'ready', 'needs_more_info', 'error')),
  constraint cases_city_length check (city is null or char_length(city) between 1 and 80),
  constraint cases_state_length check (state is null or char_length(state) between 1 and 80),
  constraint cases_request_id_length check (request_id is null or char_length(request_id) between 1 and 128)
);

-- case_stories: what the person wrote about a case, at most one per case.
create table app.case_stories (
  case_id             uuid primary key,
  user_id             uuid not null,
  narrative           text not null,
  what_happened       text,
  when_happened       text,
  who_involved        text,
  what_outcome_wanted text,
  constraint case_stories_case_owner_fk foreign key (case_id, user_id)
    references app.cases (id, user_id) on delete cascade,
  constraint case_stories_narrative_length check (char_length(narrative) between 1 and 20000),
  constraint case_stories_parts_length check (
    coalesce(char_length(what_happened), 0) <= 5000
    and coalesce(char_length(when_happened), 0) <= 5000
    and coalesce(char_length(who_involved), 0) <= 5000
    and coalesce(char_length(what_outcome_wanted), 0) <= 5000)
);

-- documents: one row per paper added to a case; the file itself is in private storage.
create table app.documents (
  id              uuid primary key default gen_random_uuid(),
  case_id         uuid not null,
  user_id         uuid not null,
  file_name       text not null,
  mime_type       text not null,
  byte_size       bigint not null,
  kind            text not null,
  -- Where the file is kept. Worked out from the owner, the case and the row,
  -- never supplied, so a row cannot be pointed at somebody else's file.
  storage_path    text generated always as (user_id::text || '/' || case_id::text || '/' || id::text) stored,
  status          text not null default 'checking',
  rejected_reason text,
  request_id      text,
  created_at      timestamptz not null default now(),
  constraint documents_case_owner_fk foreign key (case_id, user_id)
    references app.cases (id, user_id) on delete cascade,
  constraint documents_file_name_length check (char_length(file_name) between 1 and 255),
  constraint documents_mime_type_length check (char_length(mime_type) between 1 and 127),
  constraint documents_byte_size_range check (byte_size > 0 and byte_size <= 52428800),
  constraint documents_kind_known check (kind in ('pdf', 'image', 'other')),
  constraint documents_status_known check (status in ('checking', 'ready', 'rejected')),
  constraint documents_rejected_reason_only_when_rejected check (rejected_reason is null or status = 'rejected'),
  constraint documents_request_id_length check (request_id is null or char_length(request_id) between 1 and 128)
);

-- analysis_jobs: one row per reading of a case; the latest row per case is the current job.
create table app.analysis_jobs (
  id             uuid primary key default gen_random_uuid(),
  case_id        uuid not null,
  user_id        uuid not null,
  state          text not null default 'queued',
  language       text not null,
  failure_reason text,
  retryable      boolean,
  attempt        integer not null default 1,
  started_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  -- The target of analyses' (job_id, case_id) foreign key.
  constraint analysis_jobs_id_case_unique unique (id, case_id),
  constraint analysis_jobs_case_owner_fk foreign key (case_id, user_id)
    references app.cases (id, user_id) on delete cascade,
  constraint analysis_jobs_state_known check (state in ('queued', 'reading', 'writing', 'ready', 'failed')),
  constraint analysis_jobs_language_known check (language in ('mr', 'hi', 'en')),
  constraint analysis_jobs_failure_reason_known check (
    failure_reason is null or failure_reason in ('unreadable', 'unsupported', 'too_long', 'internal')),
  constraint analysis_jobs_failure_only_when_failed check (
    (state = 'failed') = (failure_reason is not null) and (state = 'failed') = (retryable is not null)),
  constraint analysis_jobs_attempt_positive check (attempt >= 1)
);

-- analyses: every finished explanation is kept; the newest per case is the one shown.
create table app.analyses (
  id             uuid primary key default gen_random_uuid(),
  case_id        uuid not null,
  user_id        uuid not null,
  job_id         uuid not null,
  language       text not null,
  content        jsonb not null,
  model          text not null,
  prompt_version text not null,
  review_state   text not null default 'not_required',
  created_at     timestamptz not null default now(),
  constraint analyses_case_owner_fk foreign key (case_id, user_id)
    references app.cases (id, user_id) on delete cascade,
  -- The job must be a reading of this same case, and gives one explanation at most.
  constraint analyses_job_fk foreign key (job_id, case_id)
    references app.analysis_jobs (id, case_id) on delete cascade,
  constraint analyses_one_per_job unique (job_id),
  constraint analyses_language_known check (language in ('mr', 'hi', 'en')),
  constraint analyses_content_is_object check (jsonb_typeof(content) = 'object'),
  constraint analyses_model_length check (char_length(model) between 1 and 200),
  constraint analyses_prompt_version_length check (char_length(prompt_version) between 1 and 200),
  constraint analyses_review_state_known check (review_state in ('not_required', 'pending', 'approved', 'rejected'))
);

-- chat_messages: the questions a person asked about a case, and the replies.
create table app.chat_messages (
  id          uuid primary key default gen_random_uuid(),
  -- The order messages were written in. created_at alone cannot give it: a
  -- question and its reply saved in one transaction share the same time.
  seq         bigint generated always as identity,
  case_id     uuid not null,
  user_id     uuid not null,
  role        text not null default 'user',
  content     text not null,
  language    text,
  request_id  text,
  -- On a reply: the question it answers, so a repeated request finds its first answer.
  in_reply_to uuid,
  created_at  timestamptz not null default now(),
  constraint chat_messages_seq_unique unique (seq),
  constraint chat_messages_id_case_unique unique (id, case_id),
  constraint chat_messages_case_owner_fk foreign key (case_id, user_id)
    references app.cases (id, user_id) on delete cascade,
  constraint chat_messages_reply_same_case_fk foreign key (in_reply_to, case_id)
    references app.chat_messages (id, case_id) on delete cascade,
  constraint chat_messages_role_known check (role in ('user', 'assistant')),
  constraint chat_messages_content_length check (char_length(content) between 1 and 20000),
  constraint chat_messages_language_known check (language is null or language in ('mr', 'hi', 'en')),
  constraint chat_messages_request_id_length check (request_id is null or char_length(request_id) between 1 and 128),
  constraint chat_messages_only_replies_reply check (in_reply_to is null or role = 'assistant'),
  constraint chat_messages_only_questions_carry_request check (request_id is null or role = 'user')
);

-- audit_log: append-only record of each access to a case (launch plan, rule 8).
-- It has no foreign keys on purpose: it outlives the case and the account it
-- is about, holding ids only. See db/README.md, "The audit log".
create table app.audit_log (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid,
  action       text not null,
  subject_type text not null,
  subject_id   uuid,
  at           timestamptz not null default now(),
  meta         jsonb not null default '{}'::jsonb,
  constraint audit_log_action_shape check (action ~ '^[a-z][a-z0-9_.]{0,63}$'),
  constraint audit_log_subject_type_shape check (subject_type ~ '^[a-z][a-z0-9_]{0,63}$'),
  -- Small on purpose: ids and codes belong here, never the words of a paper or a question.
  constraint audit_log_meta_small_object check (jsonb_typeof(meta) = 'object' and octet_length(meta::text) <= 2048)
);

-- usage_counters: how much of each daily allowance a person has used.
create table app.usage_counters (
  user_id uuid not null references app.profiles (id) on delete cascade,
  day     date not null,
  kind    text not null,
  count   integer not null default 0,
  primary key (user_id, day, kind),
  constraint usage_counters_kind_shape check (kind ~ '^[a-z][a-z0-9_]{0,63}$'),
  constraint usage_counters_count_not_negative check (count >= 0)
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

-- Retry safety: one row per person per request id.
create unique index cases_request_once on app.cases (user_id, request_id) where request_id is not null;
create unique index documents_request_once on app.documents (user_id, request_id) where request_id is not null;
create unique index chat_messages_request_once on app.chat_messages (user_id, request_id) where request_id is not null;

-- A person's cases, newest first (CaseService.list, with or without a status filter).
create index cases_by_owner_newest on app.cases (user_id, created_at desc, id desc);

-- A person's papers, newest first (DocumentService.listAll).
create index documents_by_owner_newest on app.documents (user_id, created_at desc, id desc);
-- The papers of one case, in the order they were added (DocumentService.list); also serves the cascade.
create index documents_by_case on app.documents (case_id, created_at, id);

-- The latest reading of a case (AnalysisService.status); also serves the cascade.
create index analysis_jobs_latest_by_case on app.analysis_jobs (case_id, started_at desc, id desc);
-- At most one reading of a case is under way, so two requests at once cannot start two.
create unique index analysis_jobs_one_running on app.analysis_jobs (case_id)
  where state in ('queued', 'reading', 'writing');
-- The worker's queue: waiting jobs, oldest first.
create index analysis_jobs_waiting on app.analysis_jobs (started_at, id) where state = 'queued';

-- The latest explanation of a case (AnalysisService.get); also serves the cascade.
create index analyses_latest_by_case on app.analyses (case_id, created_at desc, id desc);

-- The messages of a case in order (ChatService.list); also serves the cascade.
create index chat_messages_by_case on app.chat_messages (case_id, seq);
-- The reply to a question, and at most one of them.
create unique index chat_messages_one_reply on app.chat_messages (in_reply_to) where in_reply_to is not null;

-- A person's consents; and one live consent per purpose and policy version.
create index consents_by_owner on app.consents (user_id, granted_at desc);
create unique index consents_one_live on app.consents (user_id, purpose, policy_version) where withdrawn_at is null;

-- The audit trail of one person, and of one thing.
create index audit_log_by_user on app.audit_log (user_id, at desc);
create index audit_log_by_subject on app.audit_log (subject_type, subject_id, at desc);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create trigger profiles_touch_updated_at before update on app.profiles
  for each row execute function app.touch_updated_at();
create trigger cases_touch_updated_at before update on app.cases
  for each row execute function app.touch_updated_at();
create trigger analysis_jobs_touch_updated_at before update on app.analysis_jobs
  for each row execute function app.touch_updated_at();
create trigger consents_stamp_withdrawal before update on app.consents
  for each row execute function app.stamp_withdrawal();

-- ---------------------------------------------------------------------------
-- Row-level security: enabled and forced on every table
-- ---------------------------------------------------------------------------

alter table app.profiles       enable row level security;
alter table app.profiles       force row level security;
alter table app.consents       enable row level security;
alter table app.consents       force row level security;
alter table app.cases          enable row level security;
alter table app.cases          force row level security;
alter table app.case_stories   enable row level security;
alter table app.case_stories   force row level security;
alter table app.documents      enable row level security;
alter table app.documents      force row level security;
alter table app.analysis_jobs  enable row level security;
alter table app.analysis_jobs  force row level security;
alter table app.analyses       enable row level security;
alter table app.analyses       force row level security;
alter table app.chat_messages  enable row level security;
alter table app.chat_messages  force row level security;
alter table app.audit_log      enable row level security;
alter table app.audit_log      force row level security;
alter table app.usage_counters enable row level security;
alter table app.usage_counters force row level security;

-- ---------------------------------------------------------------------------
-- Grants
--
-- Start from nothing, then give each role exactly what it needs. What is not
-- listed here cannot be done, whatever a policy says.
-- ---------------------------------------------------------------------------

revoke all on all tables in schema app from public, anon, authenticated, service_role;
revoke all on all sequences in schema app from public, anon, authenticated, service_role;
revoke all on all functions in schema app from public, anon, authenticated, service_role;
revoke all on schema app from anon;

grant usage on schema app to authenticated, service_role;
grant execute on function app.user_id() to authenticated, service_role;

-- A signed-in person. Inserts name the columns a person may supply, so
-- everything else (ids, status, timestamps) takes its default. Updates name
-- the columns a person may change.
grant select on app.profiles to authenticated;
grant insert (id, phone, email, display_name, preferred_language) on app.profiles to authenticated;
grant update (display_name, preferred_language) on app.profiles to authenticated;
grant delete on app.profiles to authenticated;

grant select on app.consents to authenticated;
grant insert (user_id, purpose, policy_version, is_adult) on app.consents to authenticated;
grant update (withdrawn_at) on app.consents to authenticated;

grant select on app.cases to authenticated;
grant insert (user_id, title, category, source, city, state, request_id) on app.cases to authenticated;
grant update (title, category, city, state) on app.cases to authenticated;
grant delete on app.cases to authenticated;

grant select on app.case_stories to authenticated;
grant insert (case_id, user_id, narrative, what_happened, when_happened, who_involved, what_outcome_wanted)
  on app.case_stories to authenticated;
grant update (narrative, what_happened, when_happened, who_involved, what_outcome_wanted)
  on app.case_stories to authenticated;
grant delete on app.case_stories to authenticated;

grant select on app.documents to authenticated;
grant insert (case_id, user_id, file_name, mime_type, byte_size, kind, request_id) on app.documents to authenticated;
grant delete on app.documents to authenticated;

grant select on app.analysis_jobs to authenticated;
grant insert (case_id, user_id, language) on app.analysis_jobs to authenticated;

grant select on app.analyses to authenticated;

grant select on app.chat_messages to authenticated;
grant insert (case_id, user_id, content, language, request_id) on app.chat_messages to authenticated;

-- audit_log and usage_counters: nothing for a signed-in person.

-- The server's background work. It bypasses row-level security, so these
-- grants are all that limit it.
grant select, insert, update, delete on
  app.profiles, app.consents, app.cases, app.case_stories, app.documents,
  app.analysis_jobs, app.analyses, app.chat_messages, app.usage_counters
  to service_role;
-- Append-only: it can add to the audit log and read it, not change or remove it.
grant select, insert on app.audit_log to service_role;

-- ---------------------------------------------------------------------------
-- Policies (role "authenticated" only; "anon" has none and no grants)
-- ---------------------------------------------------------------------------

-- profiles ------------------------------------------------------------------

-- A person reads their own profile.
create policy profiles_select_own on app.profiles for select to authenticated
  using (id = (select app.user_id()));
-- A person makes their own profile, under their own id.
create policy profiles_insert_own on app.profiles for insert to authenticated
  with check (id = (select app.user_id()));
-- A person changes their own name and language (the grant limits the columns).
create policy profiles_update_own on app.profiles for update to authenticated
  using (id = (select app.user_id()))
  with check (id = (select app.user_id()));
-- A person deletes their own account, and everything of theirs goes with it.
create policy profiles_delete_own on app.profiles for delete to authenticated
  using (id = (select app.user_id()));

-- consents ------------------------------------------------------------------

-- A person reads what they agreed to.
create policy consents_select_own on app.consents for select to authenticated
  using (user_id = (select app.user_id()));
-- A person records their own consent, not yet withdrawn.
create policy consents_insert_own on app.consents for insert to authenticated
  with check (user_id = (select app.user_id()) and withdrawn_at is null);
-- A person withdraws their own live consent; a withdrawal cannot be undone.
create policy consents_withdraw_own on app.consents for update to authenticated
  using (user_id = (select app.user_id()) and withdrawn_at is null)
  with check (user_id = (select app.user_id()) and withdrawn_at is not null);

-- cases ---------------------------------------------------------------------

-- A person reads their own cases.
create policy cases_select_own on app.cases for select to authenticated
  using (user_id = (select app.user_id()));
-- A person makes a case for themselves, as a draft.
create policy cases_insert_own on app.cases for insert to authenticated
  with check (user_id = (select app.user_id()) and status = 'draft');
-- A person corrects their own case (the grant limits the columns).
create policy cases_update_own on app.cases for update to authenticated
  using (user_id = (select app.user_id()))
  with check (user_id = (select app.user_id()));
-- A person deletes their own case, and its story, papers, readings and questions go with it.
create policy cases_delete_own on app.cases for delete to authenticated
  using (user_id = (select app.user_id()));

-- case_stories --------------------------------------------------------------

-- A person reads the story of their own case.
create policy case_stories_select_own on app.case_stories for select to authenticated
  using (user_id = (select app.user_id()));
-- A person writes the story of their own case (the foreign key ties it to a case of theirs).
create policy case_stories_insert_own on app.case_stories for insert to authenticated
  with check (user_id = (select app.user_id()));
-- A person rewrites their own story (the grant limits the columns).
create policy case_stories_update_own on app.case_stories for update to authenticated
  using (user_id = (select app.user_id()))
  with check (user_id = (select app.user_id()));
-- A person removes their own story.
create policy case_stories_delete_own on app.case_stories for delete to authenticated
  using (user_id = (select app.user_id()));

-- documents -----------------------------------------------------------------

-- A person reads the list of their own papers.
create policy documents_select_own on app.documents for select to authenticated
  using (user_id = (select app.user_id()));
-- A person adds a paper to their own case; it starts unchecked.
create policy documents_insert_own on app.documents for insert to authenticated
  with check (user_id = (select app.user_id()) and status = 'checking' and rejected_reason is null);
-- A person removes their own paper.
create policy documents_delete_own on app.documents for delete to authenticated
  using (user_id = (select app.user_id()));

-- analysis_jobs -------------------------------------------------------------

-- A person sees how far the reading of their own case has got.
create policy analysis_jobs_select_own on app.analysis_jobs for select to authenticated
  using (user_id = (select app.user_id()));
-- A person asks for their own case to be read; the job starts in the queue.
create policy analysis_jobs_insert_own on app.analysis_jobs for insert to authenticated
  with check (user_id = (select app.user_id()) and state = 'queued' and attempt = 1);

-- analyses ------------------------------------------------------------------

-- A person reads the explanations of their own cases. Only the worker writes them.
create policy analyses_select_own on app.analyses for select to authenticated
  using (user_id = (select app.user_id()));

-- chat_messages -------------------------------------------------------------

-- A person reads the questions and replies of their own cases.
create policy chat_messages_select_own on app.chat_messages for select to authenticated
  using (user_id = (select app.user_id()));
-- A person asks a question about their own case; replies come from the worker.
create policy chat_messages_insert_own on app.chat_messages for insert to authenticated
  with check (user_id = (select app.user_id()) and role = 'user' and in_reply_to is null);

-- audit_log and usage_counters: no policies and no grants. Only the service role reaches them.
