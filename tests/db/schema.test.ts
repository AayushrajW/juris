import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  CHECK_VIOLATION,
  FOREIGN_KEY_VIOLATION,
  NOT_NULL_VIOLATION,
  UNIQUE_VIOLATION,
  analysisContent,
  asService,
  asUser,
  countAll,
  insertRow,
  makeAnalysis,
  makeCase,
  makeCaseWithStory,
  makeConsent,
  makeDocument,
  makeJob,
  makeMessage,
  makeProfile,
  isGrantRefusal,
  makeWorld,
  migrationFiles,
  newId,
  newPhone,
  openDatabase,
  readAsService,
  refusal,
  type Db,
  type Row,
  type Tx,
} from "./harness";

/*
 * The rules of the schema that are not about who is asking: what values are
 * allowed, what a retry does, what goes when a case or an account goes, and
 * the queries the services will run for paging.
 *
 * Rows here are mostly written as the service, which bypasses row-level
 * security and has every column, so a refusal can only come from the rule
 * under test. The reference queries are run as the person, as the server will.
 */

let db: Db;

beforeAll(async () => {
  db = await openDatabase();
});

afterAll(async () => {
  await db.close();
});

/** A new person with a profile, made as the service. */
async function person(): Promise<string> {
  const id = newId();
  await asService(db, (tx) => makeProfile(tx, id));
  return id;
}

/** A new person with a profile and one case, made as the service. */
async function personWithCase(): Promise<{ userId: string; caseId: string }> {
  const userId = await person();
  const made = await asService(db, (tx) => makeCase(tx, userId));
  return { userId, caseId: made.id as string };
}

async function expectCheck(work: Promise<unknown>, constraint: string): Promise<void> {
  const r = await refusal(work);
  expect(r.code, r.message).toBe(CHECK_VIOLATION);
  expect(r.message).toContain(constraint);
}

const TABLES = [
  "analyses",
  "analysis_jobs",
  "audit_log",
  "case_stories",
  "cases",
  "chat_messages",
  "consents",
  "documents",
  "profiles",
  "usage_counters",
];

// ---------------------------------------------------------------------------
// The shape of the schema
// ---------------------------------------------------------------------------

describe("every table is locked down", () => {
  it("schema app holds exactly the tables this suite knows about", async () => {
    const found = await db.query<{ name: string }>(
      `select c.relname as name from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'app' and c.relkind in ('r', 'p') order by 1`,
    );
    // A new table must be added here AND to TABLES in isolation.test.ts.
    expect(found.rows.map((row) => row.name)).toEqual(TABLES);
  });

  it("row-level security is enabled and forced on every table in schema app", async () => {
    const found = await db.query<{ name: string; enabled: boolean; forced: boolean }>(
      `select c.relname as name, c.relrowsecurity as enabled, c.relforcerowsecurity as forced
       from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'app' and c.relkind in ('r', 'p') order by 1`,
    );
    expect(found.rows.length).toBeGreaterThan(0);
    for (const table of found.rows) {
      expect(table.enabled, `${table.name}: row-level security is not enabled`).toBe(true);
      expect(table.forced, `${table.name}: row-level security is not forced`).toBe(true);
    }
  });

  it("there are no views, and no function runs with its owner's rights", async () => {
    const views = await db.query(
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'app' and c.relkind in ('v', 'm')`,
    );
    expect(views.rows).toEqual([]);
    const definers = await db.query(
      `select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'app' and p.prosecdef`,
    );
    expect(definers.rows).toEqual([]);
  });

  it("every policy is for role authenticated only, is tied to app.user_id(), and checks what it writes", async () => {
    const policies = await db.query<{
      tablename: string;
      policyname: string;
      permissive: string;
      roles: string[] | string;
      cmd: string;
      qual: string | null;
      with_check: string | null;
    }>("select * from pg_policies where schemaname = 'app' order by tablename, policyname");
    expect(policies.rows.length).toBeGreaterThan(0);
    for (const policy of policies.rows) {
      const name = `${policy.tablename}.${policy.policyname}`;
      const roles = Array.isArray(policy.roles) ? policy.roles : policy.roles.replace(/[{}]/g, "").split(",");
      expect(roles, `${name}: roles`).toEqual(["authenticated"]);
      expect(policy.cmd, `${name}: one policy per operation, never ALL`).not.toBe("ALL");
      const text = `${policy.qual ?? ""} ${policy.with_check ?? ""}`;
      expect(text, `${name}: does not ask app.user_id()`).toContain("app.user_id()");
      if (policy.cmd === "INSERT" || policy.cmd === "UPDATE") {
        expect(policy.with_check, `${name}: has no "with check"`).toBeTruthy();
      }
      if (policy.cmd !== "INSERT") {
        expect(policy.qual, `${name}: has no "using"`).toBeTruthy();
      }
    }
    const tablesWithPolicies = [...new Set(policies.rows.map((policy) => policy.tablename))].sort();
    expect(tablesWithPolicies).toEqual(TABLES.filter((name) => name !== "audit_log" && name !== "usage_counters"));
  });

  it("anon and public have no privilege on the schema, any table, any column or any function", async () => {
    for (const role of ["anon", "public"]) {
      if (role === "anon") {
        const schema = await db.query<{ usage: boolean; create: boolean }>(
          "select has_schema_privilege('anon', 'app', 'usage') as usage, has_schema_privilege('anon', 'app', 'create') as create",
        );
        expect(schema.rows[0]).toEqual({ usage: false, create: false });
      }
      const tables = await db.query(
        "select table_name, privilege_type from information_schema.role_table_grants where table_schema = 'app' and grantee = $1",
        [role === "public" ? "PUBLIC" : role],
      );
      expect(tables.rows, `${role}: table grants`).toEqual([]);
      const columns = await db.query(
        "select table_name, column_name, privilege_type from information_schema.column_privileges where table_schema = 'app' and grantee = $1",
        [role === "public" ? "PUBLIC" : role],
      );
      expect(columns.rows, `${role}: column grants`).toEqual([]);
      const routines = await db.query(
        "select routine_name from information_schema.routine_privileges where routine_schema = 'app' and grantee = $1",
        [role === "public" ? "PUBLIC" : role],
      );
      expect(routines.rows, `${role}: function grants`).toEqual([]);
    }
  });

  it("authenticated has exactly these grants and no others", async () => {
    // The whole of what a signed-in person can do, column by column. A change
    // here is a change to the security boundary: review it as one.
    const expected: Record<string, { select: boolean; delete: boolean; insert: string[]; update: string[] }> = {
      profiles: {
        select: true,
        delete: true,
        // None: the server makes the profile, with the number the sign-in code went to.
        insert: [],
        update: ["display_name", "preferred_language"],
      },
      consents: {
        select: true,
        delete: false,
        insert: ["is_adult", "policy_version", "purpose", "user_id"],
        update: ["withdrawn_at"],
      },
      cases: {
        select: true,
        delete: true,
        insert: ["category", "city", "request_id", "source", "state", "title", "user_id"],
        update: ["category", "city", "state", "title"],
      },
      case_stories: {
        select: true,
        delete: true,
        insert: ["case_id", "narrative", "user_id", "what_happened", "what_outcome_wanted", "when_happened", "who_involved"],
        update: ["narrative", "what_happened", "what_outcome_wanted", "when_happened", "who_involved"],
      },
      documents: {
        select: true,
        delete: true,
        insert: ["byte_size", "case_id", "file_name", "kind", "mime_type", "request_id", "user_id"],
        update: [],
      },
      analysis_jobs: { select: true, delete: false, insert: ["case_id", "language", "user_id"], update: [] },
      analyses: { select: true, delete: false, insert: [], update: [] },
      chat_messages: {
        select: true,
        delete: false,
        insert: ["case_id", "content", "language", "request_id", "user_id"],
        update: [],
      },
      audit_log: { select: false, delete: false, insert: [], update: [] },
      usage_counters: { select: false, delete: false, insert: [], update: [] },
    };

    const actual: typeof expected = {};
    for (const table of TABLES) {
      const tableLevel = await db.query<{ s: boolean; d: boolean; t: boolean; r: boolean; g: boolean }>(
        `select has_table_privilege('authenticated', $1, 'select') as s,
                has_table_privilege('authenticated', $1, 'delete') as d,
                has_table_privilege('authenticated', $1, 'truncate') as t,
                has_table_privilege('authenticated', $1, 'references') as r,
                has_table_privilege('authenticated', $1, 'trigger') as g`,
        [`app.${table}`],
      );
      const level = tableLevel.rows[0];
      expect([level.t, level.r, level.g], `${table}: truncate, references, trigger`).toEqual([false, false, false]);
      const columns = await db.query<{ name: string; i: boolean; u: boolean }>(
        `select a.attname as name,
                has_column_privilege('authenticated', a.attrelid, a.attnum, 'insert') as i,
                has_column_privilege('authenticated', a.attrelid, a.attnum, 'update') as u
         from pg_attribute a
         where a.attrelid = $1::regclass and a.attnum > 0 and not a.attisdropped
         order by a.attname`,
        [`app.${table}`],
      );
      actual[table] = {
        select: level.s,
        delete: level.d,
        insert: columns.rows.filter((column) => column.i).map((column) => column.name),
        update: columns.rows.filter((column) => column.u).map((column) => column.name),
      };
    }
    expect(actual).toEqual(expected);
  });

  it("service_role can do its work everywhere, and only add to and read the audit log", async () => {
    for (const table of TABLES) {
      const result = await db.query<{ s: boolean; i: boolean; u: boolean; d: boolean; t: boolean }>(
        `select has_table_privilege('service_role', $1, 'select') as s,
                has_table_privilege('service_role', $1, 'insert') as i,
                has_table_privilege('service_role', $1, 'update') as u,
                has_table_privilege('service_role', $1, 'delete') as d,
                has_table_privilege('service_role', $1, 'truncate') as t`,
        [`app.${table}`],
      );
      // The audit log and the record of consents can be added to and read, not rewritten or removed.
      const appendOnly = table === "audit_log" || table === "consents";
      expect(result.rows[0], table).toEqual({ s: true, i: true, u: !appendOnly, d: !appendOnly, t: false });
    }
  });

  it("the service can withdraw a consent for a person, and can neither rewrite nor remove one", async () => {
    const userId = await person();
    const consent = await asService(db, (tx) => makeConsent(tx, userId));

    for (const statement of [
      "delete from app.consents where id = $1",
      "update app.consents set granted_at = '2001-01-01' where id = $1",
      "update app.consents set is_adult = false where id = $1",
      "update app.consents set purpose = 'reminders' where id = $1",
    ]) {
      const r = await refusal(asService(db, (tx) => tx.query(statement, [consent.id])));
      expect(isGrantRefusal(r), `${statement}: ${r.message}`).toBe(true);
    }
    await asService(db, (tx) => tx.query("update app.consents set withdrawn_at = now() where id = $1", [consent.id]));
    const after = await readAsService(db, "consents", "id = $1", [consent.id]);
    expect(after?.withdrawn_at).not.toBeNull();
    expect(after?.is_adult).toBe(true);
  });

  it("a function added later is not callable by everyone unless its migration says so", async () => {
    await db.exec("create function app.added_later() returns int language sql as 'select 1'");
    try {
      const result = await db.query<{ p: boolean; a: boolean; n: boolean }>(
        `select has_function_privilege('public', 'app.added_later()', 'execute') as p,
                has_function_privilege('authenticated', 'app.added_later()', 'execute') as a,
                has_function_privilege('anon', 'app.added_later()', 'execute') as n`,
      );
      expect(result.rows[0]).toEqual({ p: false, a: false, n: false });
    } finally {
      await db.exec("drop function app.added_later()");
    }
  });

  it("the migrations create no roles and nothing outside schema app", async () => {
    for (const name of migrationFiles()) {
      const sql = readFileSync(fileURLToPath(new URL(`../../db/migrations/${name}`, import.meta.url)), "utf8")
        .split("\n")
        .filter((line) => !line.trimStart().startsWith("--"))
        .join("\n");
      expect(sql, `${name}: creates or alters a role`).not.toMatch(/\b(create|alter|drop)\s+(role|user)\b/i);
      expect(sql, `${name}: opens its own transaction`).not.toMatch(/^\s*(begin|commit)\s*;/im);
    }
    const stray = await db.query(
      `select n.nspname, c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'S')`,
    );
    expect(stray.rows).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Allowed values
// ---------------------------------------------------------------------------

describe("check constraints", () => {
  it("profiles: the phone is in international form, the language is one of mr, hi, en, and the phone is unique", async () => {
    for (const phone of ["9876543210", "+91 98765 43210", "+0123456789", "+91", "", "+9198765432101234567"]) {
      await expectCheck(asService(db, (tx) => makeProfile(tx, newId(), { phone })), "profiles_phone_e164");
    }
    for (const preferred_language of ["fr", "MR", ""]) {
      await expectCheck(
        asService(db, (tx) => makeProfile(tx, newId(), { preferred_language })),
        "profiles_language_known",
      );
    }
    await expectCheck(
      asService(db, (tx) => makeProfile(tx, newId(), { display_name: "x".repeat(81) })),
      "profiles_display_name_length",
    );
    await expectCheck(asService(db, (tx) => makeProfile(tx, newId(), { email: "not an email" })), "profiles_email_shape");

    const phone = newPhone();
    const made = await asService(db, (tx) =>
      makeProfile(tx, newId(), { phone, email: "asha@example.org", display_name: "x".repeat(80), preferred_language: "hi" }),
    );
    // Nobody is asked for a name or an email to get in, and Marathi is the default.
    const plain = await asService(db, (tx) => makeProfile(tx, newId()));
    expect(plain).toMatchObject({ display_name: "", email: null, preferred_language: "mr" });
    expect(made.phone).toBe(phone);

    const twice = await refusal(asService(db, (tx) => makeProfile(tx, newId(), { phone })));
    expect(twice.code, twice.message).toBe(UNIQUE_VIOLATION);
    const noPhone = await refusal(asService(db, (tx) => insertRow(tx, "profiles", { id: newId() })));
    expect(noPhone.code, noPhone.message).toBe(NOT_NULL_VIOLATION);
  });

  it("cases: the title has 1 to 120 characters and is not only spaces", async () => {
    const userId = await person();
    for (const title of ["", "   ", "x".repeat(121)]) {
      await expectCheck(asService(db, (tx) => makeCase(tx, userId, { title })), "cases_title_length");
    }
    for (const title of ["x", "x".repeat(120), "घरमालकाची नोटीस"]) {
      await asService(db, (tx) => makeCase(tx, userId, { title }));
    }
    // 120 characters, not 120 bytes: Devanagari takes three bytes a letter.
    await asService(db, (tx) => makeCase(tx, userId, { title: "क".repeat(120) }));
  });

  it("cases: category, source and status take the values of domain/case.ts and no others", async () => {
    const userId = await person();
    const categories = ["consumer", "tenancy", "employment", "family", "criminal_complaint", "property", "documents_id", "other"];
    const sources = ["document", "description", "document_and_description"];
    const statuses = ["draft", "processing", "ready", "needs_more_info", "error"];
    for (const category of categories) await asService(db, (tx) => makeCase(tx, userId, { category }));
    for (const source of sources) await asService(db, (tx) => makeCase(tx, userId, { source }));
    for (const status of statuses) await asService(db, (tx) => makeCase(tx, userId, { status }));

    await expectCheck(asService(db, (tx) => makeCase(tx, userId, { category: "tax" })), "cases_category_known");
    await expectCheck(asService(db, (tx) => makeCase(tx, userId, { source: "voice" })), "cases_source_known");
    await expectCheck(asService(db, (tx) => makeCase(tx, userId, { status: "closed" })), "cases_status_known");
    await expectCheck(asService(db, (tx) => makeCase(tx, userId, { city: "" })), "cases_city_length");
    await expectCheck(asService(db, (tx) => makeCase(tx, userId, { request_id: "" })), "cases_request_id_length");

    const made = await asService(db, (tx) => makeCase(tx, userId));
    expect(made).toMatchObject({ status: "draft", city: null, state: null, request_id: null });
    await expectCheck(
      asService(db, (tx) => tx.query("update app.cases set status = 'archived' where id = $1", [made.id])),
      "cases_status_known",
    );
  });

  it("case_stories: one per case, and the narrative is not empty", async () => {
    const { userId, caseId } = await personWithCase();
    await expectCheck(
      asService(db, (tx) => insertRow(tx, "case_stories", { case_id: caseId, user_id: userId, narrative: "" })),
      "case_stories_narrative_length",
    );
    await asService(db, (tx) => insertRow(tx, "case_stories", { case_id: caseId, user_id: userId, narrative: "It began in May." }));
    const second = await refusal(
      asService(db, (tx) => insertRow(tx, "case_stories", { case_id: caseId, user_id: userId, narrative: "Again." })),
    );
    expect(second.code, second.message).toBe(UNIQUE_VIOLATION);
  });

  it("documents: kind and status are known, the size is real, and a reason is given only for a rejected paper", async () => {
    const { userId, caseId } = await personWithCase();
    await expectCheck(asService(db, (tx) => makeDocument(tx, userId, caseId, { kind: "video" })), "documents_kind_known");
    await expectCheck(asService(db, (tx) => makeDocument(tx, userId, caseId, { status: "uploaded" })), "documents_status_known");
    await expectCheck(asService(db, (tx) => makeDocument(tx, userId, caseId, { byte_size: 0 })), "documents_byte_size_range");
    await expectCheck(
      asService(db, (tx) => makeDocument(tx, userId, caseId, { byte_size: 52_428_801 })),
      "documents_byte_size_range",
    );
    await expectCheck(asService(db, (tx) => makeDocument(tx, userId, caseId, { file_name: "" })), "documents_file_name_length");
    await expectCheck(
      asService(db, (tx) => makeDocument(tx, userId, caseId, { status: "ready", rejected_reason: "malware" })),
      "documents_rejected_reason_only_when_rejected",
    );
    for (const kind of ["pdf", "image", "other"]) await asService(db, (tx) => makeDocument(tx, userId, caseId, { kind }));
    const rejected = await asService(db, (tx) =>
      makeDocument(tx, userId, caseId, { status: "rejected", rejected_reason: "file_type" }),
    );
    expect(rejected.status).toBe("rejected");
    expect((await asService(db, (tx) => makeDocument(tx, userId, caseId))).status).toBe("checking");
  });

  it("analysis_jobs: state, language and failure take known values, and a failure is recorded exactly when the job failed", async () => {
    const { userId } = await personWithCase();
    // The case is made first, in its own transaction. PGlite has one connection:
    // opening a transaction inside another waits for ever.
    const jobOnFreshCase = async (extra: Row) => {
      const caseId = (await asService(db, (tx) => makeCase(tx, userId))).id as string;
      return asService(db, (tx) => makeJob(tx, userId, caseId, extra));
    };

    await expectCheck(jobOnFreshCase({ state: "paused" }), "analysis_jobs_state_known");
    await expectCheck(jobOnFreshCase({ language: "ta" }), "analysis_jobs_language_known");
    await expectCheck(
      jobOnFreshCase({ state: "failed", failure_reason: "tired", retryable: true }),
      "analysis_jobs_failure_reason_known",
    );
    await expectCheck(
      jobOnFreshCase({ state: "failed" }),
      "analysis_jobs_failure_only_when_failed",
    );
    await expectCheck(
      jobOnFreshCase({ state: "failed", failure_reason: "internal" }),
      "analysis_jobs_failure_only_when_failed",
    );
    await expectCheck(
      jobOnFreshCase({ state: "ready", failure_reason: "internal", retryable: false }),
      "analysis_jobs_failure_only_when_failed",
    );
    await expectCheck(jobOnFreshCase({ attempt: 0 }), "analysis_jobs_attempt_positive");

    for (const state of ["queued", "reading", "writing", "ready"]) {
      await jobOnFreshCase({ state });
    }
    for (const failure_reason of ["unreadable", "unsupported", "too_long", "internal"]) {
      await jobOnFreshCase({ state: "failed", failure_reason, retryable: failure_reason === "internal" });
    }
  });

  it("analysis_jobs: a case has at most one reading under way, so two requests at once cannot start two", async () => {
    const { userId, caseId } = await personWithCase();
    const first = await asUser(db, userId, (tx) => makeJob(tx, userId, caseId));
    const second = await refusal(asUser(db, userId, (tx) => makeJob(tx, userId, caseId)));
    expect(second.code, second.message).toBe(UNIQUE_VIOLATION);
    expect(second.message).toContain("analysis_jobs_one_running");

    for (const state of ["reading", "writing"]) {
      await asService(db, (tx) => tx.query("update app.analysis_jobs set state = $1 where id = $2", [state, first.id]));
      const still = await refusal(asUser(db, userId, (tx) => makeJob(tx, userId, caseId)));
      expect(still.code, still.message).toBe(UNIQUE_VIOLATION);
    }
    // Once it has failed (or finished), the case can be read again.
    await asService(db, (tx) =>
      tx.query("update app.analysis_jobs set state = 'failed', failure_reason = 'internal', retryable = true where id = $1", [first.id]),
    );
    const again = await asUser(db, userId, (tx) => makeJob(tx, userId, caseId));
    expect(again.state).toBe("queued");
  });

  it("analyses: language and review state are known, the content is an object, and a job gives one explanation", async () => {
    const { userId, caseId } = await personWithCase();
    const job = await asService(db, (tx) => makeJob(tx, userId, caseId, { state: "ready" }));
    const jobId = job.id as string;
    await expectCheck(asService(db, (tx) => makeAnalysis(tx, userId, caseId, jobId, { language: "ta" })), "analyses_language_known");
    await expectCheck(
      asService(db, (tx) => makeAnalysis(tx, userId, caseId, jobId, { review_state: "skipped" })),
      "analyses_review_state_known",
    );
    for (const content of ["[]", '"text"', "null"]) {
      const r = await refusal(
        asService(db, (tx) =>
          tx.query(
            `insert into app.analyses (case_id, user_id, job_id, language, content, model, prompt_version)
             values ($1, $2, $3, 'mr', $4::jsonb, 'm', 'p')`,
            [caseId, userId, jobId, content],
          ),
        ),
      );
      expect([CHECK_VIOLATION, NOT_NULL_VIOLATION], r.message).toContain(r.code);
    }
    // Which model and which prompt wrote it is always recorded (launch plan, rule 8).
    for (const missing of ["model", "prompt_version"]) {
      const r = await refusal(asService(db, (tx) => makeAnalysis(tx, userId, caseId, jobId, { [missing]: undefined })));
      expect(r.code, r.message).toBe(NOT_NULL_VIOLATION);
      await expectCheck(asService(db, (tx) => makeAnalysis(tx, userId, caseId, jobId, { [missing]: "" })), `analyses_${missing}_length`);
    }

    const made = await asService(db, (tx) => makeAnalysis(tx, userId, caseId, jobId));
    expect(made).toMatchObject({ review_state: "not_required", model: "test-model", prompt_version: "test-1" });
    const second = await refusal(asService(db, (tx) => makeAnalysis(tx, userId, caseId, jobId)));
    expect(second.code, second.message).toBe(UNIQUE_VIOLATION);
    const noJob = await refusal(asService(db, (tx) => makeAnalysis(tx, userId, caseId, newId())));
    expect(noJob.code, noJob.message).toBe(FOREIGN_KEY_VIOLATION);
  });

  it("chat_messages: role and language are known, a message has words, and only a reply answers a question", async () => {
    const { userId, caseId } = await personWithCase();
    await expectCheck(asService(db, (tx) => makeMessage(tx, userId, caseId, { role: "system" })), "chat_messages_role_known");
    await expectCheck(asService(db, (tx) => makeMessage(tx, userId, caseId, { language: "ta" })), "chat_messages_language_known");
    await expectCheck(asService(db, (tx) => makeMessage(tx, userId, caseId, { content: "" })), "chat_messages_content_length");

    const question = await asService(db, (tx) => makeMessage(tx, userId, caseId, { request_id: "send-1" }));
    expect(question).toMatchObject({ role: "user", language: null });
    await expectCheck(
      asService(db, (tx) => makeMessage(tx, userId, caseId, { in_reply_to: question.id })),
      "chat_messages_only_replies_reply",
    );
    await expectCheck(
      asService(db, (tx) => makeMessage(tx, userId, caseId, { role: "assistant", request_id: "send-2" })),
      "chat_messages_only_questions_carry_request",
    );
    await asService(db, (tx) => makeMessage(tx, userId, caseId, { role: "assistant", in_reply_to: question.id, language: "hi" }));
    // A question has one reply.
    const second = await refusal(
      asService(db, (tx) => makeMessage(tx, userId, caseId, { role: "assistant", in_reply_to: question.id })),
    );
    expect(second.code, second.message).toBe(UNIQUE_VIOLATION);
  });

  it("consents: the purpose is a short code, and a purpose has one live consent per policy version", async () => {
    const userId = await person();
    await expectCheck(asService(db, (tx) => makeConsent(tx, userId, { purpose: "Document Processing" })), "consents_purpose_known");
    // Only the purposes the schema names, so nobody can fill the table with made-up ones.
    await expectCheck(asUser(db, userId, (tx) => makeConsent(tx, userId, { purpose: "anything_else" })), "consents_purpose_known");
    await expectCheck(asService(db, (tx) => makeConsent(tx, userId, { policy_version: "" })), "consents_policy_version_length");
    const noAge = await refusal(asService(db, (tx) => makeConsent(tx, userId, { is_adult: undefined })));
    expect(noAge.code, noAge.message).toBe(NOT_NULL_VIOLATION);
    await expectCheck(
      asService(db, (tx) => makeConsent(tx, userId, { granted_at: "2026-02-01", withdrawn_at: "2026-01-01" })),
      "consents_withdrawn_after_granted",
    );

    const first = await asUser(db, userId, (tx) => makeConsent(tx, userId));
    const twice = await refusal(asUser(db, userId, (tx) => makeConsent(tx, userId)));
    expect(twice.code, twice.message).toBe(UNIQUE_VIOLATION);
    // A new policy version is a new consent, and so is agreeing again after withdrawing.
    await asUser(db, userId, (tx) => makeConsent(tx, userId, { policy_version: "2026-06" }));
    await asUser(db, userId, (tx) => tx.query("update app.consents set withdrawn_at = now() where id = $1", [first.id]));
    await asUser(db, userId, (tx) => makeConsent(tx, userId));
    // The withdrawn one is still on record.
    expect(await countAll(db, "consents", "user_id = $1", [userId])).toBe(3);
    expect(await countAll(db, "consents", "user_id = $1 and withdrawn_at is not null", [userId])).toBe(1);
  });

  it("audit_log and usage_counters: codes are codes, counts are not negative, and audit details stay small", async () => {
    const userId = await person();
    await expectCheck(
      asService(db, (tx) => insertRow(tx, "audit_log", { user_id: userId, action: "Read Case!", subject_type: "case" })),
      "audit_log_action_shape",
    );
    await expectCheck(
      asService(db, (tx) =>
        insertRow(tx, "audit_log", { user_id: userId, action: "case.read", subject_type: "case", meta: { text: "x".repeat(3000) } }),
      ),
      "audit_log_meta_small_object",
    );
    const entry = await asService(db, (tx) =>
      insertRow(tx, "audit_log", { user_id: userId, action: "case.read", subject_type: "case", meta: { via: "web" } }),
    );
    expect(entry.meta).toEqual({ via: "web" });

    await expectCheck(
      asService(db, (tx) => insertRow(tx, "usage_counters", { user_id: userId, day: "2026-10-10", kind: "analysis", count: -1 })),
      "usage_counters_count_not_negative",
    );
    const orphan = await refusal(
      asService(db, (tx) => insertRow(tx, "usage_counters", { user_id: newId(), day: "2026-10-10", kind: "analysis" })),
    );
    expect(orphan.code, orphan.message).toBe(FOREIGN_KEY_VIOLATION);
  });
});

// ---------------------------------------------------------------------------
// Retry safety
// ---------------------------------------------------------------------------

describe("request ids make a retry safe", () => {
  const targets: [string, (tx: Tx, userId: string, caseId: string, requestId: string | null) => Promise<Row>][] = [
    ["cases", (tx, userId, _caseId, request_id) => makeCase(tx, userId, { request_id })],
    ["documents", (tx, userId, caseId, request_id) => makeDocument(tx, userId, caseId, { request_id })],
    ["chat_messages", (tx, userId, caseId, request_id) => makeMessage(tx, userId, caseId, { request_id })],
  ];

  it.each(targets)("%s: a request id is used once per person, and two people may use the same one", async (table, insert) => {
    const one = await personWithCase();
    const two = await personWithCase();

    await asUser(db, one.userId, (tx) => insert(tx, one.userId, one.caseId, "same-id"));
    const again = await refusal(asUser(db, one.userId, (tx) => insert(tx, one.userId, one.caseId, "same-id")));
    expect(again.code, again.message).toBe(UNIQUE_VIOLATION);
    expect(again.message).toContain(`${table}_request_once`);

    // Another person is free to use it, and learns nothing from doing so.
    await asUser(db, two.userId, (tx) => insert(tx, two.userId, two.caseId, "same-id"));
    // A different id, and no id at all, are always fine.
    await asUser(db, one.userId, (tx) => insert(tx, one.userId, one.caseId, "other-id"));
    await asUser(db, one.userId, (tx) => insert(tx, one.userId, one.caseId, null));
    await asUser(db, one.userId, (tx) => insert(tx, one.userId, one.caseId, null));

    expect(await countAll(db, table, "user_id = $1 and request_id = 'same-id'", [one.userId])).toBe(1);
    expect(await countAll(db, table, "user_id = $1 and request_id = 'same-id'", [two.userId])).toBe(1);
  });

  // REFERENCE (CaseService.create with a requestId). One statement, safe when
  // two copies of the request arrive together: the second inserts nothing and
  // reads back what the first made. The service then compares what was sent
  // with what it got back: the same is the first answer again, different is
  // "conflict" (request_reused).
  const CREATE_CASE_ONCE = `
    with made as (
      insert into app.cases (user_id, title, category, source, request_id)
      values (app.user_id(), $1, $2, $3, $4)
      on conflict (user_id, request_id) where request_id is not null do nothing
      returning *, true as is_new
    )
    select * from made
    union all
    select c.*, false as is_new from app.cases c
    where c.user_id = app.user_id() and c.request_id = $4 and not exists (select 1 from made)`;

  it("cases: the create-once query returns the first case again instead of making a second", async () => {
    const userId = await person();
    const run = (title: string) =>
      asUser(db, userId, (tx) => tx.query<Row>(CREATE_CASE_ONCE, [title, "tenancy", "description", "create-1"]));

    const first = await run("My deposit");
    expect(first.rows).toHaveLength(1);
    expect(first.rows[0]).toMatchObject({ title: "My deposit", is_new: true, status: "draft" });

    const retry = await run("My deposit");
    expect(retry.rows).toHaveLength(1);
    expect(retry.rows[0]).toMatchObject({ id: first.rows[0].id, title: "My deposit", is_new: false });

    // Reused with different contents: the first case comes back unchanged, for the service to report request_reused.
    const reused = await run("Something else");
    expect(reused.rows[0]).toMatchObject({ id: first.rows[0].id, title: "My deposit", is_new: false });
    expect(await countAll(db, "cases", "user_id = $1", [userId])).toBe(1);
  });

  // REFERENCE (ChatService.send with a requestId that was seen before): the
  // question that carried the id and the reply to it, if it has been written.
  const QUESTION_AND_REPLY = `
    select q.id as question_id, q.content as question, r.id as reply_id, r.content as reply
    from app.chat_messages q
    left join app.chat_messages r on r.in_reply_to = q.id
    where q.user_id = app.user_id() and q.request_id = $1`;

  it("chat_messages: a repeated send finds the first question and its reply", async () => {
    const { userId, caseId } = await personWithCase();
    const question = await asUser(db, userId, (tx) => makeMessage(tx, userId, caseId, { request_id: "send-1" }));

    const waiting = await asUser(db, userId, (tx) => tx.query<Row>(QUESTION_AND_REPLY, ["send-1"]));
    expect(waiting.rows).toEqual([
      { question_id: question.id, question: question.content, reply_id: null, reply: null },
    ]);

    const reply = await asService(db, (tx) =>
      makeMessage(tx, userId, caseId, { role: "assistant", content: "You have until the 31st.", in_reply_to: question.id }),
    );
    const answered = await asUser(db, userId, (tx) => tx.query<Row>(QUESTION_AND_REPLY, ["send-1"]));
    expect(answered.rows).toEqual([
      { question_id: question.id, question: question.content, reply_id: reply.id, reply: "You have until the 31st." },
    ]);
    const unknown = await asUser(db, userId, (tx) => tx.query<Row>(QUESTION_AND_REPLY, ["send-9"]));
    expect(unknown.rows).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// What goes with what
// ---------------------------------------------------------------------------

describe("cascades", () => {
  const CASE_CHILDREN = ["case_stories", "documents", "analysis_jobs", "analyses", "chat_messages"];

  it("deleting a case removes its story, papers, readings, explanations and questions, and nothing else", async () => {
    const world = await makeWorld(db);
    const kept = await asUser(db, world.userId, async (tx) => {
      const other = await makeCaseWithStory(tx, world.userId, { title: "Another problem" });
      await makeDocument(tx, world.userId, other.case.id as string);
      return other.case.id as string;
    });
    for (const table of CASE_CHILDREN) {
      expect(await countAll(db, table, "case_id = $1", [world.caseId]), table).toBeGreaterThan(0);
    }

    // As the person, who has no grant to delete readings, explanations or messages themselves.
    const deleted = await asUser(db, world.userId, (tx) => tx.query("delete from app.cases where id = $1", [world.caseId]));
    expect(deleted.affectedRows).toBe(1);

    expect(await countAll(db, "cases", "id = $1", [world.caseId])).toBe(0);
    for (const table of CASE_CHILDREN) {
      expect(await countAll(db, table, "case_id = $1", [world.caseId]), table).toBe(0);
    }
    // The person, their consent, their other case and the record of access all remain.
    expect(await countAll(db, "profiles", "id = $1", [world.userId])).toBe(1);
    expect(await countAll(db, "consents", "user_id = $1", [world.userId])).toBe(1);
    expect(await countAll(db, "usage_counters", "user_id = $1", [world.userId])).toBe(1);
    expect(await countAll(db, "cases", "id = $1", [kept])).toBe(1);
    expect(await countAll(db, "case_stories", "case_id = $1", [kept])).toBe(1);
    expect(await countAll(db, "documents", "case_id = $1", [kept])).toBe(1);
    expect(await countAll(db, "audit_log", "subject_id = $1", [world.caseId])).toBe(1);
  });

  it("deleting a profile removes everything of that person, except the audit trail", async () => {
    const world = await makeWorld(db);
    const bystander = await makeWorld(db);

    const deleted = await asUser(db, world.userId, (tx) => tx.query("delete from app.profiles where id = $1", [world.userId]));
    expect(deleted.affectedRows).toBe(1);

    expect(await countAll(db, "profiles", "id = $1", [world.userId])).toBe(0);
    for (const table of ["consents", "cases", ...CASE_CHILDREN, "usage_counters"]) {
      expect(await countAll(db, table, "user_id = $1", [world.userId]), table).toBe(0);
      expect(await countAll(db, table, "user_id = $1", [bystander.userId]), `${table} of someone else`).toBeGreaterThan(0);
    }
    // The audit trail is kept: ids and codes only, no phone, no name, no words from a paper.
    const trail = await readAsService(db, "audit_log", "id = $1", [world.auditId]);
    expect(trail).toMatchObject({ user_id: world.userId, action: "case.read", subject_id: world.caseId, meta: {} });
    // The phone number is free again, for whoever holds it next.
    await asService(db, (tx) => makeProfile(tx, newId(), { phone: world.phone }));
  });

  it("a case cannot be made for a person who does not exist", async () => {
    const r = await refusal(asService(db, (tx) => makeCase(tx, newId())));
    expect(r.code, r.message).toBe(FOREIGN_KEY_VIOLATION);
  });
});

// ---------------------------------------------------------------------------
// updated_at
// ---------------------------------------------------------------------------

describe("updated_at", () => {
  const pause = () => new Promise((resolve) => setTimeout(resolve, 20));
  const time = (value: unknown) => (value as Date).getTime();

  it("profiles: moves when the person changes their profile, and created_at does not", async () => {
    const userId = newId();
    const made = await asService(db, (tx) => makeProfile(tx, userId));
    expect(time(made.updated_at)).toBe(time(made.created_at));
    await pause();
    await asUser(db, userId, (tx) => tx.query("update app.profiles set display_name = 'Asha' where id = $1", [userId]));
    const after = await readAsService(db, "profiles", "id = $1", [userId]);
    expect(time(after?.updated_at)).toBeGreaterThan(time(made.updated_at));
    expect(time(after?.created_at)).toBe(time(made.created_at));
  });

  it("cases: moves when the person renames the case and when the worker changes its status", async () => {
    const userId = await person();
    const made = await asUser(db, userId, (tx) => makeCase(tx, userId));
    await pause();
    await asUser(db, userId, (tx) => tx.query("update app.cases set title = 'Renamed' where id = $1", [made.id]));
    const renamed = await readAsService(db, "cases", "id = $1", [made.id]);
    expect(time(renamed?.updated_at)).toBeGreaterThan(time(made.updated_at));
    await pause();
    await asService(db, (tx) => tx.query("update app.cases set status = 'processing' where id = $1", [made.id]));
    const processing = await readAsService(db, "cases", "id = $1", [made.id]);
    expect(time(processing?.updated_at)).toBeGreaterThan(time(renamed?.updated_at));
    expect(time(processing?.created_at)).toBe(time(made.created_at));
  });

  it("analysis_jobs: moves when the state changes, and started_at does not", async () => {
    const { userId, caseId } = await personWithCase();
    const job = await asUser(db, userId, (tx) => makeJob(tx, userId, caseId));
    await pause();
    await asService(db, (tx) => tx.query("update app.analysis_jobs set state = 'reading' where id = $1", [job.id]));
    const after = await readAsService(db, "analysis_jobs", "id = $1", [job.id]);
    expect(time(after?.updated_at)).toBeGreaterThan(time(job.updated_at));
    expect(time(after?.started_at)).toBe(time(job.started_at));
  });

  it.each(["profiles", "cases", "analysis_jobs"])("%s: is set by the database, whatever the statement says", async (table) => {
    const world = await makeWorld(db);
    const key = table === "profiles" ? world.userId : table === "cases" ? world.caseId : world.jobId;
    await asService(db, (tx) => tx.query(`update app.${table} set updated_at = '2001-01-01' where id = $1`, [key]));
    const after = await readAsService(db, table, "id = $1", [key]);
    expect(Math.abs(time(after?.updated_at) - Date.now())).toBeLessThan(60_000);
  });
});

// ---------------------------------------------------------------------------
// The queries the services will run. These are the reference: a service that
// pages differently has to change the test with it.
//
// A cursor carries created_at AS TEXT (created_at::text), never as a
// JavaScript Date: a Date keeps milliseconds, the database keeps
// microseconds, and a cursor that loses them skips or repeats rows.
// ---------------------------------------------------------------------------

describe("paging queries", () => {
  // REFERENCE (CaseService.list): a person's cases, newest first.
  //   $1 statuses to keep, or null for all   $2, $3 the cursor (created_at as text, id), or null for the first page
  //   $4 how many. Ask for one more than the page: if it comes back, there is a next page.
  const LIST_CASES = `
    select id, title, status, created_at::text as cursor_at
    from app.cases
    where user_id = app.user_id()
      and ($1::text[] is null or status = any ($1::text[]))
      and ($2::timestamptz is null or (created_at, id) < ($2::timestamptz, $3::uuid))
    order by created_at desc, id desc
    limit $4`;

  /** Walks every page of LIST_CASES and returns the titles in the order they came. */
  async function allCases(userId: string, pageSize: number, statuses: string[] | null = null): Promise<string[]> {
    const titles: string[] = [];
    let cursor: { at: string; id: string } | null = null;
    for (let guard = 0; guard < 50; guard += 1) {
      const page: { rows: Row[] } = await asUser(db, userId, (tx) =>
        tx.query<Row>(LIST_CASES, [statuses, cursor?.at ?? null, cursor?.id ?? null, pageSize + 1]),
      );
      const items = page.rows.slice(0, pageSize);
      titles.push(...items.map((row) => row.title as string));
      if (page.rows.length <= pageSize) return titles;
      const last = items[items.length - 1];
      cursor = { at: last.cursor_at as string, id: last.id as string };
    }
    throw new Error("paging did not end");
  }

  it("cases: newest first, every case exactly once whatever the page size, and only the person's own", async () => {
    const userId = await person();
    const other = await person();
    await asService(db, async (tx) => {
      for (let n = 1; n <= 7; n += 1) {
        await makeCase(tx, userId, { title: `case ${n}`, created_at: `2026-03-0${n}T10:00:00Z` });
      }
      await makeCase(tx, other, { title: "not mine", created_at: "2026-03-04T12:00:00Z" });
    });
    const newestFirst = ["case 7", "case 6", "case 5", "case 4", "case 3", "case 2", "case 1"];
    for (const pageSize of [1, 2, 3, 7, 50]) {
      expect(await allCases(userId, pageSize), `page size ${pageSize}`).toEqual(newestFirst);
    }
    expect(await allCases(other, 20)).toEqual(["not mine"]);
  });

  it("cases: cases made at the same instant, or a microsecond apart, are neither skipped nor shown twice", async () => {
    const userId = await person();
    const ids = [1, 2, 3, 4].map(() => newId()).sort();
    await asService(db, async (tx) => {
      // Four at exactly the same time: the id breaks the tie, highest first.
      for (const [index, id] of ids.entries()) {
        await makeCase(tx, userId, { id, title: `tie ${index + 1}`, created_at: "2026-04-01T10:00:00Z" });
      }
      // Three within one millisecond of each other.
      await makeCase(tx, userId, { title: "micro 1", created_at: "2026-04-02T10:00:00.000001Z" });
      await makeCase(tx, userId, { title: "micro 2", created_at: "2026-04-02T10:00:00.000002Z" });
      await makeCase(tx, userId, { title: "micro 3", created_at: "2026-04-02T10:00:00.000003Z" });
    });
    const expected = ["micro 3", "micro 2", "micro 1", "tie 4", "tie 3", "tie 2", "tie 1"];
    for (const pageSize of [1, 2, 3]) {
      expect(await allCases(userId, pageSize), `page size ${pageSize}`).toEqual(expected);
    }
  });

  it("cases: the order holds while paging, even when a new case arrives between pages", async () => {
    const userId = await person();
    await asService(db, async (tx) => {
      for (let n = 1; n <= 4; n += 1) await makeCase(tx, userId, { title: `old ${n}`, created_at: `2026-05-0${n}T10:00:00Z` });
    });
    const first = await asUser(db, userId, (tx) => tx.query<Row>(LIST_CASES, [null, null, null, 2]));
    expect(first.rows.map((row) => row.title)).toEqual(["old 4", "old 3"]);
    await asUser(db, userId, (tx) => makeCase(tx, userId, { title: "brand new" }));
    const last = first.rows[1];
    const second = await asUser(db, userId, (tx) => tx.query<Row>(LIST_CASES, [null, last.cursor_at, last.id, 2]));
    expect(second.rows.map((row) => row.title)).toEqual(["old 2", "old 1"]);
  });

  it("cases: the status filter keeps one status or several, and pages the same way", async () => {
    const userId = await person();
    await asService(db, async (tx) => {
      const statuses = ["draft", "ready", "processing", "ready", "needs_more_info", "error", "ready"];
      for (const [index, status] of statuses.entries()) {
        await makeCase(tx, userId, { title: `${index + 1} ${status}`, status, created_at: `2026-06-0${index + 1}T10:00:00Z` });
      }
    });
    expect(await allCases(userId, 2, ["ready"])).toEqual(["7 ready", "4 ready", "2 ready"]);
    expect(await allCases(userId, 1, ["ready", "needs_more_info"])).toEqual([
      "7 ready",
      "5 needs_more_info",
      "4 ready",
      "2 ready",
    ]);
    expect(await allCases(userId, 20, ["processing"])).toEqual(["3 processing"]);
    expect(await allCases(userId, 20, null)).toHaveLength(7);
  });

  // REFERENCE (DocumentService.listAll): every paper of a person with the
  // name of its case, newest first. Same cursor as cases.
  const LIST_ALL_DOCUMENTS = `
    select d.id, d.file_name, c.title as case_title, d.created_at::text as cursor_at
    from app.documents d
    join app.cases c on c.id = d.case_id and c.user_id = d.user_id
    where d.user_id = app.user_id()
      and ($1::timestamptz is null or (d.created_at, d.id) < ($1::timestamptz, $2::uuid))
    order by d.created_at desc, d.id desc
    limit $3`;

  // REFERENCE (DocumentService.list): the papers of one case, in the order they were added.
  const LIST_CASE_DOCUMENTS = `
    select id, file_name from app.documents
    where case_id = $1 and user_id = app.user_id()
    order by created_at, id`;

  it("documents: a person's papers across cases, newest first with the case's name, page by page", async () => {
    const userId = await person();
    const other = await personWithCase();
    const { rent, job } = await asService(db, async (tx) => {
      const rentCase = await makeCase(tx, userId, { title: "Rent" });
      const jobCase = await makeCase(tx, userId, { title: "Job" });
      const rentId = rentCase.id as string;
      const jobId = jobCase.id as string;
      await makeDocument(tx, userId, rentId, { file_name: "1.pdf", created_at: "2026-07-01T10:00:00Z" });
      await makeDocument(tx, userId, jobId, { file_name: "2.pdf", created_at: "2026-07-02T10:00:00Z" });
      await makeDocument(tx, userId, rentId, { file_name: "3.pdf", created_at: "2026-07-03T10:00:00Z" });
      await makeDocument(tx, userId, jobId, { file_name: "4.pdf", created_at: "2026-07-03T10:00:00Z" });
      await makeDocument(tx, userId, rentId, { file_name: "5.pdf", created_at: "2026-07-05T10:00:00Z" });
      await makeDocument(tx, other.userId, other.caseId, { file_name: "theirs.pdf", created_at: "2026-07-04T10:00:00Z" });
      return { rent: rentId, job: jobId };
    });

    const seen: Row[] = [];
    let cursor: { at: string; id: string } | null = null;
    for (let guard = 0; guard < 10; guard += 1) {
      const page: { rows: Row[] } = await asUser(db, userId, (tx) =>
        tx.query<Row>(LIST_ALL_DOCUMENTS, [cursor?.at ?? null, cursor?.id ?? null, 3]),
      );
      const items = page.rows.slice(0, 2);
      seen.push(...items);
      if (page.rows.length <= 2) break;
      cursor = { at: items[1].cursor_at as string, id: items[1].id as string };
    }
    const names = seen.map((row) => row.file_name);
    expect(names[0]).toBe("5.pdf");
    expect(names.slice(1, 3).sort()).toEqual(["3.pdf", "4.pdf"]); // same instant: the id decides
    expect(names.slice(3)).toEqual(["2.pdf", "1.pdf"]);
    expect(seen.find((row) => row.file_name === "2.pdf")?.case_title).toBe("Job");
    expect(seen.find((row) => row.file_name === "5.pdf")?.case_title).toBe("Rent");

    const ofRent = await asUser(db, userId, (tx) => tx.query<Row>(LIST_CASE_DOCUMENTS, [rent]));
    expect(ofRent.rows.map((row) => row.file_name)).toEqual(["1.pdf", "3.pdf", "5.pdf"]);
    const ofJob = await asUser(db, userId, (tx) => tx.query<Row>(LIST_CASE_DOCUMENTS, [job]));
    expect(ofJob.rows.map((row) => row.file_name)).toEqual(["2.pdf", "4.pdf"]);
    const notMine = await asUser(db, userId, (tx) => tx.query<Row>(LIST_CASE_DOCUMENTS, [other.caseId]));
    expect(notMine.rows).toEqual([]);
  });

  // REFERENCE (ChatService.list): the latest messages of a case, oldest first
  // within the page. The cursor is the seq of the oldest message on the page
  // (as text) and leads to the messages before it.
  const LIST_MESSAGES = `
    select id, role, content, cursor_seq from (
      select id, role, content, seq, seq::text as cursor_seq
      from app.chat_messages
      where case_id = $1 and user_id = app.user_id()
        and ($2::bigint is null or seq < $2::bigint)
      order by seq desc
      limit $3
    ) page
    order by seq`;

  it("chat_messages: the latest page reads oldest first, and the cursor leads to the messages before it", async () => {
    const { userId, caseId } = await personWithCase();
    const elsewhere = await asService(db, (tx) => makeCase(tx, userId, { title: "Another case" }));
    // Each question and its reply are saved in ONE transaction, so they share a
    // created_at; only seq tells which came first.
    for (let n = 1; n <= 3; n += 1) {
      await asService(db, async (tx) => {
        const question = await makeMessage(tx, userId, caseId, { content: `q${n}` });
        await makeMessage(tx, userId, caseId, { role: "assistant", content: `a${n}`, in_reply_to: question.id });
        await makeMessage(tx, userId, elsewhere.id as string, { content: `other case ${n}` });
      });
    }
    const sameInstant = await countAll(
      db,
      "chat_messages q join app.chat_messages r on r.in_reply_to = q.id",
      "q.case_id = $1 and q.created_at = r.created_at",
      [caseId],
    );
    expect(sameInstant).toBe(3);

    const latest = await asUser(db, userId, (tx) => tx.query<Row>(LIST_MESSAGES, [caseId, null, 4]));
    expect(latest.rows.map((row) => row.content)).toEqual(["q2", "a2", "q3", "a3"]);
    const before = await asUser(db, userId, (tx) => tx.query<Row>(LIST_MESSAGES, [caseId, latest.rows[0].cursor_seq, 4]));
    expect(before.rows.map((row) => row.content)).toEqual(["q1", "a1"]);
    const all = await asUser(db, userId, (tx) => tx.query<Row>(LIST_MESSAGES, [caseId, null, 50]));
    expect(all.rows.map((row) => row.role)).toEqual(["user", "assistant", "user", "assistant", "user", "assistant"]);
  });

  // REFERENCE (AnalysisService.status): the latest reading of a case.
  const LATEST_JOB = `
    select id, state, failure_reason, retryable from app.analysis_jobs
    where case_id = $1 and user_id = app.user_id()
    order by started_at desc, id desc
    limit 1`;

  // REFERENCE (AnalysisService.get): the explanation shown for a case: the
  // newest one that needs no review or has passed it.
  const SHOWN_ANALYSIS = `
    select id, language, content from app.analyses
    where case_id = $1 and user_id = app.user_id()
      and review_state in ('not_required', 'approved')
    order by created_at desc, id desc
    limit 1`;

  it("analysis: the earlier explanation stays until a new reading succeeds, and an unreviewed one is not shown", async () => {
    const { userId, caseId } = await personWithCase();
    const latestJob = async () => (await asUser(db, userId, (tx) => tx.query<Row>(LATEST_JOB, [caseId]))).rows[0];
    const shown = async () => (await asUser(db, userId, (tx) => tx.query<Row>(SHOWN_ANALYSIS, [caseId]))).rows[0];

    // Never asked for.
    expect(await latestJob()).toBeUndefined();
    expect(await shown()).toBeUndefined();

    // First reading: queued, nothing to show yet.
    const first = await asService(db, (tx) => makeJob(tx, userId, caseId, { started_at: "2026-08-01T10:00:00Z" }));
    expect(await latestJob()).toMatchObject({ id: first.id, state: "queued" });
    expect(await shown()).toBeUndefined();

    // It succeeds.
    const firstAnalysis = await asService(db, async (tx) => {
      await tx.query("update app.analysis_jobs set state = 'ready' where id = $1", [first.id]);
      return makeAnalysis(tx, userId, caseId, first.id as string, { created_at: "2026-08-01T10:01:00Z" });
    });
    expect(await shown()).toMatchObject({ id: firstAnalysis.id });

    // Read again; the second reading fails. The first explanation is still there.
    const second = await asService(db, (tx) =>
      makeJob(tx, userId, caseId, { started_at: "2026-08-02T10:00:00Z", language: "hi" }),
    );
    expect(await latestJob()).toMatchObject({ id: second.id, state: "queued" });
    expect(await shown()).toMatchObject({ id: firstAnalysis.id });
    await asService(db, (tx) =>
      tx.query("update app.analysis_jobs set state = 'failed', failure_reason = 'unreadable', retryable = false where id = $1", [second.id]),
    );
    expect(await latestJob()).toMatchObject({ id: second.id, state: "failed", failure_reason: "unreadable", retryable: false });
    expect(await shown()).toMatchObject({ id: firstAnalysis.id, language: "mr" });

    // A third reading succeeds, in Hindi: now that one is shown, and the first is still kept.
    const third = await asService(db, (tx) =>
      makeJob(tx, userId, caseId, { state: "ready", started_at: "2026-08-03T10:00:00Z", language: "hi" }),
    );
    const thirdAnalysis = await asService(db, (tx) =>
      makeAnalysis(tx, userId, caseId, third.id as string, { language: "hi", created_at: "2026-08-03T10:01:00Z" }),
    );
    expect(await shown()).toMatchObject({ id: thirdAnalysis.id, language: "hi" });
    expect(await countAll(db, "analyses", "case_id = $1", [caseId])).toBe(2);

    // A fourth is waiting for an advocate's review: the third stays on screen until it is approved.
    const fourth = await asService(db, (tx) =>
      makeJob(tx, userId, caseId, { state: "ready", started_at: "2026-08-04T10:00:00Z" }),
    );
    const fourthAnalysis = await asService(db, (tx) =>
      makeAnalysis(tx, userId, caseId, fourth.id as string, { review_state: "pending", created_at: "2026-08-04T10:01:00Z" }),
    );
    expect(await shown()).toMatchObject({ id: thirdAnalysis.id });
    await asService(db, (tx) => tx.query("update app.analyses set review_state = 'approved' where id = $1", [fourthAnalysis.id]));
    expect(await shown()).toMatchObject({ id: fourthAnalysis.id });
  });

  // REFERENCE (CaseService.upcomingDeadlines): dates that have not passed,
  // from the explanation shown for each finished case, nearest first.
  //   $1 today as YYYY-MM-DD (India time, worked out by the server)   $2 how many
  // Dates are compared as text on purpose: only YYYY-MM-DD gets through the
  // pattern, that form sorts like a date, and nothing a model wrote is ever cast.
  const UPCOMING_DEADLINES = `
    select c.id as case_id, c.title as case_title, d.item ->> 'label' as label, d.item ->> 'date' as date
    from app.cases c
    cross join lateral (
      select a.content from app.analyses a
      where a.case_id = c.id and a.review_state in ('not_required', 'approved')
      order by a.created_at desc, a.id desc
      limit 1
    ) shown
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(shown.content -> 'deadlines') = 'array' then shown.content -> 'deadlines' else '[]'::jsonb end
    ) as d (item)
    where c.user_id = app.user_id()
      and c.status in ('ready', 'needs_more_info')
      and d.item ->> 'date' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      and d.item ->> 'date' >= $1
    order by d.item ->> 'date', c.created_at desc, c.id, d.item ->> 'label'
    limit $2`;

  it("upcoming deadlines: dates that have not passed, across a person's finished cases, nearest first", async () => {
    const userId = await person();
    const other = await person();

    /** A case of `owner` with one finished reading whose explanation has these deadlines. */
    async function explained(
      owner: string,
      title: string,
      status: string,
      deadlines: { label: string; date?: string }[],
      content?: Row,
    ): Promise<{ caseId: string }> {
      return asService(db, async (tx) => {
        const made = await makeCase(tx, owner, { title, status });
        const caseId = made.id as string;
        const job = await makeJob(tx, owner, caseId, { state: "ready", started_at: "2026-09-01T10:00:00Z" });
        await makeAnalysis(tx, owner, caseId, job.id as string, {
          content: content ?? analysisContent(deadlines),
          created_at: "2026-09-01T10:01:00Z",
        });
        return { caseId };
      });
    }

    await explained(userId, "Rent", "ready", [
      { label: "Reply to the notice", date: "2026-10-20" },
      { label: "Already gone", date: "2026-10-01" },
      { label: "No date given" },
      { label: "Today counts", date: "2026-10-10" },
    ]);
    await explained(userId, "Job", "needs_more_info", [{ label: "Hearing", date: "2026-10-15" }]);
    await explained(userId, "Still a draft", "draft", [{ label: "Not finished", date: "2026-10-11" }]);
    await explained(userId, "Odd dates", "ready", [
      { label: "Not a date", date: "next Friday" },
      { label: "Wrong shape", date: "20/10/2026" },
      { label: "Far off", date: "2027-01-05" },
    ]);
    await explained(userId, "No deadline list", "ready", [], { overview: {}, deadlines: "none" });
    await explained(other, "Someone else's", "ready", [{ label: "Theirs", date: "2026-10-12" }]);

    // A case read twice: only the dates of the explanation now shown count.
    const twice = await explained(userId, "Read twice", "ready", [{ label: "From the old reading", date: "2026-10-13" }]);
    await asService(db, async (tx) => {
      const job = await makeJob(tx, userId, twice.caseId, { state: "ready", started_at: "2026-09-02T10:00:00Z" });
      await makeAnalysis(tx, userId, twice.caseId, job.id as string, {
        content: analysisContent([{ label: "From the new reading", date: "2026-10-18" }]),
        created_at: "2026-09-02T10:01:00Z",
      });
    });

    const run = (limit: number) =>
      asUser(db, userId, (tx) => tx.query<Row>(UPCOMING_DEADLINES, ["2026-10-10", limit]));

    const all = await run(20);
    expect(all.rows.map((row) => [row.date, row.case_title, row.label])).toEqual([
      ["2026-10-10", "Rent", "Today counts"],
      ["2026-10-15", "Job", "Hearing"],
      ["2026-10-18", "Read twice", "From the new reading"],
      ["2026-10-20", "Rent", "Reply to the notice"],
      ["2027-01-05", "Odd dates", "Far off"],
    ]);
    // Three unless more are asked for.
    expect((await run(3)).rows.map((row) => row.label)).toEqual(["Today counts", "Hearing", "From the new reading"]);
  });

  // REFERENCE (per-person daily limits): adds one to today's count and says
  // what it is now. Run as the service, in the same transaction as the work it counts.
  const COUNT_USE = `
    insert into app.usage_counters (user_id, day, kind, count) values ($1, $2, $3, 1)
    on conflict (user_id, day, kind) do update set count = app.usage_counters.count + 1
    returning count`;

  it("usage counters: counting a use adds one for that person, that day and that kind only", async () => {
    const userId = await person();
    const other = await person();
    const use = async (who: string, day: string, kind: string) =>
      (await asService(db, (tx) => tx.query<{ count: number }>(COUNT_USE, [who, day, kind]))).rows[0].count;

    expect(await use(userId, "2026-10-10", "analysis")).toBe(1);
    expect(await use(userId, "2026-10-10", "analysis")).toBe(2);
    expect(await use(userId, "2026-10-10", "question")).toBe(1);
    expect(await use(userId, "2026-10-11", "analysis")).toBe(1);
    expect(await use(other, "2026-10-10", "analysis")).toBe(1);
    expect(await use(userId, "2026-10-10", "analysis")).toBe(3);
  });

  // REFERENCE (the worker): takes the job that has waited longest. "skip
  // locked" lets several workers run without taking the same job twice.
  const TAKE_NEXT_JOB = `
    update app.analysis_jobs set state = 'reading'
    where id = (
      select id from app.analysis_jobs
      where state = 'queued'
      order by started_at, id
      limit 1
      for update skip locked
    )
    returning id, case_id, user_id, language`;

  it("the worker's queue: jobs are taken oldest first, each one once", async () => {
    // Clear whatever earlier tests left waiting, so this test sees its own jobs only.
    await asService(db, (tx) =>
      tx.query("update app.analysis_jobs set state = 'failed', failure_reason = 'internal', retryable = true where state = 'queued'"),
    );
    const one = await personWithCase();
    const two = await personWithCase();
    const older = await asService(db, (tx) => makeJob(tx, one.userId, one.caseId, { started_at: "2026-09-10T10:00:00Z" }));
    const newer = await asService(db, (tx) => makeJob(tx, two.userId, two.caseId, { started_at: "2026-09-10T10:00:05Z" }));

    const take = async () => (await asService(db, (tx) => tx.query<Row>(TAKE_NEXT_JOB))).rows[0];
    expect(await take()).toMatchObject({ id: older.id, case_id: one.caseId, user_id: one.userId });
    expect(await take()).toMatchObject({ id: newer.id, case_id: two.caseId, user_id: two.userId });
    expect(await take()).toBeUndefined();
  });
});
