import type { VercelRequest, VercelResponse } from "@vercel/node";
import { parseFCAFeedbackXML } from "../lib/parsers/fca-xml-parser.js";
import {
  loadFCARejections,
  loadSubmittedReports,
  loadTradeRegistry,
  loadRelationshipManagers,
  loadLEIRecords,
} from "../lib/parsers/csv-loader.js";
import { enrichRejections } from "../lib/enrichment/join-engine.js";
import { runAnalysis } from "../lib/agent/orchestrator.js";

const analysisCache = new Map<string, unknown>();

export { analysisCache };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const xml = typeof req.body === "string" ? req.body : req.body?.xml;
    const useAgent = req.body?.useAgent === true;

    const rejections = xml
      ? parseFCAFeedbackXML(xml)
      : loadFCARejections();

    if (rejections.length === 0) {
      return res.status(400).json({ error: "No rejected transactions found" });
    }

    const reports = loadSubmittedReports();
    const trades = loadTradeRegistry();
    const rms = loadRelationshipManagers();
    const leis = loadLEIRecords();

    const enriched = enrichRejections(rejections, reports, trades, rms, leis);
    const result = await runAnalysis(enriched, { forceAgent: useAgent });

    analysisCache.set(result.id, result);

    return res.status(200).json(result);
  } catch (err) {
    console.error("Analysis error:", err);
    return res.status(500).json({
      error: "Analysis failed",
      message: err instanceof Error ? err.message : String(err),
    });
  }
}
