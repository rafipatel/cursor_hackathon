import assert from "node:assert";
import {
  loadFCARejections,
  loadSubmittedReports,
  loadTradeRegistry,
  loadRelationshipManagers,
  loadLEIRecords,
} from "../../parsers/csv-loader.js";
import { enrichRejections } from "../../enrichment/join-engine.js";
import { runAnalysis } from "../orchestrator.js";

const rejections = loadFCARejections();
const reports = loadSubmittedReports();
const trades = loadTradeRegistry();
const rms = loadRelationshipManagers();
const leis = loadLEIRecords();
const enriched = enrichRejections(rejections, reports, trades, rms, leis);

const result = await runAnalysis(enriched);

assert.ok(result.id.startsWith("analysis-"), `Expected analysis ID prefix, got ${result.id}`);
assert.strictEqual(result.status, "complete");
assert.strictEqual(result.rejections.length, 3, `Expected 3 rejections, got ${result.rejections.length}`);

assert.strictEqual(result.summary.total, 3);
assert.ok(result.summary.critical >= 1, "Expected at least 1 critical rejection (annulled LEI)");
assert.ok(result.summary.warning >= 1, "Expected at least 1 warning rejection (lapsed LEI)");

for (const rej of result.rejections) {
  assert.ok(rej.id, "Rejection must have an id");
  assert.ok(rej.diagnosis.rootCause, "Diagnosis must have rootCause");
  assert.ok(["critical", "warning", "info"].includes(rej.diagnosis.severity), `Invalid severity: ${rej.diagnosis.severity}`);
  assert.ok(["client", "internal", "regulator"].includes(rej.diagnosis.actioner), `Invalid actioner: ${rej.diagnosis.actioner}`);
  assert.ok(rej.diagnosis.explanation, "Diagnosis must have explanation");
  assert.ok(rej.diagnosis.recommendedFix, "Diagnosis must have recommendedFix");
  assert.ok(rej.draftEmail.to, "Email must have recipient");
  assert.ok(rej.draftEmail.subject, "Email must have subject");
  assert.ok(rej.draftEmail.body.length > 50, "Email body should be substantive");
  assert.strictEqual(rej.status, "pending_approval");
}

const goldmanRejs = result.rejections.filter(
  (r) => r.enrichedRejection.fcaFeedback.rejectedValue === "213800FERQ5LE3H0XU88"
);
assert.strictEqual(goldmanRejs.length, 2, "Expected 2 Goldman (lapsed LEI) rejections");
for (const r of goldmanRejs) {
  assert.strictEqual(r.diagnosis.severity, "warning");
  assert.ok(r.draftEmail.to.includes("anita.cole"), `Expected Anita Cole email, got ${r.draftEmail.to}`);
}

const blackrockRej = result.rejections.find(
  (r) => r.enrichedRejection.fcaFeedback.rejectedValue === "5299000J2N45DDNE4Y28"
);
assert.ok(blackrockRej, "Expected BlackRock (annulled LEI) rejection");
assert.strictEqual(blackrockRej.diagnosis.severity, "critical");
assert.ok(blackrockRej.draftEmail.to.includes("david.lin"), `Expected David Lin email, got ${blackrockRej.draftEmail.to}`);

console.log("orchestrator integration test: all tests passed");
console.log(`  - ${result.rejections.length} rejections analyzed`);
console.log(`  - Summary: ${result.summary.critical} critical, ${result.summary.warning} warning, ${result.summary.info} info`);
