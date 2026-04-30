import { parse } from "csv-parse/sync";
import { readFileSync } from "fs";
import { resolve } from "path";
import type {
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

export function loadSubmittedReports(): SubmittedReport[] {
  return loadCSV("submitted_mifir_reports.csv", (row) => ({
    transactionReferenceNumber: row.transaction_reference_number,
    venueTransactionId: row.venue_transaction_id,
    executingEntityIdCode: row.executing_entity_id_code,
    buyerIdentificationCode: row.buyer_identification_code,
    sellerIdentificationCode: row.seller_identification_code,
    instrumentIdentificationCode: row.instrument_identification_code,
    price: row.price,
    quantity: row.quantity,
    tradeDatetime: row.trade_datetime,
    venueIdentification: row.venue_identification,
    currency: row.currency,
  }));
}

export function loadTradeRegistry(): TradeRegistryEntry[] {
  return loadCSV("fxall_trade_registry.csv", (row) => ({
    venueTransactionId: row.venue_transaction_id,
    clientAccountId: row.client_account_id,
    clientReference: row.client_reference,
    tradeType: row.trade_type,
    instrumentType: row.instrument_type,
    executionVenue: row.execution_venue,
  }));
}

export function loadRelationshipManagers(): RelationshipManager[] {
  return loadCSV("relationship_management_database.csv", (row) => ({
    clientReference: row.client_reference,
    clientName: row.client_name,
    rmName: row.rm_name,
    rmEmail: row.rm_email,
    rmPhone: row.rm_phone,
    clientTier: row.client_tier,
    region: row.region,
  }));
}

export function loadLEIRecords(): LEIRecord[] {
  return loadCSV("gleif_lei_snapshot.csv", (row) => ({
    lei: row.lei,
    legalName: row.legal_name,
    status: row.status as LEIRecord["status"],
    initialRegistrationDate: row.initial_registration_date,
    lastUpdateDate: row.last_update_date,
    nextRenewalDate: row.next_renewal_date,
    managingLou: row.managing_lou,
    jurisdiction: row.jurisdiction,
  }));
}
