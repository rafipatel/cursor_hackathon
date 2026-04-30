import {
  loadSubmittedReports,
  loadTradeRegistry,
  loadRelationshipManagers,
  loadLEIRecords,
} from "../csv-loader.js";
import assert from "node:assert";

const reports = loadSubmittedReports();
assert.ok(reports.length >= 3, `Expected >= 3 reports, got ${reports.length}`);
assert.ok(reports[0].transactionReferenceNumber.startsWith("FXALL-"));
assert.ok(reports[0].venueTransactionId);

const trades = loadTradeRegistry();
assert.ok(trades.length >= 3, `Expected >= 3 trades, got ${trades.length}`);
assert.ok(trades[0].venueTransactionId);
assert.ok(trades[0].clientReference);

const rms = loadRelationshipManagers();
assert.ok(rms.length >= 3, `Expected >= 3 RMs, got ${rms.length}`);
assert.ok(rms[0].rmEmail.includes("@"));

const leis = loadLEIRecords();
assert.ok(leis.length >= 4, `Expected >= 4 LEIs, got ${leis.length}`);
const lapsed = leis.find((l) => l.status === "LAPSED");
assert.ok(lapsed, "Expected at least one LAPSED LEI");
const annulled = leis.find((l) => l.status === "ANNULLED");
assert.ok(annulled, "Expected at least one ANNULLED LEI");

console.log("csv-loader: all tests passed");
