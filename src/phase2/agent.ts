import { Agent } from "@cursor/sdk";
import Anthropic from "@anthropic-ai/sdk";
import type {
  EnrichedRejection,
  AgentOutput,
  DiagnosisResult,
  RMNotification,
} from "../types/index.js";

// ── Prompt helpers ────────────────────────────────────────────────────────────

const AGENT_SYSTEM_PROMPT = `You are a MiFIR trade reporting compliance specialist.
Analyze FCA rejection feedback for trade reports and help relationship managers resolve issues.

Respond with ONLY a valid JSON object — no markdown fences, no explanation:
{
  "diagnosis": {
    "transaction_ref": "<string>",
    "error_code": "<string>",
    "root_cause": "<plain English root cause>",
    "severity": "<critical|warning|info>",
    "recommended_fix": "<specific actionable steps>",
    "action_owner": "<client|RM|compliance team|registry>"
  },
  "notification": {
    "to_email": "<RM email>",
    "to_name": "<RM name>",
    "client_name": "<client name>",
    "subject": "<email subject>",
    "body": "<full professional email body>",
    "transaction_ref": "<transaction ref>",
    "deadline": "<ISO date, T+2 business days>"
  }
}
If relationship data is missing, set "notification" to null.`;

function buildUserPrompt(enriched: EnrichedRejection): string {
  return `Analyze this FCA MiFIR rejection:

REJECTION: ${JSON.stringify(enriched.rejection, null, 2)}
MIFIR REPORT: ${enriched.mifir_report ? JSON.stringify(enriched.mifir_report, null, 2) : "NOT FOUND"}
FXALL TRADE: ${enriched.fxall_trade ? JSON.stringify(enriched.fxall_trade, null, 2) : "NOT FOUND"}
RELATIONSHIP MANAGER: ${enriched.relationship ? JSON.stringify(enriched.relationship, null, 2) : "NOT FOUND"}
BUYER LEI (GLEIF): ${enriched.buyer_lei_info ? JSON.stringify(enriched.buyer_lei_info, null, 2) : "NOT FOUND"}
SELLER LEI (GLEIF): ${enriched.seller_lei_info ? JSON.stringify(enriched.seller_lei_info, null, 2) : "NOT FOUND"}
Today's date: ${new Date().toISOString().split("T")[0]}`;
}

function parseJsonOutput(raw: string, txRef: string): AgentOutput {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`No JSON in agent response for ${txRef}`);
  const parsed = JSON.parse(match[0]) as {
    diagnosis: DiagnosisResult;
    notification: RMNotification | null;
  };
  return { diagnosis: parsed.diagnosis, notification: parsed.notification ?? null };
}

// ── Strategy 1: Cursor SDK cloud agent ───────────────────────────────────────

async function runWithCursorSdk(
  enriched: EnrichedRejection,
  apiKey: string
): Promise<AgentOutput> {
  // model required for cloud routing; apiKey alone defaults to local (needs IDE)
  const agent = await Agent.create({
    apiKey,
    model: { id: "claude-3-5-sonnet-20241022" },
    name: "FCA-MiFIR-Analyst",
  });
  try {
    const run = await agent.send(
      `${AGENT_SYSTEM_PROMPT}\n\n${buildUserPrompt(enriched)}`
    );
    const result = await run.wait();
    if (!result.result) throw new Error("Empty result from Cursor agent");
    return parseJsonOutput(result.result, enriched.rejection.transaction_ref);
  } finally {
    agent.close();
  }
}

// ── Strategy 2: Anthropic Claude API ─────────────────────────────────────────

async function runWithAnthropic(
  enriched: EnrichedRejection,
  apiKey: string
): Promise<AgentOutput> {
  const client = new Anthropic({ apiKey });
  const message = await client.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 1024,
    system: AGENT_SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserPrompt(enriched) }],
  });

  const text = message.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");

  return parseJsonOutput(text, enriched.rejection.transaction_ref);
}

// ── Strategy 3: Rule-based fallback (always works, no LLM required) ──────────

const DEADLINE_OFFSET_DAYS = 2;

function addBusinessDays(date: Date, days: number): string {
  const result = new Date(date);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const dow = result.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return result.toISOString().split("T")[0]!;
}

const ERROR_RULES: Record<
  string,
  { severity: DiagnosisResult["severity"]; root_cause: string; recommended_fix: string; action_owner: string }
> = {
  // Real FCA/ESMA error codes from the data files
  LEIV001: {
    severity: "critical",
    root_cause:
      "The buyer LEI registration has lapsed. Under MiFIR Article 26, all transaction counterparties must hold a valid, current LEI at the time of reporting. A lapsed LEI renders the trade report non-compliant.",
    recommended_fix:
      "The client must renew their LEI immediately through their Local Operating Unit (LOU). Once renewed, resubmit the corrected transaction report within T+1.",
    action_owner: "client",
  },
  LEIV002: {
    severity: "critical",
    root_cause:
      "The buyer or seller LEI has been annulled — it is permanently invalid and cannot be reactivated. The legal entity's status may have changed due to a merger, dissolution, or name change.",
    recommended_fix:
      "Verify the counterparty's current legal entity status. If they are still active under a new structure, they must obtain a new LEI. Contact the client to confirm the correct LEI and resubmit.",
    action_owner: "client",
  },
  LEIV003: {
    severity: "critical",
    root_cause:
      "The seller LEI is invalid or not found in the GLEIF global LEI registry. The LEI may have been entered incorrectly or may not yet be registered.",
    recommended_fix:
      "Cross-check the LEI against the GLEIF portal (gleif.org). Correct the LEI value in the source system and resubmit.",
    action_owner: "compliance team",
  },
  ISIN001: {
    severity: "warning",
    root_cause:
      "The submitted ISIN failed the ESMA validation checksum. The instrument identifier was entered incorrectly or the instrument uses a non-standard identifier format.",
    recommended_fix:
      "Verify the ISIN against the ESMA Financial Instruments Reference Data System (FIRDS). Correct the instrument identifier and resubmit. If the instrument is not ISIN-eligible, check applicable exemptions.",
    action_owner: "compliance team",
  },
  // Legacy/sample error codes (kept for backward compatibility)
  "ESMA-LEI-001": {
    severity: "critical",
    root_cause:
      "The buyer LEI registration has lapsed. Under MiFIR Article 26, all transaction counterparties must hold a valid, current LEI at the time of reporting.",
    recommended_fix:
      "The client must renew their LEI immediately through their Local Operating Unit (LOU). Once renewed, resubmit within T+1.",
    action_owner: "client",
  },
  "ESMA-LEI-003": {
    severity: "critical",
    root_cause:
      "The seller LEI has been annulled and is permanently invalid.",
    recommended_fix:
      "Verify the counterparty's current legal entity status and obtain a new LEI if still active. Resubmit with the correct LEI.",
    action_owner: "client",
  },
  "ESMA-ISIN-007": {
    severity: "warning",
    root_cause:
      "The submitted ISIN failed the ESMA validation checksum.",
    recommended_fix:
      "Verify the ISIN against ESMA FIRDS and resubmit with the correct identifier.",
    action_owner: "compliance team",
  },
};

function buildRuleBasedOutput(enriched: EnrichedRejection): AgentOutput {
  const { rejection, relationship, buyer_lei_info, seller_lei_info } = enriched;
  const rule = ERROR_RULES[rejection.error_code] ?? {
    severity: "warning" as const,
    root_cause: `Rejection received for field '${rejection.field}' with value '${rejection.submitted_value}'. Reason: ${rejection.reject_reason || "Manual compliance review required."}`,
    recommended_fix: "Review the rejected field against FCA MiFIR validation rules and resubmit.",
    action_owner: "compliance team",
  };

  const fieldLower = rejection.field.toLowerCase();
  const isLeiField =
    fieldLower.includes("buyer") ||
    fieldLower.includes("buyeridentification") ||
    fieldLower.includes("seller");
  const isBuyerField = fieldLower.includes("buyer");
  const leiInfo = isLeiField
    ? isBuyerField
      ? buyer_lei_info
      : seller_lei_info
    : null;
  const leiContext = leiInfo
    ? ` LEI '${leiInfo.lei}' belongs to '${leiInfo.entity_legal_name}' (status: ${leiInfo.lei_status}, next renewal: ${leiInfo.next_renewal_date}).`
    : "";

  const diagnosis: DiagnosisResult = {
    transaction_ref: rejection.transaction_ref,
    error_code: rejection.error_code,
    root_cause: rule.root_cause + leiContext,
    severity: rule.severity,
    recommended_fix: rule.recommended_fix,
    action_owner: rule.action_owner,
  };

  let notification: RMNotification | null = null;
  if (relationship) {
    const clientName = leiInfo?.entity_legal_name ?? rejection.client_reference;
    const deadline = addBusinessDays(new Date(), DEADLINE_OFFSET_DAYS);
    const isLeiError = rejection.error_code.startsWith("ESMA-LEI");

    const subject = `ACTION REQUIRED: MiFIR Trade Report Rejection — ${rejection.transaction_ref} [${rule.severity.toUpperCase()}]`;

    const body = [
      `Dear ${relationship.rm_name},`,
      "",
      `I am writing to notify you that trade report ${rejection.transaction_ref} for client ${clientName} has been rejected by the FCA under MiFIR reporting requirements.`,
      "",
      `REJECTION DETAILS`,
      `─────────────────`,
      `Transaction Reference: ${rejection.transaction_ref}`,
      `Error Code:           ${rejection.error_code}`,
      `Affected Field:       ${rejection.field}`,
      `Submitted Value:      ${rejection.submitted_value}`,
      `Severity:             ${rule.severity.toUpperCase()}`,
      "",
      `ROOT CAUSE`,
      `──────────`,
      rule.root_cause + leiContext,
      "",
      `REQUIRED ACTION`,
      `───────────────`,
      rule.recommended_fix,
      "",
      isLeiError
        ? `Please contact your client (${clientName}) urgently to initiate LEI remediation. Provide confirmation to the compliance team by ${deadline}.`
        : `Please coordinate with the compliance team to correct and resubmit by ${deadline}.`,
      "",
      `DEADLINE: ${deadline}`,
      "",
      `This is an automated notification from the MiFIR Rejection Pipeline. Please do not reply to this email — contact the Compliance team directly for assistance.`,
      "",
      `Regards,`,
      `MiFIR Compliance Operations`,
    ].join("\n");

    notification = {
      to_email: relationship.rm_email,
      to_name: relationship.rm_name,
      client_name: clientName,
      subject,
      body,
      transaction_ref: rejection.transaction_ref,
      deadline,
    };
  }

  return { diagnosis, notification };
}

// ── Orchestrator: tries each strategy in order ────────────────────────────────

export async function runAgentPhase(
  enrichedRejections: EnrichedRejection[],
  options: { cursorApiKey?: string; anthropicApiKey?: string }
): Promise<AgentOutput[]> {
  const results: AgentOutput[] = [];

  for (const enriched of enrichedRejections) {
    const txRef = enriched.rejection.transaction_ref;
    let output: AgentOutput | null = null;
    let strategyUsed = "";

    // 1. Cursor SDK (cloud agent — requires Pro)
    if (options.cursorApiKey && !output) {
      try {
        output = await runWithCursorSdk(enriched, options.cursorApiKey);
        strategyUsed = "Cursor SDK";
      } catch (e: unknown) {
        const err = e as { code?: string; message?: string };
        const isExpected =
          err.code === "plan_required" ||
          err.code === "unauthenticated" ||
          err.message?.includes("model") ||
          err.message?.includes("Local SDK");
        if (!isExpected) throw e;
        // fall through to next strategy
      }
    }

    // 2. Anthropic Claude (direct API)
    if (options.anthropicApiKey && !output) {
      try {
        output = await runWithAnthropic(enriched, options.anthropicApiKey);
        strategyUsed = "Anthropic Claude";
      } catch {
        // fall through to rule engine
      }
    }

    // 3. Rule-based engine (always available, no LLM needed)
    if (!output) {
      output = buildRuleBasedOutput(enriched);
      strategyUsed = "Rule-based engine";
    }

    results.push(output);
    process.stdout.write(
      `  [${strategyUsed}] ${txRef} → severity: ${output.diagnosis.severity}\n`
    );
  }

  return results;
}
