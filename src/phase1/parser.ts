import { XMLParser } from "fast-xml-parser";
import type { RejectionRecord } from "../types/index.js";

interface RawTransaction {
  ReferenceNumber: string | number;
  RejectCode: string | number;
  RejectReason?: string;
  Field: string;
  SubmittedValue: string | number;
  ClientReference?: string;
}

export function parseFcaXml(xmlContent: string): RejectionRecord[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    isArray: (name) => name === "Transaction",
  });

  const parsed = parser.parse(xmlContent) as {
    RegulatoryFeedback?: {
      RejectedTransactions?: {
        Transaction?: RawTransaction[];
      };
    };
  };

  const transactions =
    parsed.RegulatoryFeedback?.RejectedTransactions?.Transaction ?? [];

  return transactions.map((t) => ({
    transaction_ref: String(t.ReferenceNumber),
    error_code: String(t.RejectCode),
    reject_reason: String(t.RejectReason ?? ""),
    field: String(t.Field),
    submitted_value: String(t.SubmittedValue),
    client_reference: String(t.ClientReference ?? ""),
  }));
}
