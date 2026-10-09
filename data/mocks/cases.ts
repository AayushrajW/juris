import type { CaseRecord } from "@/domain/case";
import type { UploadedDocument } from "@/domain/document";
import { EN } from "./locales/en";
import { DEMO_USER } from "./user";

/** The sample cases. Titles, stories and explanations come from data/mocks/locales, per language. */
export const DEMO_CASES: CaseRecord[] = [
  {
    id: "case-tenancy",
    citizenId: DEMO_USER.id,
    title: EN.caseTitles["case-tenancy"],
    category: "tenancy",
    source: "document_and_description",
    status: "ready",
    createdAt: "2026-08-12T09:10:00.000Z",
    updatedAt: "2026-08-12T09:18:00.000Z",
    location: { city: "Pune", state: "Maharashtra" },
    isDemo: true,
  },
  {
    id: "case-consumer",
    citizenId: DEMO_USER.id,
    title: EN.caseTitles["case-consumer"],
    category: "consumer",
    source: "document_and_description",
    status: "ready",
    createdAt: "2026-08-08T14:02:00.000Z",
    updatedAt: "2026-08-08T14:20:00.000Z",
    location: { city: "Pune", state: "Maharashtra" },
    isDemo: true,
  },
  {
    id: "case-employment",
    citizenId: DEMO_USER.id,
    title: EN.caseTitles["case-employment"],
    category: "employment",
    source: "description",
    status: "needs_more_info",
    createdAt: "2026-08-16T06:40:00.000Z",
    updatedAt: "2026-08-16T06:44:00.000Z",
    location: { city: "Thane", state: "Maharashtra" },
    isDemo: true,
  },
];

export const DEMO_DOCUMENTS: UploadedDocument[] = [
  {
    id: "doc-tenancy",
    caseId: "case-tenancy",
    fileName: "leave-and-licence-notice.pdf",
    mimeType: "application/pdf",
    byteSize: 186400,
    kind: "pdf",
    previewUrl: "/demo/tenancy-notice.svg",
    uploadStatus: "simulated",
  },
  {
    id: "doc-consumer",
    caseId: "case-consumer",
    fileName: "warranty-card.jpg",
    mimeType: "image/jpeg",
    byteSize: 94200,
    kind: "image",
    previewUrl: "/demo/warranty-card.svg",
    uploadStatus: "simulated",
  },
];
