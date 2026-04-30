import type { LEIRecord, LEILookupResult } from "../types.js";

export function lookupLEI(lei: string, records: LEIRecord[]): LEILookupResult | null {
  const record = records.find((r) => r.lei === lei);
  if (!record) return null;

  const now = new Date();
  const renewalDate = new Date(record.nextRenewalDate);
  const isExpired = record.status !== "ACTIVE" || renewalDate < now;
  const isRenewable = record.status === "LAPSED";

  return {
    lei: record.lei,
    legalName: record.legalName,
    status: record.status,
    nextRenewalDate: record.nextRenewalDate,
    isExpired,
    isRenewable,
  };
}
