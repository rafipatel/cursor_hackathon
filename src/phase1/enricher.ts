import type {
  RejectionRecord,
  EnrichedRejection,
  MifirReport,
  FxallTradeRecord,
  RelationshipRecord,
  GleifLeiRecord,
} from "../types/index.js";
import {
  loadMifirReports,
  loadFxallTrades,
  loadRelationships,
  loadGleifSnapshot,
} from "../data/loader.js";

// Load once at module init — these are static reference datasets
const mifirReports = loadMifirReports();
const fxallTrades = loadFxallTrades();
const relationships = loadRelationships();
const gleifSnapshot = loadGleifSnapshot();

function findMifirReport(txRef: string, clientRef: string): MifirReport | null {
  return (
    mifirReports.find(
      (r) =>
        r.transaction_reference_number === txRef ||
        r.client_reference === clientRef
    ) ?? null
  );
}

function findFxallTrade(venueId: string, clientRef: string): FxallTradeRecord | null {
  return (
    fxallTrades.find(
      (r) =>
        r.venue_transaction_id === venueId ||
        r.client_reference === clientRef
    ) ?? null
  );
}

function findRelationship(clientRef: string): RelationshipRecord | null {
  return relationships.find((r) => r.client_reference === clientRef) ?? null;
}

function findLei(lei: string): GleifLeiRecord | null {
  return gleifSnapshot.find((r) => r.lei === lei) ?? null;
}

export function enrichRejections(
  rejections: RejectionRecord[]
): EnrichedRejection[] {
  return rejections.map((rejection) => {
    const mifir = findMifirReport(
      rejection.transaction_ref,
      rejection.client_reference
    );
    const fxall = mifir
      ? findFxallTrade(mifir.venue_transaction_id, mifir.client_reference)
      : findFxallTrade("", rejection.client_reference);

    const clientRef =
      rejection.client_reference ||
      mifir?.client_reference ||
      fxall?.client_reference ||
      "";

    const relationship = findRelationship(clientRef);
    const buyerLei = mifir ? findLei(mifir.buyer_lei) : null;
    const sellerLei = mifir ? findLei(mifir.seller_lei) : null;

    return {
      rejection,
      mifir_report: mifir,
      fxall_trade: fxall,
      relationship,
      buyer_lei_info: buyerLei,
      seller_lei_info: sellerLei,
    };
  });
}
