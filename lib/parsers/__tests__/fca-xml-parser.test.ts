import { parseFCAFeedbackXML } from "../fca-xml-parser.js";
import { readFileSync } from "fs";
import { resolve } from "path";
import assert from "node:assert";

const xml = readFileSync(
  resolve(process.cwd(), "data", "fca_feedback_rejected_transactions.xml"),
  "utf-8"
);

const records = parseFCAFeedbackXML(xml);

assert.strictEqual(records.length, 3, `Expected 3 rejections, got ${records.length}`);
assert.strictEqual(records[0].transactionReferenceNumber, "TRN-2026-00123456");
assert.strictEqual(records[0].errorCode, "LEIV001");
assert.strictEqual(records[0].rejectedField, "BuyerIdentificationCode");
assert.strictEqual(records[0].rejectedValue, "213800FERQ5LE3H0XU88");
assert.strictEqual(records[0].clientReference, "GOLDMANSAX-FUND-042");

assert.strictEqual(records[2].errorCode, "LEIV002");
assert.strictEqual(records[2].rejectedValue, "5299000J2N45DDNE4Y28");
assert.strictEqual(records[2].clientReference, "BLACKROCK-FUND-017");

console.log("fca-xml-parser: all tests passed");
