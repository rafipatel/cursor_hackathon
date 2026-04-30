import type { EnrichedRejection } from "../types.js";

export const SYSTEM_PROMPT = `You are a senior regulatory compliance specialist at a financial institution. You analyse FCA MiFIR transaction report rejections and produce actionable remediation advice.

Your responsibilities:
1. Diagnose the root cause of each rejection using the error code, rejected field/value, GLEIF LEI status, and submitted report data.
2. Assess severity: "critical" if the LEI is annulled/retired (requires new LEI), "warning" if lapsed (renewable), "info" for data entry issues.
3. Determine who must act: "client" (LEI renewal/new LEI), "internal" (data correction), or "regulator" (dispute).
4. Draft a concise, professional notification email to the relationship manager.

You MUST respond with valid JSON only — no markdown, no commentary, no code fences. The JSON must be an array of objects, one per rejection, with this exact schema:

[
  {
    "rejectionId": "<transaction_reference_number>",
    "rootCause": "<one sentence>",
    "severity": "critical" | "warning" | "info",
    "explanation": "<2-3 sentences explaining what happened and regulatory implications>",
    "recommendedFix": "<specific action steps>",
    "actioner": "client" | "internal" | "regulator",
    "regulatoryDeadline": "<T+N business days from feedback receipt>",
    "email": {
      "subject": "<email subject>",
      "body": "<full email body>",
      "priority": "high" | "medium" | "low"
    }
  }
]`;

export function buildUserPrompt(enrichedRejections: EnrichedRejection[]): string {
  const formatted = enrichedRejections.map((r, i) => {
    const fb = r.fcaFeedback;
    const report = r.submittedReport;
    const trade = r.tradeRegistry;
    const rm = r.relationshipManager;
    const lei = r.leiLookup;

    return `--- Rejection ${i + 1} ---
Transaction Reference: ${fb.transactionReferenceNumber}
Error Code: ${fb.errorCode}
Error Description: ${fb.errorDescription}
Rejected Field: ${fb.rejectedField}
Rejected Value: ${fb.rejectedValue}
Client Reference: ${fb.clientReference}

Submitted Report:
${report ? `  Venue Transaction ID: ${report.venueTransactionId}
  Buyer LEI: ${report.buyerIdentificationCode}
  Seller LEI: ${report.sellerIdentificationCode}
  Client Reference: ${report.clientReference}
  Trading DateTime: ${report.tradingDatetime}` : "  Not found"}

Trade Registry:
${trade ? `  FXall Trade ID: ${trade.fxallTradeId}
  Client Account: ${trade.clientAccountId}
  Fund ID: ${trade.fundId}
  Client Reference: ${trade.clientReference}
  Trade Date: ${trade.tradeDate}` : "  Not found"}

Relationship Manager:
${rm ? `  RM Name: ${rm.rmName}
  RM Email: ${rm.rmEmail}
  Client Account: ${rm.clientAccountId}
  Region: ${rm.rmRegion}
  Timezone: ${rm.rmTimezone}` : "  Not found"}

LEI Status (GLEIF):
${lei ? `  LEI: ${lei.lei}
  Legal Name: ${lei.legalName}
  Status: ${lei.status}
  Next Renewal Date: ${lei.nextRenewalDate}
  Is Expired: ${lei.isExpired}
  Is Renewable: ${lei.isRenewable}` : "  Not found in GLEIF database"}`;
  });

  return `Analyse the following ${enrichedRejections.length} FCA MiFIR transaction report rejection(s) and produce your diagnosis and RM notification for each.\n\n${formatted.join("\n\n")}`;
}
