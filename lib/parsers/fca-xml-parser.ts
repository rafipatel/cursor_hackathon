import { XMLParser } from "fast-xml-parser";
import type { FCAFeedbackRecord } from "../types.js";

const parser = new XMLParser({
  ignoreAttributes: false,
  trimValues: true,
});

export function parseFCAFeedbackXML(xml: string): FCAFeedbackRecord[] {
  const parsed = parser.parse(xml);

  const transactions =
    parsed?.RegulatoryFeedback?.RejectedTransactions?.Transaction;

  if (!transactions) return [];

  const txArray = Array.isArray(transactions) ? transactions : [transactions];

  return txArray.map((tx: Record<string, string>) => ({
    transactionReferenceNumber: tx.ReferenceNumber,
    errorCode: tx.RejectCode,
    errorDescription: tx.RejectReason,
    rejectedField: tx.Field,
    rejectedValue: tx.SubmittedValue,
    clientReference: tx.ClientReference,
  }));
}
