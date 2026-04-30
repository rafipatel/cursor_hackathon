# Transaction Rejection Remediation Engine — Spec

## Overview
AI-powered pipeline that ingests FCA regulatory feedback (rejected MiFIR transaction reports), enriches rejections with reference data, uses a Cursor SDK agent to diagnose root causes and draft RM notifications, and presents results for human approval.

**Stack:** Vite React frontend, TypeScript backend (Vercel serverless functions), Cursor SDK agent, pre-loaded CSV reference data.

**Pipeline:** Upload FCA XML → Parse & Enrich (deterministic) → Diagnose & Notify (Cursor SDK agent) → Display results with approval gate (frontend).

---

## T1 — Project Scaffolding
**Description:** Set up the backend project structure, dependencies, data files, and shared types.

### T1.1 — Backend Infrastructure
**Description:** Root package.json, TypeScript config, Vercel config, and shared types.

#### T1.1.1 — Root Config & Dependencies
**Description:** Create root `package.json` with workspace config, `tsconfig.json`, `vercel.json` routing Vite frontend + API functions. Install `@cursor/sdk`, `fast-xml-parser`, `csv-parse`.

**Verify:**

```bash
# tier1_build
cd /Users/richardlao/Documents/Github/Personal/cursor_hackathon && cat package.json | grep -q "cursor" && cat vercel.json | grep -q "api" && echo "PASS"
```

```bash
# tier2_simplify
echo "SKIP — config only"
```

```bash
# tier3_unit
echo "SKIP — config only"
```

```bash
# tier4_integration
echo "SKIP — config only"
```

#### T1.1.2 — Shared TypeScript Types
**Description:** Create `lib/types.ts` with interfaces for: `FCAFeedbackRecord`, `SubmittedReport`, `TradeRegistryEntry`, `RelationshipManager`, `LEIRecord`, `EnrichedRejection`, `DiagnosisResult`, `DraftEmail`, `AnalysisResult`.

**Verify:**

```bash
# tier1_build
cd /Users/richardlao/Documents/Github/Personal/cursor_hackathon && npx tsc --noEmit lib/types.ts 2>&1 | tail -5
```

```bash
# tier2_simplify
echo "SKIP — types only"
```

```bash
# tier3_unit
echo "SKIP — types only"
```

```bash
# tier4_integration
echo "SKIP — types only"
```

#### T1.1.3 — Sample Data Files
**Description:** Create all 6 data files in `data/` matching the schema from the brainstorming session: `fca_feedback_rejected_transactions.xml`, `submitted_mifir_reports.csv`, `gleif_lei_snapshot.csv`, `fxall_trade_registry.csv`, `relationship_management_database.csv`, `reg_feedback_rejects.csv`.

**Verify:**

```bash
# tier1_build
cd /Users/richardlao/Documents/Github/Personal/cursor_hackathon && ls data/*.csv data/*.xml | wc -l | grep -q "6" && echo "PASS"
```

```bash
# tier2_simplify
echo "SKIP — data files"
```

```bash
# tier3_unit
echo "SKIP — data files"
```

```bash
# tier4_integration
echo "SKIP — data files"
```

---

## T2 — Deterministic Pipeline (Phase 1)
**Description:** TypeScript services that parse FCA XML, load CSV reference data, and join everything into enriched rejection objects.

### T2.1 — Parsers
**Description:** Parse incoming FCA XML and load CSV reference files.

#### T2.1.1 — FCA XML Parser
**Description:** `lib/parsers/fca-xml-parser.ts` — takes raw XML string, returns `FCAFeedbackRecord[]`. Uses `fast-xml-parser`. Extracts: transaction reference, error code, error description, rejected field, rejected value.

**Verify:**

```bash
# tier1_build
cd /Users/richardlao/Documents/Github/Personal/cursor_hackathon && npx tsc --noEmit lib/parsers/fca-xml-parser.ts
```

```bash
# tier2_simplify
echo "SKIP"
```

```bash
# tier3_unit
cd /Users/richardlao/Documents/Github/Personal/cursor_hackathon && npx tsx lib/parsers/__tests__/fca-xml-parser.test.ts
```

```bash
# tier4_integration
echo "SKIP — no integration surface"
```

#### T2.1.2 — CSV Loader
**Description:** `lib/parsers/csv-loader.ts` — generic CSV parser + specific loaders for each reference file. Returns typed arrays (`SubmittedReport[]`, `TradeRegistryEntry[]`, `RelationshipManager[]`, `LEIRecord[]`).

**Verify:**

```bash
# tier1_build
cd /Users/richardlao/Documents/Github/Personal/cursor_hackathon && npx tsc --noEmit lib/parsers/csv-loader.ts
```

```bash
# tier2_simplify
echo "SKIP"
```

```bash
# tier3_unit
cd /Users/richardlao/Documents/Github/Personal/cursor_hackathon && npx tsx lib/parsers/__tests__/csv-loader.test.ts
```

```bash
# tier4_integration
echo "SKIP — no integration surface"
```

### T2.2 — Enrichment Engine
**Description:** Join parsed rejections against reference data to produce fully enriched rejection objects.

#### T2.2.1 — Join Engine
**Description:** `lib/enrichment/join-engine.ts` — takes `FCAFeedbackRecord[]` + all reference data, performs the multi-table join: rejection → submitted report (on transaction_ref) → trade registry (on venue_transaction_id) → RM database (on client_reference). Returns `EnrichedRejection[]`.

**Verify:**

```bash
# tier1_build
cd /Users/richardlao/Documents/Github/Personal/cursor_hackathon && npx tsc --noEmit lib/enrichment/join-engine.ts
```

```bash
# tier2_simplify
echo "SKIP"
```

```bash
# tier3_unit
cd /Users/richardlao/Documents/Github/Personal/cursor_hackathon && npx tsx lib/enrichment/__tests__/join-engine.test.ts
```

```bash
# tier4_integration
echo "SKIP"
```

#### T2.2.2 — LEI Lookup
**Description:** `lib/enrichment/lei-lookup.ts` — takes an LEI string + `LEIRecord[]`, returns the GLEIF status (ACTIVE/LAPSED/ANNULLED), expiry date, managing LOU, and whether it's renewable.

**Verify:**

```bash
# tier1_build
cd /Users/richardlao/Documents/Github/Personal/cursor_hackathon && npx tsc --noEmit lib/enrichment/lei-lookup.ts
```

```bash
# tier2_simplify
echo "SKIP"
```

```bash
# tier3_unit
cd /Users/richardlao/Documents/Github/Personal/cursor_hackathon && npx tsx lib/enrichment/__tests__/lei-lookup.test.ts
```

```bash
# tier4_integration
echo "SKIP"
```

---

## T3 — Agent Layer (Phase 2)
**Description:** Cursor SDK agent that receives enriched rejections and uses tools to diagnose root causes and draft RM notification emails.

### T3.1 — Cursor SDK Agent
**Description:** Set up the agent with tools and prompts.

#### T3.1.1 — Agent Orchestrator & Tools
**Description:** `lib/agent/orchestrator.ts` — creates the Cursor SDK agent with two tools: `diagnoseRejection` (interprets error code + LEI status → plain-English root cause, severity, recommended fix) and `draftRMNotification` (composes email to RM with what failed, why, deadline, client action needed). `lib/agent/tools.ts` — tool implementations. `lib/agent/prompts.ts` — system prompt briefing the agent as a regulatory compliance specialist.

**Verify:**

```bash
# tier1_build
cd /Users/richardlao/Documents/Github/Personal/cursor_hackathon && npx tsc --noEmit lib/agent/orchestrator.ts lib/agent/tools.ts lib/agent/prompts.ts
```

```bash
# tier2_simplify
echo "SKIP"
```

```bash
# tier3_unit
echo "SKIP — agent tested via integration"
```

```bash
# tier4_integration
cd /Users/richardlao/Documents/Github/Personal/cursor_hackathon && npx tsx lib/agent/__tests__/orchestrator.test.ts
```

---

## T4 — API Layer
**Description:** Vercel serverless functions that expose the pipeline to the frontend.

### T4.1 — Vercel Functions
**Description:** Three API endpoints for the frontend.

#### T4.1.1 — Analyze Endpoint
**Description:** `api/analyze.ts` — POST endpoint. Receives FCA feedback XML (multipart form data or raw body). Runs Phase 1 (parse + enrich), then Phase 2 (Cursor SDK agent). Returns full `AnalysisResult` with rejections, diagnoses, draft emails, and pending approval status.

**Verify:**

```bash
# tier1_build
cd /Users/richardlao/Documents/Github/Personal/cursor_hackathon && npx tsc --noEmit api/analyze.ts
```

```bash
# tier2_simplify
echo "SKIP"
```

```bash
# tier3_unit
echo "SKIP — tested via integration"
```

```bash
# tier4_integration
echo "SKIP — requires running Vercel dev server"
```

#### T4.1.2 — Results & Approve Endpoints
**Description:** `api/results.ts` — GET endpoint, returns cached analysis results by ID. `api/approve.ts` — POST endpoint, marks a rejection as approved/rejected, logs audit entry.

**Verify:**

```bash
# tier1_build
cd /Users/richardlao/Documents/Github/Personal/cursor_hackathon && npx tsc --noEmit api/results.ts api/approve.ts
```

```bash
# tier2_simplify
echo "SKIP"
```

```bash
# tier3_unit
echo "SKIP"
```

```bash
# tier4_integration
echo "SKIP"
```

---

## T5 — Frontend Adaptation
**Description:** Adapt the existing DocumentAnalyzer component to display rejection pipeline results instead of generic compliance scores.

### T5.1 — Results UI
**Description:** Update the frontend to show rejection-specific results.

#### T5.1.1 — Rejection Results View
**Description:** Adapt `DocumentAnalyzer.tsx` to: call `POST /api/analyze` on file upload (or demo button), display rejection cards with client name, transaction ref, severity badge, root cause summary. Keep the existing upload zone and demo button flow.

**Verify:**

```bash
# tier1_build
cd /Users/richardlao/Documents/Github/Personal/cursor_hackathon/frontend && npx tsc --noEmit
```

```bash
# tier2_simplify
echo "SKIP"
```

```bash
# tier3_unit
echo "SKIP — UI tested manually"
```

```bash
# tier4_integration
echo "SKIP — UI tested manually via browser"
```

#### T5.1.2 — Detail Panel & Approval Controls
**Description:** Update the detail panel to show: full diagnosis, draft email preview (with send button), LEI status info, RM contact details. Add approval buttons (Approve / Edit / Reject) per rejection. On approve, call `POST /api/approve`.

**Verify:**

```bash
# tier1_build
cd /Users/richardlao/Documents/Github/Personal/cursor_hackathon/frontend && npx tsc --noEmit
```

```bash
# tier2_simplify
echo "SKIP"
```

```bash
# tier3_unit
echo "SKIP — UI tested manually"
```

```bash
# tier4_integration
echo "SKIP — UI tested manually via browser"
```
