import { isDemoCase } from "@/data/mocks/locales";
import type { CaseId, CaseRecord } from "@/domain/case";
import type { CaseRepository, CreateCaseInput, DocumentService } from "@/services/types";
import { demoText } from "./locale";
import { loadStore, updateStore } from "./store";

function nowIso() {
  return new Date().toISOString();
}

function newId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

/** Sample cases show their title in the language of the page. */
function localized(record: CaseRecord): CaseRecord {
  const title = demoText().caseTitles[record.id];
  return title ? { ...record, title } : record;
}

export const mockCaseRepository: CaseRepository = {
  async listByCitizen(citizenId) {
    const cases = loadStore()
      .cases.filter((c) => c.citizenId === citizenId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map(localized);
    return { ok: true, data: cases };
  },
  async getById(caseId: CaseId) {
    const found = loadStore().cases.find((c) => c.id === caseId);
    if (!found) {
      return { ok: false, code: "not_found", message: "This case is not in the demo file." };
    }
    return { ok: true, data: localized(found) };
  },
  async createDraft(citizenId, input: CreateCaseInput) {
    const id = newId("case");
    const createdAt = nowIso();
    const record: CaseRecord = {
      id,
      citizenId,
      title: input.title.trim() || "Untitled case",
      category: input.category,
      source: input.source,
      status: "processing",
      createdAt,
      updatedAt: createdAt,
      location: { city: input.city, state: input.state },
      isDemo: true,
    };
    updateStore((s) => {
      const documents = input.document
        ? [
            ...s.documents,
            {
              id: `doc-${id}`,
              caseId: id,
              fileName: input.document.fileName,
              mimeType: input.document.mimeType,
              byteSize: input.document.byteSize,
              kind: input.document.kind,
              // A blob: link dies with the page, so it is never stored.
              previewUrl: undefined,
              uploadStatus: "local_only" as const,
            },
          ]
        : s.documents;
      const descriptions = input.description
        ? [...s.descriptions, { ...input.description, caseId: id }]
        : s.descriptions;
      return { ...s, cases: [record, ...s.cases], documents, descriptions };
    });
    return { ok: true, data: record };
  },
  async updateStatus(caseId, status) {
    let updated: CaseRecord | undefined;
    updateStore((s) => ({
      ...s,
      cases: s.cases.map((c) => {
        if (c.id !== caseId) return c;
        updated = { ...c, status, updatedAt: nowIso() };
        return updated;
      }),
    }));
    if (!updated) {
      return { ok: false, code: "not_found", message: "This case is not in the demo file." };
    }
    return { ok: true, data: localized(updated) };
  },
};

export const mockDocumentService: DocumentService = {
  async getByCaseId(caseId) {
    const doc = loadStore().documents.find((d) => d.caseId === caseId) ?? null;
    return { ok: true, data: doc };
  },
  async getDescription(caseId) {
    if (isDemoCase(caseId)) {
      const sample = demoText().descriptions[caseId];
      return { ok: true, data: sample ? { ...sample, caseId } : null };
    }
    const desc = loadStore().descriptions.find((d) => d.caseId === caseId) ?? null;
    return { ok: true, data: desc };
  },
};
