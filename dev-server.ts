import { serve } from "bun";
import { readFileSync } from "fs";
import { resolve } from "path";
import { parseFCAFeedbackXML } from "./lib/parsers/fca-xml-parser.js";
import {
  loadFCARejections,
  loadSubmittedReports,
  loadTradeRegistry,
  loadRelationshipManagers,
  loadLEIRecords,
} from "./lib/parsers/csv-loader.js";
import { enrichRejections } from "./lib/enrichment/join-engine.js";
import { runAnalysis } from "./lib/agent/orchestrator.js";
import type { AnalysisResult, RejectionResult } from "./lib/types.js";

const analysisCache = new Map<string, AnalysisResult>();

serve({
  port: 3001,
  async fetch(req) {
    const url = new URL(req.url);
    const headers = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,POST,OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };

    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });

    if (url.pathname === "/api/analyze" && req.method === "POST") {
      try {
        const body = await req.json().catch(() => ({})) as { xml?: string; useAgent?: boolean };
        const xml = body.xml;
        const useAgent = body.useAgent === true;

        const rejections = xml
          ? parseFCAFeedbackXML(xml)
          : loadFCARejections();

        if (rejections.length === 0) return new Response(JSON.stringify({ error: "No rejected transactions found" }), { status: 400, headers });

        const reports = loadSubmittedReports();
        const trades = loadTradeRegistry();
        const rms = loadRelationshipManagers();
        const leis = loadLEIRecords();
        const enriched = enrichRejections(rejections, reports, trades, rms, leis);
        const result = await runAnalysis(enriched, { forceAgent: useAgent });

        analysisCache.set(result.id, result);
        return new Response(JSON.stringify(result), { status: 200, headers });
      } catch (err) {
        return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers });
      }
    }

    if (url.pathname === "/api/approve" && req.method === "POST") {
      try {
        const { analysisId, rejectionId, action } = await req.json() as { analysisId: string; rejectionId: string; action: string };
        const analysis = analysisCache.get(analysisId);
        if (!analysis) return new Response(JSON.stringify({ error: "Analysis not found" }), { status: 404, headers });

        const rejection = analysis.rejections.find((r: RejectionResult) => r.id === rejectionId);
        if (!rejection) return new Response(JSON.stringify({ error: "Rejection not found" }), { status: 404, headers });

        rejection.status = action as RejectionResult["status"];
        rejection.approvedAt = action === "approved" ? new Date().toISOString() : null;
        return new Response(JSON.stringify({ success: true, rejectionId, newStatus: rejection.status, approvedAt: rejection.approvedAt }), { status: 200, headers });
      } catch (err) {
        return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers });
      }
    }

    if (url.pathname === "/api/preview-data" && req.method === "GET") {
      try {
        const dataDir = resolve(process.cwd(), "data");
        const files = [
          "reg_feedback_rejects.csv",
          "submitted_mifir_reports.csv",
          "fxall_trade_registry.csv",
          "gleif_lei_snapshot.csv",
          "relationship_management_database.csv",
        ];
        const result = files.map((name) => ({
          name,
          content: readFileSync(resolve(dataDir, name), "utf-8"),
        }));
        return new Response(JSON.stringify(result), { status: 200, headers });
      } catch (err) {
        return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers });
      }
    }

    return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers });
  },
});

console.log("API dev server running on http://localhost:3001");
