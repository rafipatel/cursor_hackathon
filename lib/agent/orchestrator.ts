import type { EnrichedRejection, AnalysisResult, RejectionResult } from "../types.js";
import { SYSTEM_PROMPT, buildUserPrompt } from "./prompts.js";
import { parseAgentResponse, buildRejectionResults, buildFallbackResults } from "./tools.js";

export async function runAnalysis(
  enrichedRejections: EnrichedRejection[]
): Promise<AnalysisResult> {
  const analysisId = `analysis-${Date.now()}`;
  const now = new Date().toISOString();

  let rejections: RejectionResult[];

  if (!process.env.CURSOR_API_KEY) {
    console.warn("CURSOR_API_KEY not set, using deterministic fallback");
    rejections = buildFallbackResults(enrichedRejections);
  } else {
    try {
      rejections = await runCursorAgent(enrichedRejections);
    } catch (err) {
      console.warn("Cursor SDK agent failed, using deterministic fallback:", err);
      rejections = buildFallbackResults(enrichedRejections);
    }
  }

  const summary = {
    total: rejections.length,
    critical: rejections.filter((r) => r.diagnosis.severity === "critical").length,
    warning: rejections.filter((r) => r.diagnosis.severity === "warning").length,
    info: rejections.filter((r) => r.diagnosis.severity === "info").length,
  };

  return {
    id: analysisId,
    createdAt: now,
    status: "complete",
    summary,
    rejections,
  };
}

async function runCursorAgent(
  enrichedRejections: EnrichedRejection[]
): Promise<RejectionResult[]> {
  const { Agent } = await import("@cursor/sdk");
  const prompt = `${SYSTEM_PROMPT}\n\n${buildUserPrompt(enrichedRejections)}`;

  const result = await Agent.prompt(prompt, {
    model: { id: "claude-3.5-sonnet" },
    name: "mifir-rejection-analyst",
  });

  if (result.status !== "finished" || !result.result) {
    throw new Error(`Agent run failed: status=${result.status}`);
  }

  const diagnoses = parseAgentResponse(result.result);
  return buildRejectionResults(enrichedRejections, diagnoses);
}
