## Decisions
- [2026-04-30] Architecture: Approach B — Cursor SDK agent for AI reasoning + plain TypeScript for deterministic data pipeline
- [2026-04-30] No corrected report generation (Phase 2.C removed) — agents only diagnose and draft RM notifications
- [2026-04-30] Review gate model — agents process everything, human approves before any action is taken
- [2026-04-30] Vercel deployment — Vite frontend as static build, api/ directory as serverless functions
- [2026-04-30] Data files pre-loaded on backend, only FCA feedback XML uploaded at runtime

## Patterns
- [2026-04-30] Agent orchestrator uses Agent.prompt() with deterministic fallback when SDK unavailable
- [2026-04-30] Frontend types duplicated from backend (no shared import path across Vite/Vercel boundary)

## Gotchas
- [2026-04-30] Cursor SDK has broken type declarations (missing @anysphere/cursor-sdk-shared modules) — skipLibCheck required
- [2026-04-30] Frontend tsconfig needs `jsx: "react-jsx"` and `verbatimModuleSyntax` requires `import type` syntax
- [2026-04-30] nvm not loading in shell — use bun at /Users/richardlao/.bun/bin/bun for all TypeScript operations
- [2026-04-30] App.tsx had typo `mport` instead of `import` — fixed

## Open Questions
- [2026-04-30] Cursor SDK (@cursor/sdk) is in public beta — may encounter API instability or missing docs
- [2026-04-30] Need to verify Cursor SDK works in Vercel serverless function context (cold start, timeout limits)
