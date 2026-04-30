import { enrichRejections } from "../join-engine.js";
import {
  loadFCARejections,
  loadSubmittedReports,
  loadTradeRegistry,
  loadRelationshipManagers,
  loadLEIRecords,
} from "../../parsers/csv-loader.js";
import assert from "node:assert";

const rejections = loadFCARejections();
const reports = loadSubmittedReports();
const trades = loadTradeRegistry();
const rms = loadRelationshipManagers();
const leis = loadLEIRecords();

const enriched = enrichRejections(rejections, reports, trades, rms, leis);

assert.strictEqual(enriched.length, 3, `Expected 3 enriched rejections, got ${enriched.length}`);

const first = enriched[0];
assert.ok(first.submittedReport, "First rejection should have a submitted report");
assert.ok(first.tradeRegistry, "First rejection should have trade registry data");
assert.ok(first.relationshipManager, "First rejection should have RM data");
assert.ok(first.leiLookup, "First rejection should have LEI lookup data");
assert.strictEqual(first.leiLookup?.status, "LAPSED");
assert.strictEqual(first.relationshipManager?.rmName, "Anita Cole");

const third = enriched[2];
assert.ok(third.leiLookup, "Third rejection should have LEI lookup data");
assert.strictEqual(third.leiLookup?.status, "ANNULLED");
assert.strictEqual(third.relationshipManager?.rmName, "David Lin");

console.log("join-engine: all tests passed");
