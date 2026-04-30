import { lookupLEI } from "../lei-lookup.js";
import { loadLEIRecords } from "../../parsers/csv-loader.js";
import assert from "node:assert";

const leis = loadLEIRecords();

const lapsed = lookupLEI("213800FERQ5LE3H0XU88", leis);
assert.ok(lapsed, "Expected to find Goldman LEI");
assert.strictEqual(lapsed.status, "LAPSED");
assert.strictEqual(lapsed.isExpired, true);
assert.strictEqual(lapsed.isRenewable, true);

const annulled = lookupLEI("5299000J2N45DDNE4Y28", leis);
assert.ok(annulled, "Expected to find BlackRock LEI");
assert.strictEqual(annulled.status, "ANNULLED");
assert.strictEqual(annulled.isExpired, true);
assert.strictEqual(annulled.isRenewable, false);

const active = lookupLEI("2138007LIVELEI55662", leis);
assert.ok(active, "Expected to find active NatWest LEI");
assert.strictEqual(active.status, "ACTIVE");
assert.strictEqual(active.isExpired, false);

const notFound = lookupLEI("DOESNOTEXIST12345678", leis);
assert.strictEqual(notFound, null);

console.log("lei-lookup: all tests passed");
