export interface FCAFeedbackRecord {
  transactionReferenceNumber: string;
  errorCode: string;
  errorDescription: string;
  rejectedField: string;
  rejectedValue: string;
  feedbackTimestamp: string;
}

export interface SubmittedReport {
  transactionReferenceNumber: string;
  venueTransactionId: string;
  executingEntityIdCode: string;
  buyerIdentificationCode: string;
  sellerIdentificationCode: string;
  instrumentIdentificationCode: string;
  price: string;
  quantity: string;
  tradeDatetime: string;
  venueIdentification: string;
  currency: string;
}

export interface TradeRegistryEntry {
  venueTransactionId: string;
  clientAccountId: string;
  clientReference: string;
  tradeType: string;
  instrumentType: string;
  executionVenue: string;
}

export interface RelationshipManager {
  clientReference: string;
  clientName: string;
  rmName: string;
  rmEmail: string;
  rmPhone: string;
  clientTier: string;
  region: string;
}

export interface LEIRecord {
  lei: string;
  legalName: string;
  status: "ACTIVE" | "LAPSED" | "ANNULLED" | "RETIRED" | "PENDING";
  initialRegistrationDate: string;
  lastUpdateDate: string;
  nextRenewalDate: string;
  managingLou: string;
  jurisdiction: string;
}

export interface LEILookupResult {
  lei: string;
  legalName: string;
  status: LEIRecord["status"];
  nextRenewalDate: string;
  isExpired: boolean;
  isRenewable: boolean;
  managingLou: string;
}

export interface EnrichedRejection {
  fcaFeedback: FCAFeedbackRecord;
  submittedReport: SubmittedReport | null;
  tradeRegistry: TradeRegistryEntry | null;
  relationshipManager: RelationshipManager | null;
  leiLookup: LEILookupResult | null;
}

export interface DiagnosisResult {
  rejectionId: string;
  rootCause: string;
  severity: "critical" | "warning" | "info";
  explanation: string;
  recommendedFix: string;
  actioner: "client" | "internal" | "regulator";
  regulatoryDeadline: string;
}

export interface DraftEmail {
  to: string;
  toName: string;
  subject: string;
  body: string;
  priority: "high" | "medium" | "low";
}

export interface RejectionResult {
  id: string;
  enrichedRejection: EnrichedRejection;
  diagnosis: DiagnosisResult;
  draftEmail: DraftEmail;
  status: "pending_approval" | "approved" | "rejected" | "escalated";
  approvedAt: string | null;
}

export interface AnalysisResult {
  id: string;
  createdAt: string;
  status: "processing" | "complete" | "error";
  summary: {
    total: number;
    critical: number;
    warning: number;
    info: number;
  };
  rejections: RejectionResult[];
}
