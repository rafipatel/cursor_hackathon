import type {
  EnrichedRejection,
  DiagnosisResult,
  DraftEmail,
  RejectionResult,
} from "../types.js";

interface AgentDiagnosis {
  rejectionId: string;
  rootCause: string;
  severity: "critical" | "warning" | "info";
  explanation: string;
  recommendedFix: string;
  actioner: "client" | "internal" | "regulator";
  regulatoryDeadline: string;
  email: {
    subject: string;
    body: string;
    priority: "high" | "medium" | "low";
  };
}

export function parseAgentResponse(raw: string): AgentDiagnosis[] {
  const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  return JSON.parse(cleaned) as AgentDiagnosis[];
}

export function buildRejectionResults(
  enrichedRejections: EnrichedRejection[],
  diagnoses: AgentDiagnosis[]
): RejectionResult[] {
  return enrichedRejections.map((enriched, i) => {
    const diag = diagnoses.find(
      (d) => d.rejectionId === enriched.fcaFeedback.transactionReferenceNumber
    ) ?? diagnoses[i];

    const diagnosis: DiagnosisResult = {
      rejectionId: diag.rejectionId,
      rootCause: diag.rootCause,
      severity: diag.severity,
      explanation: diag.explanation,
      recommendedFix: diag.recommendedFix,
      actioner: diag.actioner,
      regulatoryDeadline: diag.regulatoryDeadline,
    };

    const rm = enriched.relationshipManager;
    const draftEmail: DraftEmail = {
      to: rm?.rmEmail ?? "compliance@firm.com",
      toName: rm?.rmName ?? "Compliance Team",
      subject: diag.email.subject,
      body: diag.email.body,
      priority: diag.email.priority,
    };

    return {
      id: `rej-${diag.rejectionId}`,
      enrichedRejection: enriched,
      diagnosis,
      draftEmail,
      status: "pending_approval" as const,
      approvedAt: null,
    };
  });
}

export function buildFallbackResults(
  enrichedRejections: EnrichedRejection[]
): RejectionResult[] {
  return enrichedRejections.map((enriched) => {
    const fb = enriched.fcaFeedback;
    const lei = enriched.leiLookup;
    const rm = enriched.relationshipManager;

    const isAnnulled = lei?.status === "ANNULLED" || lei?.status === "RETIRED";
    const isLapsed = lei?.status === "LAPSED";

    const severity: DiagnosisResult["severity"] = isAnnulled
      ? "critical"
      : isLapsed
        ? "warning"
        : "info";

    const rootCause = isAnnulled
      ? `LEI ${fb.rejectedValue} has been annulled/retired and removed from the GLEIF database`
      : isLapsed
        ? `LEI ${fb.rejectedValue} has lapsed — renewal was due ${lei?.nextRenewalDate ?? "unknown"}`
        : `Rejection code ${fb.errorCode}: ${fb.errorDescription}`;

    const recommendedFix = isAnnulled
      ? `Client must obtain a new LEI from an accredited LOU. The previous LEI cannot be reinstated.`
      : isLapsed
        ? `Client must renew LEI through their managing LOU before resubmission.`
        : `Review and correct the ${fb.rejectedField} field value.`;

    const actioner: DiagnosisResult["actioner"] = isAnnulled || isLapsed ? "client" : "internal";

    const clientRef = fb.clientReference;

    const diagnosis: DiagnosisResult = {
      rejectionId: fb.transactionReferenceNumber,
      rootCause,
      severity,
      explanation: `Transaction ${fb.transactionReferenceNumber} was rejected by the FCA with code ${fb.errorCode}. ${fb.errorDescription}. ${lei ? `GLEIF records show the LEI is currently ${lei.status}.` : ""}`,
      recommendedFix,
      actioner,
      regulatoryDeadline: "T+3 business days from feedback receipt",
    };

    const draftEmail: DraftEmail = {
      to: rm?.rmEmail ?? "compliance@firm.com",
      toName: rm?.rmName ?? "Compliance Team",
      subject: `[${severity.toUpperCase()}] MiFIR Rejection — ${clientRef} — ${fb.transactionReferenceNumber}`,
      body: `Dear ${rm?.rmName ?? "Compliance Team"},

Transaction ${fb.transactionReferenceNumber} for ${clientRef} has been rejected by the FCA.

Error: ${fb.errorCode} — ${fb.errorDescription}
Rejected Field: ${fb.rejectedField}
Rejected Value: ${fb.rejectedValue}

Root Cause: ${rootCause}

Recommended Action: ${recommendedFix}

This must be resolved within 3 business days of the feedback receipt.

Please coordinate with ${clientRef} to resolve this at the earliest opportunity.

Regards,
Regulatory Reporting Operations`,
      priority: severity === "critical" ? "high" : severity === "warning" ? "medium" : "low",
    };

    return {
      id: `rej-${fb.transactionReferenceNumber}`,
      enrichedRejection: enriched,
      diagnosis,
      draftEmail,
      status: "pending_approval" as const,
      approvedAt: null,
    };
  });
}
