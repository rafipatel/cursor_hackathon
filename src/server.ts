import express from "express";
import cors from "cors";
import multer from "multer";
import { randomUUID } from "crypto";
import { parseFcaXml } from "./phase1/parser.js";
import { enrichRejections } from "./phase1/enricher.js";
import { runAgentPhase } from "./phase2/agent.js";
import type { PipelineResponse } from "./types/index.js";

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.post("/api/analyze", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded. Send a multipart/form-data request with field name 'file'." });
      return;
    }

    const xmlContent = req.file.buffer.toString("utf-8");

    // Phase 1: deterministic enrichment
    const rejections = parseFcaXml(xmlContent);
    if (rejections.length === 0) {
      res.status(422).json({ error: "No rejection records found in the uploaded XML." });
      return;
    }

    const enriched = enrichRejections(rejections);

    // Phase 2: agent (Cursor SDK → Anthropic → rule engine)
    const agentOutputs = await runAgentPhase(enriched, {
      cursorApiKey: process.env.CURSOR_API_KEY,
      anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    });

    const response: PipelineResponse = {
      batch_id: randomUUID(),
      processed_at: new Date().toISOString(),
      total: enriched.length,
      results: enriched.map((e, i) => ({
        transaction_ref: e.rejection.transaction_ref,
        enriched: e,
        agent: agentOutputs[i]!,
      })),
    };

    res.json(response);
  } catch (err: unknown) {
    console.error("Pipeline error:", err);
    res.status(500).json({
      error: "Pipeline failed",
      detail: err instanceof Error ? err.message : String(err),
    });
  }
});

const PORT = process.env.PORT ?? 3001;
app.listen(PORT, () => {
  console.log(`FCA pipeline API running on http://localhost:${PORT}`);
  console.log(`  POST /api/analyze  — upload FCA XML, get enriched rejections + diagnoses`);
});
