import { parse } from "csv-parse/sync";
import { readFileSync } from "fs";
import { resolve } from "path";
import type {
  FCAFeedbackRecord,
  SubmittedReport,
  TradeRegistryEntry,
  RelationshipManager,
  LEIRecord,
} from "../types.js";

function loadCSV<T>(filename: string, mapFn: (row: Record<string, string>) => T): T[] {
  const filepath = resolve(process.cwd(), "data", filename);
  const content = readFileSync(filepath, "utf-8");
  const records = parse(content, { columns: true, skip_empty_lines: true }) as Record<string, string>[];
  return records.map(mapFn);
}

export function loadFCARejections(): FCAFeedbackRecord[] {
  return loadCSV("reg_feedback_rejects.csv", (row) => ({
    transactionReferenceNumber: row.transaction_reference_number,
    errorCode: row.reject_code,
    errorDescription: row.reject_reason,
    rejectedField: row.field_name,
    rejectedValue: row.submitted_value,
    clientReference: row.client_reference,
  }));
}

export function loadSubmittedReports(): SubmittedReport[] {
  return loadCSV("submitted_mifir_reports.csv", (row) => ({
    transactionReferenceNumber: row.transaction_reference_number,
    venueTransactionId: row.venue_transaction_id,
    buyerIdentificationCode: row.buyer_identification_code,
    sellerIdentificationCode: row.seller_identification_code,
    clientReference: row.client_reference,
    tradingDatetime: row.trading_datetime,
  }));
}

export function loadTradeRegistry(): TradeRegistryEntry[] {
  return loadCSV("fxall_trade_registry.csv", (row) => ({
    fxallTradeId: row.fxall_trade_id,
    venueTransactionId: row.venue_transaction_id,
    clientAccountId: row.client_account_id,
    fundId: row.fund_id,
    clientReference: row.client_reference,
    tradeDate: row.trade_date,
  }));
}

export function loadRelationshipManagers(): RelationshipManager[] {
  return loadCSV("relationship_management_database.csv", (row) => ({
    clientReference: row.client_reference,
    clientAccountId: row.client_account_id,
    rmName: row.rm_name,
    rmEmail: row.rm_email,
    rmRegion: row.rm_region,
    rmTimezone: row.rm_timezone,
  }));
}

export function loadLEIRecords(): LEIRecord[] {
  return loadCSV("gleif_lei_snapshot.csv", (row) => ({
    lei: row.lei,
    legalName: row.entity_legal_name,
    status: row.lei_status as LEIRecord["status"],
    registrationStatus: row.registration_status,
    lastUpdateDate: row.last_update_date,
    nextRenewalDate: row.next_renewal_date,
  }));
}
