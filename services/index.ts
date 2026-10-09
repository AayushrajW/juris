import { mockAnalysisService } from "./mock/analysis";
import { mockAuthService } from "./mock/auth";
import { mockCaseRepository, mockDocumentService } from "./mock/cases";
import { mockChatService } from "./mock/chat";
import { mockLawyerChatService } from "./mock/lawyerChat";
import { mockLawyerRepository } from "./mock/lawyers";
import type {
  AnalysisService,
  AuthService,
  CaseRepository,
  ChatService,
  DocumentService,
  LawyerChatService,
  LawyerRepository,
} from "./types";

/** Composition root. Swap implementations here when Firebase / Gemini land. */
export const authService: AuthService = mockAuthService;
export const caseRepository: CaseRepository = mockCaseRepository;
export const documentService: DocumentService = mockDocumentService;
export const analysisService: AnalysisService = mockAnalysisService;
export const chatService: ChatService = mockChatService;
export const lawyerRepository: LawyerRepository = mockLawyerRepository;
export const lawyerChatService: LawyerChatService = mockLawyerChatService;
