import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { parse } from "csv-parse/sync";
import type {
  MifirReport,
  FxallTradeRecord,
  RelationshipRecord,
  GleifLeiRecord,
} from "../types/index.js";

const DATA_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../data"
);

function loadCsv<T>(filename: string): T[] {
  const content = readFileSync(join(DATA_DIR, filename), "utf-8");
  return parse(content, { columns: true, skip_empty_lines: true }) as T[];
}

interface RawMifirRow {
  transaction_reference_number: string;
  venue_transaction_id: string;
  buyer_identification_code: string;
  seller_identification_code: string;
  client_reference: string;
  trading_datetime: string;
}

interface RawFxallRow {
  fxall_trade_id: string;
  venue_transaction_id: string;
  client_account_id: string;
  fund_id: string;
  client_reference: string;
  trade_date: string;
}

interface RawRelRow {
  client_reference: string;
  client_account_id: string;
  rm_name: string;
  rm_email: string;
  rm_region: string;
  rm_timezone: string;
}

interface RawGleifRow {
  lei: string;
  entity_legal_name: string;
  lei_status: string;
  registration_status: string;
  last_update_date: string;
  next_renewal_date: string;
}

export function loadMifirReports(): MifirReport[] {
  return loadCsv<RawMifirRow>("submitted_mifir_reports.csv").map((r) => ({
    transaction_reference_number: r.transaction_reference_number,
    venue_transaction_id: r.venue_transaction_id,
    buyer_lei: r.buyer_identification_code,
    seller_lei: r.seller_identification_code,
    client_reference: r.client_reference,
    trading_datetime: r.trading_datetime,
  }));
}

export function loadFxallTrades(): FxallTradeRecord[] {
  return loadCsv<RawFxallRow>("fxall_trade_registry.csv").map((r) => ({
    fxall_trade_id: r.fxall_trade_id,
    venue_transaction_id: r.venue_transaction_id,
    client_account_id: r.client_account_id,
    fund_id: r.fund_id,
    client_reference: r.client_reference,
    trade_date: r.trade_date,
  }));
}

export function loadRelationships(): RelationshipRecord[] {
  return loadCsv<RawRelRow>("relationship_management_database.csv").map((r) => ({
    client_reference: r.client_reference,
    client_account_id: r.client_account_id,
    rm_name: r.rm_name,
    rm_email: r.rm_email,
    rm_region: r.rm_region,
    rm_timezone: r.rm_timezone,
  }));
}

export function loadGleifSnapshot(): GleifLeiRecord[] {
  return loadCsv<RawGleifRow>("gleif_lei_snapshot.csv").map((r) => ({
    lei: r.lei,
    entity_legal_name: r.entity_legal_name,
    lei_status: r.lei_status,
    registration_status: r.registration_status,
    last_update_date: r.last_update_date,
    next_renewal_date: r.next_renewal_date,
  }));
}
