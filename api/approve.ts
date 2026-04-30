import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { AnalysisResult, RejectionResult } from "../lib/types.js";

const analysisCache = new Map<string, AnalysisResult>();

export { analysisCache };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { analysisId, rejectionId, action } = req.body as {
    analysisId: string;
    rejectionId: string;
    action: "approved" | "rejected" | "escalated";
  };

  if (!analysisId || !rejectionId || !action) {
    return res.status(400).json({ error: "Missing analysisId, rejectionId, or action" });
  }

  const analysis = analysisCache.get(analysisId);
  if (!analysis) {
    return res.status(404).json({ error: "Analysis not found" });
  }

  const rejection = analysis.rejections.find((r: RejectionResult) => r.id === rejectionId);
  if (!rejection) {
    return res.status(404).json({ error: "Rejection not found" });
  }

  rejection.status = action;
  rejection.approvedAt = action === "approved" ? new Date().toISOString() : null;

  return res.status(200).json({
    success: true,
    rejectionId,
    newStatus: rejection.status,
    approvedAt: rejection.approvedAt,
  });
}
