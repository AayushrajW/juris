import type { CaseAnalysis } from "@/domain/analysis";
import type { CaseId, CaseRecord, CaseSource, MatterCategory } from "@/domain/case";
import type { ChatMessage } from "@/domain/chat";
import type { ProblemDescription, UploadedDocument } from "@/domain/document";
import type { LawyerFilters, LawyerId, LawyerProfile } from "@/domain/lawyer";
import type { LawyerMessage, LawyerThread } from "@/domain/thread";
import type { ServiceResult } from "@/domain/result";
import type { User } from "@/domain/user";

export interface AuthCredentials {
  displayName?: string;
  email: string;
  password?: string;
}

export interface AuthService {
  signIn(credentials: AuthCredentials): Promise<ServiceResult<User>>;
  signUp(credentials: AuthCredentials): Promise<ServiceResult<User>>;
  requestPasswordReset(email: string): Promise<ServiceResult<{ message: string }>>;
  signOut(): Promise<void>;
  getSession(): Promise<User | null>;
}

export interface CreateCaseInput {
  title: string;
  category: MatterCategory;
  source: CaseSource;
  city?: string;
  state?: string;
  document?: {
    fileName: string;
    mimeType: string;
    byteSize: number;
    kind: UploadedDocument["kind"];
    previewUrl?: string;
  };
  description?: Omit<ProblemDescription, "caseId">;
}

export interface CaseRepository {
  listByCitizen(citizenId: string): Promise<ServiceResult<CaseRecord[]>>;
  getById(caseId: CaseId): Promise<ServiceResult<CaseRecord>>;
  createDraft(citizenId: string, input: CreateCaseInput): Promise<ServiceResult<CaseRecord>>;
  updateStatus(caseId: CaseId, status: CaseRecord["status"]): Promise<ServiceResult<CaseRecord>>;
}

export interface DocumentService {
  getByCaseId(caseId: CaseId): Promise<ServiceResult<UploadedDocument | null>>;
  getDescription(caseId: CaseId): Promise<ServiceResult<ProblemDescription | null>>;
}

export interface AnalysisService {
  getAnalysis(caseId: CaseId): Promise<ServiceResult<CaseAnalysis>>;
  startProcessing(caseId: CaseId): Promise<ServiceResult<CaseAnalysis>>;
}

export interface ChatService {
  list(caseId: CaseId): Promise<ServiceResult<ChatMessage[]>>;
  send(caseId: CaseId, content: string): Promise<ServiceResult<ChatMessage[]>>;
}

export interface LawyerRepository {
  list(filters?: LawyerFilters): Promise<ServiceResult<LawyerProfile[]>>;
  getById(id: LawyerId): Promise<ServiceResult<LawyerProfile>>;
}

export interface LawyerChatService {
  listThreads(): Promise<ServiceResult<LawyerThread[]>>;
  list(lawyerId: LawyerId): Promise<ServiceResult<LawyerMessage[]>>;
  send(lawyerId: LawyerId, content: string): Promise<ServiceResult<LawyerMessage[]>>;
  markRead(lawyerId: LawyerId): Promise<ServiceResult<LawyerThread[]>>;
}
