import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { parseFcaXml } from "./phase1/parser.js";
import { enrichRejections } from "./phase1/enricher.js";
import { runAgentPhase } from "./phase2/agent.js";
import type { EnrichedRejection, AgentOutput } from "./types/index.js";

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), "../data");

function printEnrichedSummary(enriched: EnrichedRejection[]): void {
  console.log("\n=== PHASE 1 COMPLETE: Enriched Rejections ===\n");
  for (const e of enriched) {
    console.log(`Transaction: ${e.rejection.transaction_ref}`);
    console.log(`  Error: ${e.rejection.error_code} | Field: ${e.rejection.field}`);
    console.log(`  Submitted value: ${e.rejection.submitted_value}`);
    console.log(`  MiFIR report found: ${e.mifir_report ? "YES" : "NO"}`);
    console.log(`  FXall trade found: ${e.fxall_trade ? "YES" : "NO"}`);
    console.log(`  RM: ${e.relationship ? `${e.relationship.rm_name} <${e.relationship.rm_email}>` : "NOT FOUND"}`);
    console.log(`  Buyer LEI status: ${e.buyer_lei_info?.lei_status ?? "NOT IN GLEIF"}`);
    console.log(`  Seller LEI status: ${e.seller_lei_info?.lei_status ?? "NOT IN GLEIF"}`);
    console.log();
  }
}

function printAgentOutputs(outputs: AgentOutput[]): void {
  console.log("\n=== PHASE 2 COMPLETE: Agent Diagnoses & Notifications ===\n");
  for (const output of outputs) {
    const { diagnosis, notification } = output;
    console.log(`━━━ ${diagnosis.transaction_ref} ━━━`);
    console.log(`Severity:    ${diagnosis.severity.toUpperCase()}`);
    console.log(`Error code:  ${diagnosis.error_code}`);
    console.log(`Root cause:  ${diagnosis.root_cause}`);
    console.log(`Fix:         ${diagnosis.recommended_fix}`);
    console.log(`Owner:       ${diagnosis.action_owner}`);

    if (notification) {
      console.log(`\n  RM Notification:`);
      console.log(`    To:       ${notification.to_name} <${notification.to_email}>`);
      console.log(`    Client:   ${notification.client_name}`);
      console.log(`    Subject:  ${notification.subject}`);
      console.log(`    Deadline: ${notification.deadline}`);
    } else {
      console.log(`  [No RM notification]`);
    }
    console.log();
  }
}

async function main(): Promise<void> {
  const cursorApiKey = process.env.CURSOR_API_KEY;
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

  console.log("FCA MiFIR Rejection Pipeline");
  console.log("============================");
  console.log(`Cursor SDK:  ${cursorApiKey ? "key present" : "not configured"}`);
  console.log(`Anthropic:   ${anthropicApiKey ? "key present" : "not configured"}`);
  console.log();

  const xmlPath = join(DATA_DIR, "fca_feedback_rejected_transactions.xml");
  const xmlContent = readFileSync(xmlPath, "utf-8");

  console.log("Phase 1: Parsing FCA XML...");
  const rejections = parseFcaXml(xmlContent);
  console.log(`  Parsed ${rejections.length} rejections`);

  console.log("Phase 1: Enriching rejections...");
  const enriched = enrichRejections(rejections);
  printEnrichedSummary(enriched);

  console.log("Phase 2: Running agent...\n");
  const outputs = await runAgentPhase(enriched, { cursorApiKey, anthropicApiKey });
  printAgentOutputs(outputs);

  console.log("Pipeline complete.");
}

main().catch((err: unknown) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
