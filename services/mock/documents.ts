import type { DocumentListing, UploadedDocument } from "@/domain/document";
import { fail, ok } from "@/domain/result";
import { checkFile, fileKind } from "@/lib/files";
import { newId } from "@/lib/ids";
import type { DocumentService } from "@/services/types";
import { localized, ownCases } from "./cases";
import { newestFirst, ownedCase, paginate, signedIn } from "./session";
import { loadStore, updateStore } from "./store";

const orderKey = (doc: UploadedDocument) => `${doc.createdAt}|${doc.id}`;

export const mockDocumentService: DocumentService = {
  async list(caseId) {
    const found = ownedCase(caseId);
    if (!found.ok) return found;
    return ok(loadStore().documents.filter((d) => d.caseId === caseId));
  },
  async listAll(params) {
    const who = signedIn();
    if (!who.ok) return who;
    const titles = new Map(ownCases(who.data.id).map((record) => [record.id, localized(record).title]));
    const mine = loadStore().documents.filter((d) => titles.has(d.caseId));
    const page = paginate(newestFirst(mine, orderKey), params, orderKey);
    if (!page.ok) return page;
    const items: DocumentListing[] = page.data.items.map((doc) => ({
      ...doc,
      caseTitle: titles.get(doc.caseId) ?? "",
    }));
    return ok({ ...page.data, items });
  },
  async upload(caseId, file, options) {
    const found = ownedCase(caseId);
    if (!found.ok) return found;
    const problem = checkFile(file);
    if (problem === "type") return fail("invalid", { reason: "file_type", field: "file" });
    if (problem === "size") return fail("too_large", { reason: "file_size", field: "file" });

    // A retry after a lost reply gets the paper the first request stored.
    const requestKey = options?.requestId ? `upload:${options.requestId}` : null;
    const print = JSON.stringify([caseId, file.name, file.type, file.size]);
    const earlier = requestKey ? loadStore().requests[requestKey] : undefined;
    const stored = earlier ? loadStore().documents.find((d) => d.id === earlier.made) : undefined;
    if (earlier && stored) {
      return earlier.print === print ? ok(stored) : fail("conflict", { reason: "request_reused" });
    }

    // The demo keeps only what describes the file. A real service stores the file itself.
    const mimeType = file.type || "application/octet-stream";
    const doc: UploadedDocument = {
      id: `doc-${newId()}`,
      caseId,
      fileName: file.name,
      mimeType,
      byteSize: file.size,
      kind: fileKind(mimeType),
      uploadStatus: "local_only",
      createdAt: new Date().toISOString(),
    };
    updateStore((s) => ({
      ...s,
      documents: [...s.documents, doc],
      requests: requestKey ? { ...s.requests, [requestKey]: { made: doc.id, print } } : s.requests,
    }));
    return ok(doc);
  },
  async remove(documentId) {
    const who = signedIn();
    if (!who.ok) return who;
    const doc = loadStore().documents.find((d) => d.id === documentId);
    // A paper on someone else's case is reported the same way as one that does not exist.
    if (!doc || !ownedCase(doc.caseId).ok) return fail("not_found");
    updateStore((s) => ({
      ...s,
      documents: s.documents.filter((d) => d.id !== documentId),
      requests: Object.fromEntries(Object.entries(s.requests).filter(([, r]) => r.made !== documentId)),
    }));
    return ok(null);
  },
};
