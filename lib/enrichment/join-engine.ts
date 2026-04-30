import type {
  FCAFeedbackRecord,
  SubmittedReport,
  TradeRegistryEntry,
  RelationshipManager,
  LEIRecord,
  EnrichedRejection,
} from "../types.js";
import { lookupLEI } from "./lei-lookup.js";

export function enrichRejections(
  rejections: FCAFeedbackRecord[],
  reports: SubmittedReport[],
  trades: TradeRegistryEntry[],
  rms: RelationshipManager[],
  leis: LEIRecord[]
): EnrichedRejection[] {
  const reportMap = new Map(reports.map((r) => [r.transactionReferenceNumber, r]));
  const tradeMap = new Map(trades.map((t) => [t.venueTransactionId, t]));
  const rmMap = new Map(rms.map((rm) => [rm.clientReference, rm]));

  return rejections.map((rejection) => {
    const report = reportMap.get(rejection.transactionReferenceNumber) ?? null;
    const trade = report ? tradeMap.get(report.venueTransactionId) ?? null : null;
    const rm = trade
      ? rmMap.get(trade.clientReference) ?? null
      : rmMap.get(rejection.clientReference) ?? null;
    const leiResult = lookupLEI(rejection.rejectedValue, leis);

    return {
      fcaFeedback: rejection,
      submittedReport: report,
      tradeRegistry: trade,
      relationshipManager: rm,
      leiLookup: leiResult,
    };
  });
}
