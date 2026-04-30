import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const envPath = resolve(process.cwd(), ".env");
try {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {}

if (!process.env.CURSOR_API_KEY) { console.error("Missing CURSOR_API_KEY"); process.exit(1); }
if (!process.env.SPECTER_API_KEY) { console.error("Missing SPECTER_API_KEY"); process.exit(1); }

const { runAgent, extractJson } = await import("./cursor.js");
const { lookupCompany, computeImpact } = await import("./specter.js");
type SpecterSnapshot = Awaited<ReturnType<typeof lookupCompany>>;
type SpecterImpact = ReturnType<typeof computeImpact>;

const app = new Hono();
app.use("/*", cors());

const TRIAGE_PROMPT = `You are a MiFIR transaction-reporting reject-triage agent for a regulated FX trading desk (LSEG-FXALL submitting under MiFIR to the FCA).

You will receive several files: the trades submitted, the FCA's reject feedback, the GLEIF authoritative LEI snapshot, the internal trade registry, and the relationship-management database.

Your job: produce ONE JSON object with a "tickets" array, one entry per rejected transaction. Cross-reference the files. Use ONLY the data given — do not fabricate trades, LEIs, RMs, or clients.

Output JSON shape (no markdown, no prose, no code fences, JSON only):

{
  "tickets": [
    {
      "reject_id": "<FCA feedback id>",
      "trade_ref": "<TRN-... transaction_reference_number>",
      "reject_code": "<e.g. LEIV001>",
      "reject_reason": "<verbatim from feedback>",
      "field_name": "<e.g. BuyerIdentificationCode>",
      "bad_lei": "<the rejected LEI value>",
      "lei_status": "LAPSED" | "ANNULLED" | "ACTIVE" | "unknown",
      "client": { "reference": "<client_reference>", "account_id": "<client_account_id>", "parent_firm": "<plain-English firm name like 'Goldman Sachs'>" },
      "fund": { "id": "<fund_id>", "name": "<entity_legal_name from GLEIF or '... Fund NNN'>" },
      "rm": { "name": "...", "email": "...", "region": "..." } | null,
      "severity": "fail" | "warning" | "escalate",
      "confidence": <0.0-1.0>,
      "root_cause": "<one sentence narrative joining the reject + the GLEIF status + the date>",
      "recommended_action": "<imperative one-liner — e.g. 'Renew LEI 2138... before resubmission'>",
      "rm_email_draft": {
        "subject": "<short subject>",
        "body": "<3-6 short paragraphs, professional tone, addressed to the RM by first name; reference the trades by trade_ref; ask for LEI renewal evidence by a near-future date>"
      }
    }
  ]
}

Severity rules:
- "fail" when LEI status is LAPSED or ANNULLED (blocking — must be remediated before resubmission).
- "escalate" when RM is missing, LEI status is "unknown", or any required field cannot be confidently joined across the files. Set confidence < 0.7.
- "warning" for resolvable but non-blocking issues.

Confidence rules:
- 0.9+ when every field is unambiguously present and joins cleanly across all files.
- 0.7-0.9 when one minor field is inferred.
- < 0.7 when anything material is missing or ambiguous → severity must be "escalate".

Output JSON only.`;

interface FileInput { filename: string; mimeType?: string; text: string }

function buildContext(files: FileInput[]): string {
  return files
    .map((f) => `### ${f.filename}${f.mimeType ? ` (${f.mimeType})` : ""}\n${f.text.slice(0, 12000)}`)
    .join("\n\n");
}

interface Ticket {
  reject_id: string;
  trade_ref: string;
  reject_code: string;
  reject_reason: string;
  field_name: string;
  bad_lei: string;
  lei_status: "LAPSED" | "ANNULLED" | "ACTIVE" | "unknown";
  client: { reference: string; account_id: string; parent_firm: string };
  fund: { id: string; name: string };
  rm: { name: string; email: string; region: string } | null;
  severity: "fail" | "warning" | "escalate";
  confidence: number;
  root_cause: string;
  recommended_action: string;
  rm_email_draft: { subject: string; body: string };
  parent_firm_intel?: SpecterSnapshot;
  parent_firm_canonical?: { name?: string; domain?: string; organization_id?: string };
  specter_impact?: SpecterImpact;
  specter_reranked?: boolean;
  specter_escalated?: boolean;
}

function domainGuess(firm: string): string | undefined {
  const map: Record<string, string> = {
    "goldman sachs": "goldmansachs.com",
    "blackrock": "blackrock.com",
    "natwest": "natwest.com",
    "hsbc": "hsbc.com",
    "lseg": "lseg.com",
    "morgan stanley": "morganstanley.com",
    "jp morgan": "jpmorgan.com",
    "jpmorgan": "jpmorgan.com",
    "barclays": "barclays.com",
  };
  const k = firm.toLowerCase().trim();
  for (const [needle, dom] of Object.entries(map)) if (k.includes(needle)) return dom;
  return undefined;
}

async function runTriagePipeline(files: FileInput[]) {
  const tStart = Date.now();
  const context = buildContext(files);
  const prompt = `${TRIAGE_PROMPT}\n\n---FILES---\n${context}\n---END FILES---\n\nReturn the JSON now.`;

  let agentResult;
  agentResult = await runAgent(prompt);

  const parsed = extractJson<{ tickets?: Ticket[] }>(agentResult.text);
  if (!parsed?.tickets) {
    const fs = await import("node:fs");
    fs.writeFileSync("/tmp/triage-raw.txt", agentResult.text);
    console.error("no tickets parsed. wrote /tmp/triage-raw.txt, len:", agentResult.text.length);
    throw new Error(`parse_failed:${agentResult.text.length}`);
  }

  const tAgent = Date.now();
  const tickets = parsed.tickets;

  const uniqueFirms = Array.from(new Set(tickets.map((t) => t.client?.parent_firm).filter(Boolean)));
  const intelMap = new Map<string, SpecterSnapshot>();
  let specterUnavailable = false;
  await Promise.all(
    uniqueFirms.map(async (firm) => {
      try {
        const domain = domainGuess(firm);
        const snap = await lookupCompany(domain ? { domain } : { name: firm });
        if (snap) intelMap.set(firm, snap);
      } catch {
        specterUnavailable = true;
      }
    })
  );
  const tSpecter = Date.now();

  const SEVERITY_WEIGHT: Record<Ticket["severity"], number> = { fail: 0, escalate: 1, warning: 2 };
  const originalOrder = new Map(tickets.map((t, i) => [t.trade_ref, i]));

  for (const t of tickets) {
    const intel = intelMap.get(t.client?.parent_firm);
    if (intel) {
      t.parent_firm_intel = intel;
      t.parent_firm_canonical = {
        name: intel.organization_name ?? t.client?.parent_firm,
        domain: intel.domain,
        organization_id: intel.id,
      };
    }
    t.specter_impact = computeImpact(intel ?? null);

    if (!t.rm || t.lei_status === "unknown") {
      t.severity = "escalate";
      if (t.confidence > 0.7) t.confidence = 0.6;
    }

    if (
      t.severity !== "fail" &&
      t.confidence >= 0.65 &&
      t.confidence < 0.8 &&
      t.specter_impact.band === "high"
    ) {
      t.severity = "escalate";
      t.specter_escalated = true;
    }

    if (intel && t.rm) {
      const ctx = `Commercial context (Specter, last updated ${intel.last_updated ?? "n/a"}): ${t.specter_impact.signal}.`;
      if (!t.rm_email_draft.body.includes("Commercial context (Specter")) {
        const lines = t.rm_email_draft.body.split(/\n\n/);
        if (lines.length >= 2) lines.splice(1, 0, ctx);
        else lines.push(ctx);
        t.rm_email_draft.body = lines.join("\n\n");
      }
    }
  }

  tickets.sort((a, b) => {
    const sa = SEVERITY_WEIGHT[a.severity] - SEVERITY_WEIGHT[b.severity];
    if (sa !== 0) return sa;
    const ia = (b.specter_impact?.score ?? 0) - (a.specter_impact?.score ?? 0);
    if (ia !== 0) return ia;
    return b.confidence - a.confidence;
  });
  for (const t of tickets) {
    const beforeIdx = originalOrder.get(t.trade_ref);
    const afterIdx = tickets.indexOf(t);
    if (typeof beforeIdx === "number" && beforeIdx !== afterIdx) t.specter_reranked = true;
  }

  const highImpact = tickets.filter((t) => t.specter_impact?.band === "high").length;
  const reranked = tickets.filter((t) => t.specter_reranked).length;
  const policyEscalations = tickets.filter((t) => t.specter_escalated).length;

  const stats = {
    total: tickets.length,
    fail: tickets.filter((t) => t.severity === "fail").length,
    warning: tickets.filter((t) => t.severity === "warning").length,
    escalate: tickets.filter((t) => t.severity === "escalate").length,
    enriched: tickets.filter((t) => t.parent_firm_intel).length,
    high_impact: highImpact,
    reranked_by_specter: reranked,
    policy_escalations: policyEscalations,
  };

  console.log(
    `triage: ${tickets.length} tickets · agent ${agentResult.durationMs}ms · specter ${tSpecter - tAgent}ms · total ${Date.now() - tStart}ms · ${JSON.stringify(stats)}`
  );

  return {
    tickets,
    stats,
    durations: {
      agent_ms: agentResult.durationMs,
      specter_ms: tSpecter - tAgent,
      total_ms: Date.now() - tStart,
    },
    enrichment: {
      hit_rate: uniqueFirms.length === 0 ? 0 : intelMap.size / uniqueFirms.length,
      hits: intelMap.size,
      requested: uniqueFirms.length,
      unavailable: specterUnavailable,
    },
    model: "composer-2",
    generated_at: new Date().toISOString(),
  };
}

app.post("/triage", async (c) => {
  const body = await c.req.json<{ files: FileInput[] }>();
  if (!body.files?.length) return c.json({ error: "files[] required" }, 400);
  try {
    const result = await runTriagePipeline(body.files);
    return c.json(result);
  } catch (e) {
    const msg = String(e);
    if (msg.startsWith("Error: parse_failed:")) {
      const raw_len = Number(msg.replace("Error: parse_failed:", ""));
      return c.json({ error: "parse_failed", raw_len }, 502);
    }
    console.error("triage failed", e);
    return c.json({ error: "agent_failed", message: msg }, 502);
  }
});

app.post("/analyze", async (c) => {
  const body = await c.req.json<{ filename?: string; mimeType?: string; text?: string }>();
  if (!body?.text) return c.json({ error: "text required" }, 400);
  try {
    const result = await runTriagePipeline([
      {
        filename: body.filename ?? "input.txt",
        mimeType: body.mimeType ?? "text/plain",
        text: body.text,
      },
    ]);
    return c.json(result);
  } catch (e) {
    const msg = String(e);
    if (msg.startsWith("Error: parse_failed:")) {
      const raw_len = Number(msg.replace("Error: parse_failed:", ""));
      return c.json({ error: "parse_failed", raw_len }, 502);
    }
    console.error("analyze failed", e);
    return c.json({ error: "agent_failed", message: msg }, 502);
  }
});

app.get("/health", (c) => c.json({ ok: true }));

const port = Number(process.env.PORT ?? 8787);
serve({ fetch: app.fetch, port });
console.log(`mifir-triage backend on http://localhost:${port}`);
