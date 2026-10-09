import type { CaseRecord } from "@/domain/case";
import type { ProblemDescription, UploadedDocument } from "@/domain/document";
import { DEMO_USER } from "./user";

export const DEMO_CASES: CaseRecord[] = [
  {
    id: "case-tenancy",
    citizenId: DEMO_USER.id,
    title: "Rent notice from Bengaluru landlord",
    category: "tenancy",
    source: "document_and_description",
    status: "ready",
    createdAt: "2026-08-12T09:10:00.000Z",
    updatedAt: "2026-08-12T09:18:00.000Z",
    location: { city: "Bengaluru", state: "Karnataka" },
    isDemo: true,
  },
  {
    id: "case-consumer",
    citizenId: DEMO_USER.id,
    title: "Washing machine still under warranty",
    category: "consumer",
    source: "document",
    status: "ready",
    createdAt: "2026-08-08T14:02:00.000Z",
    updatedAt: "2026-08-08T14:20:00.000Z",
    location: { city: "Pune", state: "Maharashtra" },
    isDemo: true,
  },
  {
    id: "case-employment",
    citizenId: DEMO_USER.id,
    title: "Two months’ salary not paid",
    category: "employment",
    source: "description",
    status: "needs_more_info",
    createdAt: "2026-08-16T06:40:00.000Z",
    updatedAt: "2026-08-16T06:44:00.000Z",
    location: { city: "Hyderabad", state: "Telangana" },
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

export const DEMO_DESCRIPTIONS: ProblemDescription[] = [
  {
    caseId: "case-tenancy",
    narrative:
      "I have been living in a 1BHK in Koramangala for 11 months. Yesterday the owner sent a PDF asking me to vacate in 15 days. The rent is paid up to date.",
    whatHappened: "Received a notice asking me to leave the flat.",
    whenHappened: "August 2026",
    whoInvolved: "Building owner listed as R. Krishnan; I am the occupant.",
    whatOutcomeWanted: "I want enough time to move and my deposit back.",
  },
  {
    caseId: "case-employment",
    narrative:
      "I joined a small logistics company in June as an operations associate. Salary for June was paid. July and August have not been credited. HR says “accounts is delayed”. I only have the offer WhatsApp and an appointment letter scan at home, not uploaded yet.",
    whatHappened: "Two months of salary missing.",
    whenHappened: "July and August 2026",
    whoInvolved: "Employer (demo name: SwiftCart Logistics) and HR desk.",
    whatOutcomeWanted: "Be paid the arrears or understand how to raise a complaint.",
  },
];
