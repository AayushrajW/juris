# Database

The Phase 1 database for Juris: Postgres, with row-level security so that one person can never reach another person's problems, papers or questions.

**The app does not use this yet.** The screens still run on the browser-only demo in `services/mock/`. This folder is the schema and the proof that it holds, ready for the server that will be written against it.

## What is here

| Path | What it is |
|---|---|
| `migrations/0001_init.sql` | The schema, its indexes, its grants and its row-level security policies. Plain SQL for Postgres 15 or newer. |
| `local/roles.sql` | The three roles a hosted Postgres already has. For local runs and tests only; never run it on the hosted database. |
| `../tests/db/` | Tests that run the migration on a real Postgres inside Node and then try to break it. |

## Who connects as what

The Next.js server is the only thing that talks to the database. The browser never does.

- **For a signed-in person**, the server opens a transaction, switches to the role `authenticated`, and says who the request is for:

  ```sql
  begin;
  set local role authenticated;
  select set_config('request.jwt.claims', '{"sub":"<the person's id>"}', true);
  -- the request's queries
  commit;
  ```

  Every policy compares a row's owner with `app.user_id()`, which reads that setting. Both the role and the setting end with the transaction, so the next request cannot inherit a person.

- **For background work** (reading a paper, writing an explanation, counting usage) the server uses `service_role`, which bypasses row-level security. Its grants are all that limit it.

- **`anon`** (nobody signed in) has no access to the `app` schema at all.

Everything lives in a schema called `app`, not `public`, so a data API that exposes `public` cannot reach it.

## The rules the schema keeps

1. Row-level security is enabled **and forced** on every table. A test reads the catalogue, so a table added later without it fails.
2. Every policy is for `authenticated` only and checks what it writes as well as what it reads.
3. A column only the server should write (a problem's status, a reading's progress, anything in an explanation, a reply) is **not granted** to a signed-in person at all. No policy has to be right for it to stay out of reach.
4. Every row that belongs to a problem carries the owner's id **and** a foreign key on `(case_id, user_id)`. A row cannot hang off somebody else's problem, whatever the policies say.
5. A person cannot create their own profile. The server does, straight after it has checked the sign-in code, with the number the code was sent to. Otherwise a person could claim any number.
6. Deleting a problem deletes its story, papers, readings, explanations and questions. Deleting a profile deletes everything of that person.

## What this does not protect against

Row-level security stops a query that forgets to say whose rows it wants. It does **not** stop SQL that an attacker wrote: such SQL can simply declare itself to be someone else by setting the claims again. One of the tests shows exactly this, on purpose.

So the server must keep two rules of its own:

- **No SQL is ever built from what a person typed.** Values go in as parameters, always.
- **The claims are set once, by the server, from the session it has verified**, before any query of the request runs.

## The audit log

`app.audit_log` records each access to a problem. It has no foreign keys on purpose: it keeps the ids of the person and the thing after both are gone, and nothing else. It never holds the words of a paper or a question, and a signed-in person cannot read or write it. How long its rows are kept is a decision still to be made (launch plan, decision 8).

## Running the tests

```bash
npm run test:db
```

No account, network or installed database is needed. The tests use [PGlite](https://pglite.dev), which is Postgres compiled to run inside Node, so the roles, grants and policies being tested are the real thing. They take about ten seconds and also run as part of `npm run check` and in CI.

One thing to know when writing more of them: PGlite has a single connection, so opening a transaction inside another one waits for ever. Make what you need first, then open the transaction.

## Applying the migration to a real database

In one transaction, so a failure leaves nothing half-made:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 --single-transaction -f db/migrations/0001_init.sql
```

`0001_init.sql` has never been applied anywhere, so it may still be edited. Once it has been applied to a shared database, changes go in a new numbered file.

## Known gaps, found in review

An independent reviewer attacked this schema as a signed-in person and as nobody. They found no way to read, change, delete or forge another person's rows, and no way to write a column only the server should write. What they did find, and what was not fixed straight away:

- **Daily limits are not enforced by the database.** A signed-in person's request can add a reading to the queue, or a question, without `usage_counters` moving, because only the server writes that table. When limits are built (launch plan, Phase 1 step 8), make the reading or the question as the service role in the same transaction that counts it, and take the insert grants on `analysis_jobs` and `chat_messages` away from `authenticated`.
- **Deleting the account resets the counters.** `usage_counters` hangs off the profile, so it goes when the profile goes, and the same person can sign in again with a fresh allowance. Key the counters by something that outlives the account, such as a keyed hash of the phone number.
- **No ceiling on how many problems, papers or questions one person can make.** The server must set one.
- **`chat_messages.seq` counts across all people.** A person who can read it on their own rows can work out how busy the whole service is. The server must not return it; better, replace it with a counter per problem.
- **`lock table` works on tables a person may delete from** (`cases`, `profiles`, `case_stories`, `documents`). Like replacing the claims, this needs SQL an attacker wrote, so the two rules above are what stop it. Also set a statement timeout and a lock timeout on the role the server connects as.

## Left for later

- The server that uses it: sessions, the queries behind each service, and the worker.
- File storage. Each paper row has a `storage_path` worked out from its owner, problem and id; the bucket and its access rules are not set up.
- The job queue. `analysis_jobs` records each reading and allows only one to be running per problem; what wakes the worker is not built.
- Retention: deleting old uploads and trimming the audit log on a schedule.
- Narrower grants for the service role, column by column. Today only the audit log and the consent records are protected from it.
- Protection against the claims being replaced by injected SQL (see above) beyond the two rules. It can be added later by signing the claims.
