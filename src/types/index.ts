// ── Phase 1 input ─────────────────────────────────────────────────────────────

export interface RejectionRecord {
  transaction_ref: string;
  error_code: string;
  reject_reason: string;
  field: string;
  submitted_value: string;
  client_reference: string;
}

export interface MifirReport {
  transaction_reference_number: string;
  venue_transaction_id: string;
  buyer_lei: string;
  seller_lei: string;
  client_reference: string;
  trading_datetime: string;
}

export interface FxallTradeRecord {
  fxall_trade_id: string;
  venue_transaction_id: string;
  client_account_id: string;
  fund_id: string;
  client_reference: string;
  trade_date: string;
}

export interface RelationshipRecord {
  client_reference: string;
  client_account_id: string;
  rm_name: string;
  rm_email: string;
  rm_region: string;
  rm_timezone: string;
}

export interface GleifLeiRecord {
  lei: string;
  entity_legal_name: string;
  lei_status: "ACTIVE" | "LAPSED" | "ANNULLED" | string;
  registration_status: string;
  last_update_date: string;
  next_renewal_date: string;
}

// ── Phase 1 output ────────────────────────────────────────────────────────────

export interface EnrichedRejection {
  rejection: RejectionRecord;
  mifir_report: MifirReport | null;
  fxall_trade: FxallTradeRecord | null;
  relationship: RelationshipRecord | null;
  buyer_lei_info: GleifLeiRecord | null;
  seller_lei_info: GleifLeiRecord | null;
}

// ── Phase 2 output ────────────────────────────────────────────────────────────

export interface DiagnosisResult {
  transaction_ref: string;
  error_code: string;
  root_cause: string;
  severity: "critical" | "warning" | "info";
  recommended_fix: string;
  action_owner: string;
}

export interface RMNotification {
  to_email: string;
  to_name: string;
  client_name: string;
  subject: string;
  body: string;
  transaction_ref: string;
  deadline: string;
}

export interface AgentOutput {
  diagnosis: DiagnosisResult;
  notification: RMNotification | null;
}

// ── API response ──────────────────────────────────────────────────────────────

export interface PipelineResult {
  transaction_ref: string;
  enriched: EnrichedRejection;
  agent: AgentOutput;
}

export interface PipelineResponse {
  batch_id: string;
  processed_at: string;
  total: number;
  results: PipelineResult[];
}
