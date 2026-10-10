import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite, type Transaction } from "@electric-sql/pglite";

/*
 * A real Postgres, in memory, with the Juris schema applied: db/local/roles.sql
 * and then every migration in name order. Nothing here needs an account or a
 * network.
 *
 * asUser, asAnon and asService do what the server will do for each request:
 * open a transaction, set the claims, switch role. Everything inside runs with
 * that role's grants and row-level security, and the role is gone when the
 * transaction ends.
 */

export type Db = PGlite;
export type Tx = Transaction;
export type Row = Record<string, unknown>;

const ROLES_FILE = fileURLToPath(new URL("../../db/local/roles.sql", import.meta.url));
const MIGRATIONS_DIR = fileURLToPath(new URL("../../db/migrations/", import.meta.url));

export function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith(".sql"))
    .sort();
}

export async function openDatabase(): Promise<Db> {
  const db = new PGlite();
  await db.waitReady;
  await db.exec(readFileSync(ROLES_FILE, "utf8"));
  for (const name of migrationFiles()) {
    const sql = readFileSync(MIGRATIONS_DIR + name, "utf8");
    // One transaction per migration, as it is applied for real.
    await db.transaction(async (tx) => {
      await tx.exec(sql);
    });
  }
  return db;
}

/** Runs `fn` as a signed-in person: role "authenticated", with their id as the claim. */
export function asUser<T>(db: Db, userId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ sub: userId, role: "authenticated" }),
    ]);
    await tx.exec("set local role authenticated");
    return fn(tx);
  });
}

/** Runs `fn` as a request with nobody signed in: role "anon", no claims. */
export function asAnon<T>(db: Db, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claims', '', true)");
    await tx.exec("set local role anon");
    return fn(tx);
  });
}

/** Runs `fn` as the server's background work: role "service_role", which bypasses row-level security. */
export function asService<T>(db: Db, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claims', '', true)");
    await tx.exec("set local role service_role");
    return fn(tx);
  });
}

/** Runs `fn` as role "authenticated" with the claims given as they are (for missing or broken claims). */
export function asAuthenticatedWithClaims<T>(db: Db, claims: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claims', $1, true)", [claims]);
    await tx.exec("set local role authenticated");
    return fn(tx);
  });
}

// What the database said no with.
export const PERMISSION_DENIED = "42501"; // no grant, or a row-level security check failed
export const FOREIGN_KEY_VIOLATION = "23503";
export const UNIQUE_VIOLATION = "23505";
export const CHECK_VIOLATION = "23514";
export const NOT_NULL_VIOLATION = "23502";

export interface Refusal {
  code: string;
  message: string;
}

/**
 * The refusal a piece of work ends in. Fails the test if the work goes
 * through, so "it was refused" can never be true by accident.
 */
export async function refusal(work: Promise<unknown>): Promise<Refusal> {
  try {
    await work;
  } catch (error) {
    const { code, message } = error as { code?: unknown; message?: unknown };
    return { code: typeof code === "string" ? code : "", message: String(message) };
  }
  throw new Error("Expected the database to refuse this, and it did not.");
}

/** True when the refusal was a row-level security check (not a missing grant). */
export function isPolicyRefusal(r: Refusal): boolean {
  return r.code === PERMISSION_DENIED && /row-level security/.test(r.message);
}

/** True when the refusal was a missing grant (not a policy). */
export function isGrantRefusal(r: Refusal): boolean {
  return r.code === PERMISSION_DENIED && /permission denied/.test(r.message);
}

// ---------------------------------------------------------------------------
// Factories. Each takes the transaction, so the row is made as whoever the
// transaction belongs to. With no `extra` they write only columns a signed-in
// person is granted; pass worker-owned columns in `extra` when running as the
// service.
// ---------------------------------------------------------------------------

export function newId(): string {
  return randomUUID();
}

let phoneCounter = 0;

/** A different valid Indian mobile number each time. */
export function newPhone(): string {
  phoneCounter += 1;
  return `+9198${String(phoneCounter).padStart(8, "0")}`;
}

/** insert into app.<table> (...) values (...) returning *, with only the columns given. */
export async function insertRow(tx: Tx, table: string, values: Row): Promise<Row> {
  const columns = Object.keys(values).filter((column) => values[column] !== undefined);
  const params = columns.map((column) => {
    const value = values[column];
    const isJson = typeof value === "object" && value !== null && !(value instanceof Date);
    return isJson ? JSON.stringify(value) : value;
  });
  const placeholders = columns.map((_, index) => `$${index + 1}`);
  const result = await tx.query<Row>(
    `insert into app.${table} (${columns.join(", ")}) values (${placeholders.join(", ")}) returning *`,
    params,
  );
  return result.rows[0];
}

export function makeProfile(tx: Tx, userId: string, extra: Row = {}): Promise<Row> {
  return insertRow(tx, "profiles", { id: userId, phone: newPhone(), ...extra });
}

export function makeConsent(tx: Tx, userId: string, extra: Row = {}): Promise<Row> {
  return insertRow(tx, "consents", {
    user_id: userId,
    purpose: "account",
    policy_version: "2026-01",
    is_adult: true,
    ...extra,
  });
}

export function makeCase(tx: Tx, userId: string, extra: Row = {}): Promise<Row> {
  return insertRow(tx, "cases", {
    user_id: userId,
    title: "Notice from my landlord",
    category: "tenancy",
    source: "description",
    ...extra,
  });
}

export function makeStory(tx: Tx, userId: string, caseId: string, extra: Row = {}): Promise<Row> {
  return insertRow(tx, "case_stories", {
    case_id: caseId,
    user_id: userId,
    narrative: "My landlord says I must leave the room by the end of the month.",
    ...extra,
  });
}

/** A case together with what the person wrote about it. */
export async function makeCaseWithStory(
  tx: Tx,
  userId: string,
  extra: Row = {},
): Promise<{ case: Row; story: Row }> {
  const made = await makeCase(tx, userId, extra);
  const story = await makeStory(tx, userId, made.id as string);
  return { case: made, story };
}

export function makeDocument(tx: Tx, userId: string, caseId: string, extra: Row = {}): Promise<Row> {
  return insertRow(tx, "documents", {
    case_id: caseId,
    user_id: userId,
    file_name: "notice.pdf",
    mime_type: "application/pdf",
    byte_size: 48_213,
    kind: "pdf",
    ...extra,
  });
}

export function makeJob(tx: Tx, userId: string, caseId: string, extra: Row = {}): Promise<Row> {
  return insertRow(tx, "analysis_jobs", { case_id: caseId, user_id: userId, language: "mr", ...extra });
}

/** The smallest content with a deadline list, shaped like domain/analysis.ts. */
export function analysisContent(deadlines: { label: string; date?: string }[] = []): Row {
  return {
    overview: { oneLine: "A notice to leave a rented room.", documentOrProblemType: "Eviction notice" },
    plainLanguageSummary: "Your landlord has asked you to leave.",
    keyFacts: [],
    deadlines: deadlines.map((deadline, index) => ({ id: `d${index + 1}`, urgency: "upcoming", ...deadline })),
  };
}

/** An explanation. Only the service may write one. */
export function makeAnalysis(tx: Tx, userId: string, caseId: string, jobId: string, extra: Row = {}): Promise<Row> {
  return insertRow(tx, "analyses", {
    case_id: caseId,
    user_id: userId,
    job_id: jobId,
    language: "mr",
    content: analysisContent(),
    model: "test-model",
    prompt_version: "test-1",
    ...extra,
  });
}

export function makeMessage(tx: Tx, userId: string, caseId: string, extra: Row = {}): Promise<Row> {
  return insertRow(tx, "chat_messages", {
    case_id: caseId,
    user_id: userId,
    content: "Do I have to leave by the end of the month?",
    ...extra,
  });
}

/** Everything one person can have, one of each, with the ids to reach it. */
export interface World {
  userId: string;
  phone: string;
  consentId: string;
  caseId: string;
  documentId: string;
  jobId: string;
  analysisId: string;
  questionId: string;
  replyId: string;
  auditId: string;
  usageDay: string;
}

/**
 * A person with a consent, a case with a story, a paper, a finished reading,
 * its explanation, a question and its reply, an audit row and a usage count.
 *
 * Whatever a person may do themselves is done AS that person, so the world
 * existing at all shows the tables are usable by their owner. The rest is
 * done as the service, as the worker would.
 */
export async function makeWorld(db: Db): Promise<World> {
  const userId = newId();

  // The server makes the profile, once the sign-in code has been checked. A person cannot.
  const profile = await asService(db, (tx) => makeProfile(tx, userId, { display_name: "Asha", preferred_language: "mr" }));

  const own = await asUser(db, userId, async (tx) => {
    const consent = await makeConsent(tx, userId);
    const made = await makeCaseWithStory(tx, userId);
    const caseId = made.case.id as string;
    const document = await makeDocument(tx, userId, caseId);
    const job = await makeJob(tx, userId, caseId);
    const question = await makeMessage(tx, userId, caseId);
    return {
      phone: profile.phone as string,
      consentId: consent.id as string,
      caseId,
      documentId: document.id as string,
      jobId: job.id as string,
      questionId: question.id as string,
    };
  });

  const worker = await asService(db, async (tx) => {
    await tx.query("update app.documents set status = 'ready' where id = $1", [own.documentId]);
    await tx.query("update app.analysis_jobs set state = 'ready' where id = $1", [own.jobId]);
    const analysis = await makeAnalysis(tx, userId, own.caseId, own.jobId);
    await tx.query("update app.cases set status = 'ready' where id = $1", [own.caseId]);
    const reply = await makeMessage(tx, userId, own.caseId, {
      role: "assistant",
      content: "The notice gives you until the end of the month. Free legal aid can help you reply.",
      language: "mr",
      in_reply_to: own.questionId,
    });
    const audit = await insertRow(tx, "audit_log", {
      user_id: userId,
      action: "case.read",
      subject_type: "case",
      subject_id: own.caseId,
    });
    await insertRow(tx, "usage_counters", { user_id: userId, day: "2026-10-10", kind: "analysis", count: 1 });
    return { analysisId: analysis.id as string, replyId: reply.id as string, auditId: audit.id as string };
  });

  return { userId, ...own, ...worker, usageDay: "2026-10-10" };
}

/** Counts rows as the service, which sees everything: the truth to check a refusal against. */
export async function countAll(db: Db, table: string, where = "true", params: unknown[] = []): Promise<number> {
  return asService(db, async (tx) => {
    const result = await tx.query<{ n: number }>(`select count(*)::int as n from app.${table} where ${where}`, params);
    return result.rows[0].n;
  });
}

/** One row as the service sees it, or undefined. */
export async function readAsService(
  db: Db,
  table: string,
  where: string,
  params: unknown[] = [],
): Promise<Row | undefined> {
  return asService(db, async (tx) => {
    const result = await tx.query<Row>(`select * from app.${table} where ${where}`, params);
    return result.rows[0];
  });
}
