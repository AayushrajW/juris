import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  FOREIGN_KEY_VIOLATION,
  PERMISSION_DENIED,
  UNIQUE_VIOLATION,
  asAnon,
  asAuthenticatedWithClaims,
  asService,
  asUser,
  countAll,
  insertRow,
  isGrantRefusal,
  isPolicyRefusal,
  makeAnalysis,
  makeCase,
  makeConsent,
  makeDocument,
  makeJob,
  makeMessage,
  makeProfile,
  makeStory,
  makeWorld,
  newId,
  newPhone,
  openDatabase,
  readAsService,
  refusal,
  type Db,
  type Row,
  type Tx,
  type World,
} from "./harness";

/*
 * One person cannot reach another person's data.
 *
 * Every test starts with two people, A and B, who each have one of everything
 * (see makeWorld: whatever a person may do is done AS that person, so the
 * tables are known to work for their owner). Each test then does the allowed
 * thing as the owner before trying the forbidden thing, and checks the outcome
 * as the service, which sees every row.
 *
 * A refusal is one of:
 *   - a missing grant ("permission denied"),
 *   - a row-level security check ("violates row-level security policy"),
 *   - a foreign key (the row would hang off somebody else's case),
 *   - or nothing at all happening: the statement runs and touches no rows,
 *     because the other person's rows are not there for this person.
 */

let db: Db;
let a: World;
let b: World;

beforeAll(async () => {
  db = await openDatabase();
});

afterAll(async () => {
  await db.close();
});

beforeEach(async () => {
  a = await makeWorld(db);
  b = await makeWorld(db);
});

// ---------------------------------------------------------------------------
// The tables, and how to point at one person's row in each.
// ---------------------------------------------------------------------------

interface TableSpec {
  table: string;
  /** The column that says whose row it is. */
  ownerColumn: string;
  /** Finds the row of a world in this table. */
  row: (w: World) => { where: string; params: unknown[] };
  /** May a signed-in person read their own rows here? */
  personReads: boolean;
  /** A column a person may change on their own row, with a new value; null if they may change nothing. */
  personUpdates: { column: string; value: unknown } | null;
  /** May a signed-in person delete their own row here? */
  personDeletes: boolean;
  /** Makes one more row as the person would, for `userId` on `caseId`; null if a person may not insert here. */
  personInserts: ((tx: Tx, userId: string, caseId: string) => Promise<Row>) | null;
  /** True when rows hang off a case. */
  hasCase: boolean;
}

const byId = (pick: (w: World) => string) => (w: World) => ({ where: "id = $1", params: [pick(w)] });

const TABLES: TableSpec[] = [
  {
    table: "profiles",
    ownerColumn: "id",
    row: byId((w) => w.userId),
    personReads: true,
    personUpdates: { column: "display_name", value: "Changed" },
    personDeletes: true,
    personInserts: (tx, userId) => makeProfile(tx, userId),
    hasCase: false,
  },
  {
    table: "consents",
    ownerColumn: "user_id",
    row: byId((w) => w.consentId),
    personReads: true,
    personUpdates: { column: "withdrawn_at", value: "2026-10-10T00:00:00Z" },
    personDeletes: false,
    personInserts: (tx, userId) => makeConsent(tx, userId, { purpose: "document_processing" }),
    hasCase: false,
  },
  {
    table: "cases",
    ownerColumn: "user_id",
    row: byId((w) => w.caseId),
    personReads: true,
    personUpdates: { column: "title", value: "Changed" },
    personDeletes: true,
    personInserts: (tx, userId) => makeCase(tx, userId),
    hasCase: false,
  },
  {
    table: "case_stories",
    ownerColumn: "user_id",
    row: (w) => ({ where: "case_id = $1", params: [w.caseId] }),
    personReads: true,
    personUpdates: { column: "narrative", value: "Changed" },
    personDeletes: true,
    personInserts: (tx, userId, caseId) => makeStory(tx, userId, caseId),
    hasCase: true,
  },
  {
    table: "documents",
    ownerColumn: "user_id",
    row: byId((w) => w.documentId),
    personReads: true,
    personUpdates: null,
    personDeletes: true,
    personInserts: (tx, userId, caseId) => makeDocument(tx, userId, caseId),
    hasCase: true,
  },
  {
    table: "analysis_jobs",
    ownerColumn: "user_id",
    row: byId((w) => w.jobId),
    personReads: true,
    personUpdates: null,
    personDeletes: false,
    personInserts: (tx, userId, caseId) => makeJob(tx, userId, caseId),
    hasCase: true,
  },
  {
    table: "analyses",
    ownerColumn: "user_id",
    row: byId((w) => w.analysisId),
    personReads: true,
    personUpdates: null,
    personDeletes: false,
    personInserts: null,
    hasCase: true,
  },
  {
    table: "chat_messages",
    ownerColumn: "user_id",
    row: byId((w) => w.questionId),
    personReads: true,
    personUpdates: null,
    personDeletes: false,
    personInserts: (tx, userId, caseId) => makeMessage(tx, userId, caseId),
    hasCase: true,
  },
  {
    table: "audit_log",
    ownerColumn: "user_id",
    row: byId((w) => w.auditId),
    personReads: false,
    personUpdates: null,
    personDeletes: false,
    personInserts: null,
    hasCase: false,
  },
  {
    table: "usage_counters",
    ownerColumn: "user_id",
    row: (w) => ({ where: "user_id = $1", params: [w.userId] }),
    personReads: false,
    personUpdates: null,
    personDeletes: false,
    personInserts: null,
    hasCase: false,
  },
];

/** A column that exists in every table's row, to try an update a person has no grant for. */
const ANY_COLUMN: Record<string, { column: string; value: unknown }> = {
  profiles: { column: "phone", value: "+919000000001" },
  consents: { column: "purpose", value: "changed" },
  cases: { column: "status", value: "ready" },
  case_stories: { column: "case_id", value: newId() },
  documents: { column: "file_name", value: "changed.pdf" },
  analysis_jobs: { column: "state", value: "ready" },
  analyses: { column: "model", value: "changed" },
  chat_messages: { column: "content", value: "changed" },
  audit_log: { column: "action", value: "changed" },
  usage_counters: { column: "count", value: 0 },
};

/** A second case of person `w` that has no story yet, made as that person. */
function secondCase(w: World): Promise<string> {
  return asUser(db, w.userId, async (tx) => (await makeCase(tx, w.userId, { title: "Second problem" })).id as string);
}

describe("the test world", () => {
  it("holds one of everything for each person, so no test below passes on an empty table", async () => {
    for (const spec of TABLES) {
      for (const world of [a, b]) {
        const { where, params } = spec.row(world);
        expect(await countAll(db, spec.table, where, params), `${spec.table} of a person`).toBeGreaterThan(0);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Person B against person A, table by table and operation by operation.
// ---------------------------------------------------------------------------

describe.each(TABLES)("$table", (spec) => {
  const { table } = spec;

  if (spec.personReads) {
    it(`${table}: select — the owner sees their row, another person sees none of it`, async () => {
      const mine = spec.row(a);
      const ownerSees = await asUser(db, a.userId, (tx) =>
        tx.query<Row>(`select * from app.${table} where ${mine.where}`, mine.params),
      );
      expect(ownerSees.rows.length).toBeGreaterThan(0);

      // Asked for directly, A's row is not there for B.
      const otherSees = await asUser(db, b.userId, (tx) =>
        tx.query<Row>(`select * from app.${table} where ${mine.where}`, mine.params),
      );
      expect(otherSees.rows).toEqual([]);

      // Asked for with no filter at all, B gets B's rows and nobody else's.
      const everything = await asUser(db, b.userId, (tx) => tx.query<Row>(`select * from app.${table}`));
      expect(everything.rows.length).toBeGreaterThan(0);
      for (const row of everything.rows) expect(row[spec.ownerColumn]).toBe(b.userId);

      // Counting gives nothing away either.
      const counted = await asUser(db, b.userId, (tx) =>
        tx.query<{ n: number }>(`select count(*)::int as n from app.${table} where ${mine.where}`, mine.params),
      );
      expect(counted.rows[0].n).toBe(0);
    });
  } else {
    it(`${table}: select — no signed-in person may read it, not even rows about themselves`, async () => {
      expect(await countAll(db, table, `${spec.ownerColumn} = $1`, [a.userId])).toBeGreaterThan(0);
      for (const who of [a, b]) {
        const r = await refusal(asUser(db, who.userId, (tx) => tx.query(`select * from app.${table}`)));
        expect(isGrantRefusal(r), r.message).toBe(true);
      }
    });
  }

  if (spec.personInserts) {
    const insert = spec.personInserts;

    it(`${table}: insert — the owner adds a row, another person cannot add one carrying the owner's id`, async () => {
      const caseOfA = spec.table === "case_stories" ? await secondCase(a) : a.caseId;
      const before = await countAll(db, table);

      if (table === "profiles") {
        // The owner's own profile was made by them in makeWorld. Here: a new person makes theirs.
        const fresh = newId();
        await asUser(db, fresh, (tx) => insert(tx, fresh, ""));
        expect(await countAll(db, table)).toBe(before + 1);
        // B cannot make a profile under any id but B's own: not A's, not a new one.
        for (const someoneElse of [a.userId, newId()]) {
          const r = await refusal(asUser(db, b.userId, (tx) => insert(tx, someoneElse, "")));
          expect(isPolicyRefusal(r), r.message).toBe(true);
        }
        expect(await countAll(db, table)).toBe(before + 1);
        return;
      }

      const ofOwnerBefore = await countAll(db, table, `${spec.ownerColumn} = $1`, [a.userId]);

      // B, saying the row is A's, on A's case.
      const forged = await refusal(asUser(db, b.userId, (tx) => insert(tx, a.userId, caseOfA)));
      expect(isPolicyRefusal(forged), forged.message).toBe(true);
      // B, saying the row is A's, on B's own case.
      if (spec.hasCase) {
        const caseOfB = spec.table === "case_stories" ? await secondCase(b) : b.caseId;
        const mixed = await refusal(asUser(db, b.userId, (tx) => insert(tx, a.userId, caseOfB)));
        expect(isPolicyRefusal(mixed), mixed.message).toBe(true);
      }
      expect(await countAll(db, table, `${spec.ownerColumn} = $1`, [a.userId])).toBe(ofOwnerBefore);
      const afterForgery = await countAll(db, table);

      // The owner does exactly the same thing and it works.
      await asUser(db, a.userId, (tx) => insert(tx, a.userId, caseOfA));
      expect(await countAll(db, table)).toBe(afterForgery + 1);
    });

    if (spec.hasCase) {
      it(`${table}: insert — another person cannot attach a row to the owner's case, even with their own id on it`, async () => {
        const caseOfA = spec.table === "case_stories" ? await secondCase(a) : a.caseId;
        const before = await countAll(db, table, "case_id = $1", [caseOfA]);

        const r = await refusal(asUser(db, b.userId, (tx) => insert(tx, b.userId, caseOfA)));
        expect(r.code, r.message).toBe(FOREIGN_KEY_VIOLATION);
        expect(await countAll(db, table, "case_id = $1", [caseOfA])).toBe(before);

        // The owner attaches the same kind of row to that case.
        await asUser(db, a.userId, (tx) => insert(tx, a.userId, caseOfA));
        expect(await countAll(db, table, "case_id = $1", [caseOfA])).toBe(before + 1);
      });
    }
  } else {
    it(`${table}: insert — no signed-in person may add a row, for themselves or for anyone`, async () => {
      const before = await countAll(db, table);
      const values: Record<string, Row> = {
        analyses: {
          case_id: b.caseId,
          job_id: b.jobId,
          language: "mr",
          content: {},
          model: "m",
          prompt_version: "p",
        },
        audit_log: { action: "case.read", subject_type: "case" },
        usage_counters: { day: "2026-10-11", kind: "analysis", count: 0 },
      };
      for (const owner of [b.userId, a.userId]) {
        const r = await refusal(
          asUser(db, b.userId, (tx) => insertRow(tx, table, { ...values[table], user_id: owner })),
        );
        expect(isGrantRefusal(r), r.message).toBe(true);
      }
      expect(await countAll(db, table)).toBe(before);
    });
  }

  if (spec.personUpdates) {
    const change = spec.personUpdates;

    it(`${table}: update — the owner changes their row, another person changes nothing of it`, async () => {
      const target = spec.row(a);
      const sql = `update app.${table} set ${change.column} = $${target.params.length + 1} where ${target.where}`;
      const before = await readAsService(db, table, target.where, target.params);

      const byOther = await asUser(db, b.userId, (tx) => tx.query(sql, [...target.params, change.value]));
      expect(byOther.affectedRows).toBe(0);
      expect(await readAsService(db, table, target.where, target.params)).toEqual(before);

      // With no filter, B's update reaches B's rows only.
      await asUser(db, b.userId, (tx) => tx.query(`update app.${table} set ${change.column} = $1`, [change.value]));
      expect(await readAsService(db, table, target.where, target.params)).toEqual(before);

      const byOwner = await asUser(db, a.userId, (tx) => tx.query(sql, [...target.params, change.value]));
      expect(byOwner.affectedRows).toBe(1);
      const after = await readAsService(db, table, target.where, target.params);
      expect(after?.[change.column]).not.toEqual(before?.[change.column]);
    });
  } else {
    it(`${table}: update — no signed-in person may change a row, their own or another's`, async () => {
      const change = ANY_COLUMN[table];
      for (const [who, whose] of [
        [b, a],
        [a, a],
      ] as const) {
        const target = spec.row(whose);
        const before = await readAsService(db, table, target.where, target.params);
        const r = await refusal(
          asUser(db, who.userId, (tx) =>
            tx.query(`update app.${table} set ${change.column} = $${target.params.length + 1} where ${target.where}`, [
              ...target.params,
              change.value,
            ]),
          ),
        );
        expect(isGrantRefusal(r), r.message).toBe(true);
        expect(await readAsService(db, table, target.where, target.params)).toEqual(before);
      }
    });
  }

  it(`${table}: update — nobody can write a column they were not granted, on another person's row`, async () => {
    const change = ANY_COLUMN[table];
    const target = spec.row(a);
    const before = await readAsService(db, table, target.where, target.params);
    const r = await refusal(
      asUser(db, b.userId, (tx) =>
        tx.query(`update app.${table} set ${change.column} = $${target.params.length + 1} where ${target.where}`, [
          ...target.params,
          change.value,
        ]),
      ),
    );
    expect(isGrantRefusal(r), r.message).toBe(true);
    expect(await readAsService(db, table, target.where, target.params)).toEqual(before);
  });

  if (spec.personDeletes) {
    it(`${table}: delete — another person removes nothing of the owner's, the owner removes their row`, async () => {
      const target = spec.row(a);

      const byOther = await asUser(db, b.userId, (tx) =>
        tx.query(`delete from app.${table} where ${target.where}`, target.params),
      );
      expect(byOther.affectedRows).toBe(0);
      expect(await countAll(db, table, target.where, target.params)).toBe(1);

      // With no filter, B's delete removes B's rows only.
      await asUser(db, b.userId, (tx) => tx.query(`delete from app.${table}`));
      expect(await countAll(db, table, target.where, target.params)).toBe(1);

      const byOwner = await asUser(db, a.userId, (tx) =>
        tx.query(`delete from app.${table} where ${target.where}`, target.params),
      );
      expect(byOwner.affectedRows).toBe(1);
      expect(await countAll(db, table, target.where, target.params)).toBe(0);
    });
  } else {
    it(`${table}: delete — no signed-in person may remove a row, their own or another's`, async () => {
      const target = spec.row(a);
      const before = await countAll(db, table, target.where, target.params);
      expect(before).toBeGreaterThan(0);
      for (const who of [b, a]) {
        const r = await refusal(
          asUser(db, who.userId, (tx) => tx.query(`delete from app.${table} where ${target.where}`, target.params)),
        );
        expect(isGrantRefusal(r), r.message).toBe(true);
      }
      expect(await countAll(db, table, target.where, target.params)).toBe(before);
    });
  }

  it(`${table}: anon — cannot select, insert, update or delete`, async () => {
    const target = spec.row(a);
    const before = await readAsService(db, table, target.where, target.params);
    const total = await countAll(db, table);
    const change = ANY_COLUMN[table];
    const attempts: ((tx: Tx) => Promise<unknown>)[] = [
      (tx) => tx.query(`select * from app.${table}`),
      (tx) => tx.query(`select count(*) from app.${table}`),
      (tx) => tx.query(`insert into app.${table} default values`),
      (tx) => tx.query(`update app.${table} set ${change.column} = $1`, [change.value]),
      (tx) => tx.query(`delete from app.${table}`),
      (tx) => tx.query(`truncate app.${table} cascade`),
    ];
    for (const attempt of attempts) {
      const r = await refusal(asAnon(db, attempt));
      expect(r.code, r.message).toBe(PERMISSION_DENIED);
    }
    expect(await countAll(db, table)).toBe(total);
    expect(await readAsService(db, table, target.where, target.params)).toEqual(before);
  });

  it(`${table}: no claims — the authenticated role with nobody behind it sees and writes nothing`, async () => {
    for (const claims of ["", "{}", '{"sub":""}', '{"role":"authenticated"}']) {
      if (spec.personReads) {
        const seen = await asAuthenticatedWithClaims(db, claims, (tx) => tx.query(`select * from app.${table}`));
        expect(seen.rows, `claims ${claims || "(none)"}`).toEqual([]);
      } else {
        const r = await refusal(asAuthenticatedWithClaims(db, claims, (tx) => tx.query(`select * from app.${table}`)));
        expect(isGrantRefusal(r), r.message).toBe(true);
      }
      if (spec.personInserts) {
        const insert = spec.personInserts;
        const r = await refusal(asAuthenticatedWithClaims(db, claims, (tx) => insert(tx, a.userId, a.caseId)));
        expect(isPolicyRefusal(r), r.message).toBe(true);
      }
    }
  });

  if (spec.ownerColumn === "user_id") {
    it(`${table}: update — the owner cannot give their own row to someone else (user_id is not writable)`, async () => {
      const target = spec.row(a);
      const r = await refusal(
        asUser(db, a.userId, (tx) =>
          tx.query(`update app.${table} set user_id = $${target.params.length + 1} where ${target.where}`, [
            ...target.params,
            b.userId,
          ]),
        ),
      );
      expect(isGrantRefusal(r), r.message).toBe(true);
      expect((await readAsService(db, table, target.where, target.params))?.user_id).toBe(a.userId);
    });
  }

  if (spec.hasCase) {
    it(`${table}: update — nobody can move a row onto another case (case_id is not writable)`, async () => {
      const mine = spec.row(b);
      const r = await refusal(
        asUser(db, b.userId, (tx) =>
          tx.query(`update app.${table} set case_id = $${mine.params.length + 1} where ${mine.where}`, [
            ...mine.params,
            a.caseId,
          ]),
        ),
      );
      expect(isGrantRefusal(r), r.message).toBe(true);
      expect(await countAll(db, table, "case_id = $1 and user_id = $2", [a.caseId, b.userId])).toBe(0);
    });
  }
});

// ---------------------------------------------------------------------------
// Ownership cannot be forged, whoever is writing.
// ---------------------------------------------------------------------------

describe("ownership is held by foreign keys, not only by policies", () => {
  it("case_stories: a story for a case that already has one is refused before anything is attached", async () => {
    // A's first case has a story, so this fails on the primary key; either way nothing of B's lands on A's case.
    const r = await refusal(asUser(db, b.userId, (tx) => makeStory(tx, b.userId, a.caseId)));
    expect([UNIQUE_VIOLATION, FOREIGN_KEY_VIOLATION], r.message).toContain(r.code);
    expect((await readAsService(db, "case_stories", "case_id = $1", [a.caseId]))?.user_id).toBe(a.userId);
  });

  const children: [string, (tx: Tx, userId: string, caseId: string) => Promise<Row>][] = [
    ["case_stories", (tx, userId, caseId) => makeStory(tx, userId, caseId)],
    ["documents", (tx, userId, caseId) => makeDocument(tx, userId, caseId)],
    ["analysis_jobs", (tx, userId, caseId) => makeJob(tx, userId, caseId)],
    ["chat_messages", (tx, userId, caseId) => makeMessage(tx, userId, caseId)],
  ];

  it.each(children)(
    "%s: even the service, which bypasses row-level security, cannot put one person's row on another person's case",
    async (table, insert) => {
      const caseOfA = await secondCase(a);
      const r = await refusal(asService(db, (tx) => insert(tx, b.userId, caseOfA)));
      expect(r.code, r.message).toBe(FOREIGN_KEY_VIOLATION);
      // The matching pair works.
      await asService(db, (tx) => insert(tx, a.userId, caseOfA));
      expect(await countAll(db, table, "case_id = $1 and user_id = $2", [caseOfA, a.userId])).toBe(1);
    },
  );

  it("analyses: the service cannot file an explanation of one person's case under another person", async () => {
    const job = await asUser(db, a.userId, (tx) => makeJob(tx, a.userId, a.caseId));
    const r = await refusal(asService(db, (tx) => makeAnalysis(tx, b.userId, a.caseId, job.id as string)));
    expect(r.code, r.message).toBe(FOREIGN_KEY_VIOLATION);
    // Filed under the person whose case it is, it is accepted.
    await asService(db, (tx) => makeAnalysis(tx, a.userId, a.caseId, job.id as string));
  });

  it("analyses: an explanation cannot point at a reading of a different case", async () => {
    const otherCase = await secondCase(a);
    const job = await asUser(db, a.userId, (tx) => makeJob(tx, a.userId, a.caseId));
    const r = await refusal(asService(db, (tx) => makeAnalysis(tx, a.userId, otherCase, job.id as string)));
    expect(r.code, r.message).toBe(FOREIGN_KEY_VIOLATION);
  });

  it("chat_messages: a reply cannot answer a question from a different case", async () => {
    const otherCase = await secondCase(a);
    // Neither a question of another person's, nor one from another case of the same person.
    const ofOther = await asUser(db, b.userId, (tx) => makeMessage(tx, b.userId, b.caseId));
    const ofOtherCase = await asUser(db, a.userId, (tx) => makeMessage(tx, a.userId, a.caseId));
    for (const question of [ofOther, ofOtherCase]) {
      const r = await refusal(
        asService(db, (tx) =>
          makeMessage(tx, a.userId, otherCase, { role: "assistant", content: "Reply", in_reply_to: question.id }),
        ),
      );
      expect(r.code, r.message).toBe(FOREIGN_KEY_VIOLATION);
    }
    // In the question's own case, the reply is accepted.
    await asService(db, (tx) =>
      makeMessage(tx, a.userId, a.caseId, { role: "assistant", content: "Reply", in_reply_to: ofOtherCase.id }),
    );
  });

  it("cases: even the service cannot hand a case with papers to another person", async () => {
    const r = await refusal(
      asService(db, (tx) => tx.query("update app.cases set user_id = $1 where id = $2", [b.userId, a.caseId])),
    );
    expect(r.code, r.message).toBe(FOREIGN_KEY_VIOLATION);
    expect((await readAsService(db, "cases", "id = $1", [a.caseId]))?.user_id).toBe(a.userId);
  });

  it("documents: where the file is kept follows from the owner, the case and the row, and cannot be supplied", async () => {
    const own = await readAsService(db, "documents", "id = $1", [a.documentId]);
    expect(own?.storage_path).toBe(`${a.userId}/${a.caseId}/${a.documentId}`);

    const victim = await readAsService(db, "documents", "id = $1", [b.documentId]);
    const supply = (tx: Tx) => makeDocument(tx, a.userId, a.caseId, { storage_path: victim?.storage_path });
    await refusal(asService(db, supply));
    await refusal(asUser(db, a.userId, supply));
    await refusal(
      asService(db, (tx) =>
        tx.query("update app.documents set storage_path = $1 where id = $2", [victim?.storage_path, a.documentId]),
      ),
    );
    expect((await readAsService(db, "documents", "id = $1", [a.documentId]))?.storage_path).toBe(own?.storage_path);
    expect(await countAll(db, "documents", "storage_path = $1", [victim?.storage_path])).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// The columns the worker owns.
// ---------------------------------------------------------------------------

describe("a person cannot write what the worker owns, even on their own rows", () => {
  /** The owner tries a statement on their own data and it is refused for want of a grant. */
  async function ownerIsRefused(sql: string, params: unknown[]): Promise<void> {
    const r = await refusal(asUser(db, a.userId, (tx) => tx.query(sql, params)));
    expect(isGrantRefusal(r), `${sql}: ${r.message}`).toBe(true);
  }

  it("cases: the owner renames their case, but cannot set status, request_id, created_at, updated_at, source or id", async () => {
    const renamed = await asUser(db, a.userId, (tx) =>
      tx.query("update app.cases set title = 'Renamed', category = 'consumer', city = 'Pune', state = 'Maharashtra' where id = $1", [
        a.caseId,
      ]),
    );
    expect(renamed.affectedRows).toBe(1);

    await ownerIsRefused("update app.cases set status = 'ready' where id = $1", [a.caseId]);
    await ownerIsRefused("update app.cases set status = 'draft' where id = $1", [a.caseId]);
    await ownerIsRefused("update app.cases set request_id = 'r' where id = $1", [a.caseId]);
    await ownerIsRefused("update app.cases set created_at = now() where id = $1", [a.caseId]);
    await ownerIsRefused("update app.cases set updated_at = now() where id = $1", [a.caseId]);
    await ownerIsRefused("update app.cases set source = 'document' where id = $1", [a.caseId]);
    await ownerIsRefused("update app.cases set id = gen_random_uuid() where id = $1", [a.caseId]);

    const after = await readAsService(db, "cases", "id = $1", [a.caseId]);
    expect(after).toMatchObject({ title: "Renamed", status: "ready", request_id: null, source: "description" });
  });

  it("cases: insert — a person's new case is always a draft; a status cannot be supplied", async () => {
    const made = await asUser(db, a.userId, (tx) => makeCase(tx, a.userId));
    expect(made.status).toBe("draft");
    for (const status of ["ready", "processing", "draft"]) {
      const r = await refusal(asUser(db, a.userId, (tx) => makeCase(tx, a.userId, { status })));
      expect(isGrantRefusal(r), r.message).toBe(true);
    }
    const dated = await refusal(asUser(db, a.userId, (tx) => makeCase(tx, a.userId, { created_at: "2001-01-01" })));
    expect(isGrantRefusal(dated), dated.message).toBe(true);
  });

  it("analysis_jobs: the owner queues a reading, but cannot supply or change its state, and cannot remove it", async () => {
    const queued = await asUser(db, a.userId, (tx) => makeJob(tx, a.userId, a.caseId));
    expect(queued).toMatchObject({ state: "queued", attempt: 1, failure_reason: null });

    for (const extra of [{ state: "ready" }, { state: "queued" }, { attempt: 5 }, { failure_reason: "internal" }]) {
      const r = await refusal(asUser(db, a.userId, (tx) => makeJob(tx, a.userId, a.caseId, extra)));
      expect(isGrantRefusal(r), r.message).toBe(true);
    }
    await ownerIsRefused("update app.analysis_jobs set state = 'ready' where id = $1", [queued.id]);
    await ownerIsRefused("update app.analysis_jobs set language = 'en' where id = $1", [queued.id]);
    await ownerIsRefused("delete from app.analysis_jobs where id = $1", [queued.id]);
    expect((await readAsService(db, "analysis_jobs", "id = $1", [queued.id]))?.state).toBe("queued");
  });

  it("documents: the owner adds a paper, but cannot supply or change its status or anything else on it", async () => {
    const added = await asUser(db, a.userId, (tx) => makeDocument(tx, a.userId, a.caseId));
    expect(added).toMatchObject({ status: "checking", rejected_reason: null });

    for (const extra of [{ status: "ready" }, { status: "checking" }, { rejected_reason: "x" }, { id: newId() }]) {
      const r = await refusal(asUser(db, a.userId, (tx) => makeDocument(tx, a.userId, a.caseId, extra)));
      expect(isGrantRefusal(r), r.message).toBe(true);
    }
    await ownerIsRefused("update app.documents set status = 'ready' where id = $1", [added.id]);
    await ownerIsRefused("update app.documents set byte_size = 1 where id = $1", [added.id]);
    await ownerIsRefused("update app.documents set mime_type = 'image/png' where id = $1", [added.id]);
    expect((await readAsService(db, "documents", "id = $1", [added.id]))?.status).toBe("checking");
  });

  it("analyses: the owner reads their explanation, but cannot add, change or remove one", async () => {
    const read = await asUser(db, a.userId, (tx) =>
      tx.query<Row>("select * from app.analyses where id = $1", [a.analysisId]),
    );
    expect(read.rows).toHaveLength(1);

    const job = await asUser(db, a.userId, (tx) => makeJob(tx, a.userId, a.caseId));
    const added = await refusal(asUser(db, a.userId, (tx) => makeAnalysis(tx, a.userId, a.caseId, job.id as string)));
    expect(isGrantRefusal(added), added.message).toBe(true);

    await ownerIsRefused(`update app.analyses set content = '{"keyFacts":["forged"]}' where id = $1`, [a.analysisId]);
    await ownerIsRefused("update app.analyses set review_state = 'approved' where id = $1", [a.analysisId]);
    await ownerIsRefused("update app.analyses set model = 'x', prompt_version = 'y' where id = $1", [a.analysisId]);
    await ownerIsRefused("delete from app.analyses where id = $1", [a.analysisId]);
    expect(await countAll(db, "analyses", "user_id = $1", [a.userId])).toBe(1);
  });

  it("chat_messages: the owner asks a question, but cannot write a reply, edit a message or remove one", async () => {
    const asked = await asUser(db, a.userId, (tx) => makeMessage(tx, a.userId, a.caseId, { request_id: "q-1" }));
    expect(asked).toMatchObject({ role: "user", in_reply_to: null });

    for (const extra of [{ role: "assistant" }, { role: "user" }, { in_reply_to: asked.id }, { created_at: "2001-01-01" }]) {
      const r = await refusal(asUser(db, a.userId, (tx) => makeMessage(tx, a.userId, a.caseId, extra)));
      expect(isGrantRefusal(r), r.message).toBe(true);
    }
    // The order of messages is the database's to give.
    await refusal(asUser(db, a.userId, (tx) => makeMessage(tx, a.userId, a.caseId, { seq: 1 })));
    await ownerIsRefused("update app.chat_messages set content = 'edited' where id = $1", [a.replyId]);
    await ownerIsRefused("update app.chat_messages set role = 'assistant' where id = $1", [asked.id]);
    await ownerIsRefused("delete from app.chat_messages where id = $1", [a.replyId]);
    expect(await countAll(db, "chat_messages", "user_id = $1 and role = 'assistant'", [a.userId])).toBe(1);
  });

  it("profiles: the owner changes their name and language, but not their phone, email or id", async () => {
    const changed = await asUser(db, a.userId, (tx) =>
      tx.query("update app.profiles set display_name = 'Asha T', preferred_language = 'hi' where id = $1", [a.userId]),
    );
    expect(changed.affectedRows).toBe(1);

    await ownerIsRefused("update app.profiles set phone = $2 where id = $1", [a.userId, b.phone]);
    await ownerIsRefused("update app.profiles set phone = $2 where id = $1", [a.userId, newPhone()]);
    await ownerIsRefused("update app.profiles set email = 'a@example.org' where id = $1", [a.userId]);
    await ownerIsRefused("update app.profiles set id = $2 where id = $1", [a.userId, newId()]);
    await ownerIsRefused("update app.profiles set created_at = now() where id = $1", [a.userId]);
    expect(await readAsService(db, "profiles", "id = $1", [a.userId])).toMatchObject({
      phone: a.phone,
      email: null,
      display_name: "Asha T",
      preferred_language: "hi",
    });
  });

  it("consents: the owner withdraws their consent once, but cannot delete it, rewrite it or take the withdrawal back", async () => {
    await ownerIsRefused("delete from app.consents where id = $1", [a.consentId]);
    await ownerIsRefused("update app.consents set granted_at = now() - interval '1 year' where id = $1", [a.consentId]);
    await ownerIsRefused("update app.consents set is_adult = false where id = $1", [a.consentId]);
    await ownerIsRefused("update app.consents set policy_version = 'other' where id = $1", [a.consentId]);
    const backdated = await refusal(
      asUser(db, a.userId, (tx) => makeConsent(tx, a.userId, { purpose: "other", granted_at: "2001-01-01" })),
    );
    expect(isGrantRefusal(backdated), backdated.message).toBe(true);
    const bornWithdrawn = await refusal(
      asUser(db, a.userId, (tx) => makeConsent(tx, a.userId, { purpose: "other", withdrawn_at: "2026-10-10" })),
    );
    expect(isGrantRefusal(bornWithdrawn), bornWithdrawn.message).toBe(true);

    // B cannot withdraw A's consent.
    const byOther = await asUser(db, b.userId, (tx) =>
      tx.query("update app.consents set withdrawn_at = now() where id = $1", [a.consentId]),
    );
    expect(byOther.affectedRows).toBe(0);
    expect((await readAsService(db, "consents", "id = $1", [a.consentId]))?.withdrawn_at).toBeNull();

    // The owner withdraws. The time recorded is the database's, not the one sent.
    const withdrawn = await asUser(db, a.userId, (tx) =>
      tx.query("update app.consents set withdrawn_at = '2099-01-01' where id = $1", [a.consentId]),
    );
    expect(withdrawn.affectedRows).toBe(1);
    const stamped = (await readAsService(db, "consents", "id = $1", [a.consentId]))?.withdrawn_at as Date;
    expect(stamped).toBeInstanceOf(Date);
    expect(Math.abs(stamped.getTime() - Date.now())).toBeLessThan(60_000);

    // It cannot be taken back or moved.
    for (const value of [null, "2020-01-01"]) {
      const again = await asUser(db, a.userId, (tx) =>
        tx.query("update app.consents set withdrawn_at = $2 where id = $1", [a.consentId, value]),
      );
      expect(again.affectedRows).toBe(0);
    }
    expect((await readAsService(db, "consents", "id = $1", [a.consentId]))?.withdrawn_at).toEqual(stamped);
  });

  it("audit_log: the service appends and reads, and not even the service can change or remove an entry", async () => {
    const entry = await asService(db, (tx) =>
      insertRow(tx, "audit_log", { user_id: a.userId, action: "case.read", subject_type: "case", subject_id: a.caseId }),
    );
    for (const sql of [
      "update app.audit_log set action = 'nothing.happened' where id = $1",
      "delete from app.audit_log where id = $1",
    ]) {
      const r = await refusal(asService(db, (tx) => tx.query(sql, [entry.id])));
      expect(isGrantRefusal(r), r.message).toBe(true);
    }
    const truncated = await refusal(asService(db, (tx) => tx.query("truncate app.audit_log")));
    expect(isGrantRefusal(truncated), truncated.message).toBe(true);
    expect((await readAsService(db, "audit_log", "id = $1", [entry.id]))?.action).toBe("case.read");
  });
});

// ---------------------------------------------------------------------------
// The claims.
// ---------------------------------------------------------------------------

describe("who a request is for", () => {
  it("app.user_id(): is the sub of the claims, and null when there are none", async () => {
    const mine = await asUser(db, a.userId, (tx) => tx.query<{ id: string }>("select app.user_id() as id"));
    expect(mine.rows[0].id).toBe(a.userId);
    for (const claims of ["", "{}", '{"sub":""}']) {
      const none = await asAuthenticatedWithClaims(db, claims, (tx) =>
        tx.query<{ id: string | null }>("select app.user_id() as id"),
      );
      expect(none.rows[0].id).toBeNull();
    }
    const service = await asService(db, (tx) => tx.query<{ id: string | null }>("select app.user_id() as id"));
    expect(service.rows[0].id).toBeNull();
  });

  it("app.user_id(): claims that are not valid stop the request instead of falling back to anybody", async () => {
    for (const claims of ["not json", '{"sub":"not-a-uuid"}', `{"sub":"${a.userId}' or '1'='1"}`]) {
      await refusal(asAuthenticatedWithClaims(db, claims, (tx) => tx.query("select * from app.cases")));
    }
  });

  it("app.user_id(): the claims end with the transaction, so the next request does not inherit a person", async () => {
    await asUser(db, a.userId, (tx) => tx.query("select 1"));
    const after = await db.query<{ claims: string | null; role: string }>(
      "select current_setting('request.jwt.claims', true) as claims, current_user as role",
    );
    expect(after.rows[0].claims ?? "").toBe("");
    expect(after.rows[0].role).not.toBe("authenticated");
    // And a failed request leaves nothing behind either.
    await refusal(asUser(db, a.userId, (tx) => tx.query("select * from app.audit_log")));
    const afterFailure = await db.query<{ claims: string | null }>(
      "select current_setting('request.jwt.claims', true) as claims",
    );
    expect(afterFailure.rows[0].claims ?? "").toBe("");
  });

  it("anon: cannot ask who the request is for, or use anything in the schema", async () => {
    const r = await refusal(asAnon(db, (tx) => tx.query("select app.user_id()")));
    expect(r.code, r.message).toBe(PERMISSION_DENIED);
  });
});

// ---------------------------------------------------------------------------
// Belt and braces: each layer holds without the other.
// ---------------------------------------------------------------------------

describe("the policies hold on their own", () => {
  /**
   * Gives "authenticated" every privilege on every table, runs `fn` as person
   * B, then rolls it all back. With the grants out of the way, only row-level
   * security stands between B and A.
   */
  async function asUserWithEveryGrant<T>(userId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
    let result: T | undefined;
    let failure: unknown;
    await db.transaction(async (tx) => {
      await tx.exec("grant all on all tables in schema app to authenticated");
      await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: userId })]);
      await tx.exec("set local role authenticated");
      try {
        result = await fn(tx);
      } catch (error) {
        failure = error;
      }
      await tx.rollback();
    });
    if (failure) throw failure;
    return result as T;
  }

  it.each(TABLES)("$table: with every grant given, another person still cannot see, change or remove the owner's rows", async (spec) => {
    const target = spec.row(a);
    const change = ANY_COLUMN[spec.table];
    const outcome = await asUserWithEveryGrant(b.userId, async (tx) => {
      const seen = await tx.query(`select * from app.${spec.table} where ${target.where}`, target.params);
      const updated = await tx.query(
        `update app.${spec.table} set ${change.column} = ${change.column} where ${target.where}`,
        target.params,
      );
      const deleted = await tx.query(`delete from app.${spec.table} where ${target.where}`, target.params);
      return { seen: seen.rows.length, updated: updated.affectedRows, deleted: deleted.affectedRows };
    });
    expect(outcome).toEqual({ seen: 0, updated: 0, deleted: 0 });
    expect(await countAll(db, spec.table, target.where, target.params)).toBeGreaterThan(0);
  });

  it.each(TABLES.filter((spec) => spec.ownerColumn === "user_id"))(
    "$table: with every grant given, a person still cannot hand their own row to someone else",
    async (spec) => {
      const mine = spec.row(b);
      const attempt = asUserWithEveryGrant(b.userId, (tx) =>
        tx.query(`update app.${spec.table} set user_id = $${mine.params.length + 1} where ${mine.where}`, [
          ...mine.params,
          a.userId,
        ]),
      );
      if (spec.personUpdates) {
        // There is an update policy, and its "with check" refuses the new owner.
        const r = await refusal(attempt);
        expect(isPolicyRefusal(r), r.message).toBe(true);
      } else {
        // There is no update policy, so no row is open to change at all.
        expect((await attempt).affectedRows).toBe(0);
      }
      expect((await readAsService(db, spec.table, mine.where, mine.params))?.user_id).toBe(b.userId);
    },
  );

  it("with every grant given, a person still cannot write worker-owned values or rows", async () => {
    const attempts: [string, (tx: Tx) => Promise<unknown>][] = [
      ["cases insert as ready", (tx) => makeCase(tx, b.userId, { status: "ready" })],
      ["cases insert for another", (tx) => makeCase(tx, a.userId)],
      ["documents insert as ready", (tx) => makeDocument(tx, b.userId, b.caseId, { status: "ready" })],
      ["analysis_jobs insert as ready", (tx) => makeJob(tx, b.userId, b.caseId, { state: "ready" })],
      ["analysis_jobs update", (tx) => tx.query("update app.analysis_jobs set state = 'failed' where id = $1 returning id", [b.jobId]).then(mustTouch)],
      ["documents update", (tx) => tx.query("update app.documents set status = 'ready' where id = $1 returning id", [b.documentId]).then(mustTouch)],
      ["analyses insert", (tx) => makeAnalysis(tx, b.userId, b.caseId, b.jobId)],
      ["analyses update", (tx) => tx.query("update app.analyses set model = 'x' where id = $1 returning id", [b.analysisId]).then(mustTouch)],
      ["analyses delete", (tx) => tx.query("delete from app.analyses where id = $1 returning id", [b.analysisId]).then(mustTouch)],
      ["chat_messages insert as assistant", (tx) => makeMessage(tx, b.userId, b.caseId, { role: "assistant" })],
      ["chat_messages update", (tx) => tx.query("update app.chat_messages set content = 'x' where id = $1 returning id", [b.replyId]).then(mustTouch)],
      ["chat_messages delete", (tx) => tx.query("delete from app.chat_messages where id = $1 returning id", [b.replyId]).then(mustTouch)],
      ["consents delete", (tx) => tx.query("delete from app.consents where id = $1 returning id", [b.consentId]).then(mustTouch)],
      ["audit_log insert", (tx) => insertRow(tx, "audit_log", { user_id: b.userId, action: "x", subject_type: "case" })],
      ["usage_counters insert", (tx) => insertRow(tx, "usage_counters", { user_id: b.userId, day: "2026-10-12", kind: "x" })],
      ["usage_counters update", (tx) => tx.query("update app.usage_counters set count = 0 where user_id = $1 returning user_id", [b.userId]).then(mustTouch)],
    ];
    for (const [name, attempt] of attempts) {
      const r = await refusal(asUserWithEveryGrant(b.userId, attempt));
      expect(r.code === PERMISSION_DENIED || r.code === "no_rows", `${name}: ${r.message}`).toBe(true);
    }
  });
});

/** Turns "the statement ran and touched nothing" into a refusal, for statements a policy hides rows from. */
function mustTouch(result: { rows: unknown[] }): void {
  if (result.rows.length === 0) throw Object.assign(new Error("no rows were touched"), { code: "no_rows" });
}

// ---------------------------------------------------------------------------
// The queries the services will run, as another person.
// ---------------------------------------------------------------------------

describe("reads that join tables stay inside one person's data", () => {
  it("documents with their case titles (DocumentService.listAll): another person's papers and titles do not appear", async () => {
    const sql = `select d.id, c.title from app.documents d join app.cases c on c.id = d.case_id`;
    const mine = await asUser(db, a.userId, (tx) => tx.query<Row>(sql));
    expect(mine.rows.map((row) => row.id)).toEqual([a.documentId]);
    const theirs = await asUser(db, b.userId, (tx) => tx.query<Row>(sql));
    expect(theirs.rows.map((row) => row.id)).toEqual([b.documentId]);
  });

  it("a subquery or an 'exists' cannot be used to learn about another person's case", async () => {
    const probe = await asUser(db, b.userId, (tx) =>
      tx.query<{ there: boolean; title: string | null }>(
        "select exists (select 1 from app.cases where id = $1) as there, (select title from app.cases where id = $1) as title",
        [a.caseId],
      ),
    );
    expect(probe.rows[0]).toEqual({ there: false, title: null });
  });

  it("deleting a case as another person leaves the case and everything under it in place", async () => {
    await asUser(db, b.userId, (tx) => tx.query("delete from app.cases where id = $1", [a.caseId]));
    for (const table of ["case_stories", "documents", "analysis_jobs", "analyses", "chat_messages"]) {
      expect(await countAll(db, table, "case_id = $1", [a.caseId]), table).toBeGreaterThan(0);
    }
  });

  it("deleting one's own account removes nothing of anybody else's", async () => {
    const deleted = await asUser(db, b.userId, (tx) => tx.query("delete from app.profiles"));
    expect(deleted.affectedRows).toBe(1);
    expect(await countAll(db, "profiles", "id = $1", [b.userId])).toBe(0);
    for (const spec of TABLES) {
      const target = spec.row(a);
      expect(await countAll(db, spec.table, target.where, target.params), spec.table).toBeGreaterThan(0);
    }
  });
});
