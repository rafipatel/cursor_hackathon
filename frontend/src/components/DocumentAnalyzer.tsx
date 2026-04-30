import { useCallback, useMemo, useRef, useState } from "react";
import {
  Upload,
  FileText,
  AlertTriangle,
  XCircle,
  Loader2,
  Sparkles,
  X,
  Brain,
  Shield,
  ChevronRight,
  Mail,
  Copy,
  Database,
  PlayCircle,
  Building2,
  TrendingUp,
} from "lucide-react";

const BACKEND = "http://localhost:8787";

const DEMO_FILES = [
  "submitted_mifir_reports.csv",
  "fca_feedback_rejected_transactions.xml",
  "reg_feedback_rejects.csv",
  "gleif_lei_snapshot.csv",
  "fxall_trade_registry.csv",
  "relationship_management_database.csv",
];

interface SpecterIntel {
  organization_name?: string;
  tagline?: string;
  description?: string;
  traction_highlights?: string;
  business_models?: string[];
  customer_focus?: string;
  tags?: string[];
  last_updated?: string;
  matched_on?: "domain" | "name";
  domain?: string;
}

interface SpecterImpact {
  score: number;
  band: "high" | "medium" | "low";
  signal: string;
  factors: string[];
}

interface Ticket {
  reject_id: string;
  trade_ref: string;
  reject_code: string;
  reject_reason: string;
  field_name: string;
  bad_lei: string;
  lei_status: "LAPSED" | "ANNULLED" | "ACTIVE" | "unknown";
  client: { reference: string; account_id: string; parent_firm: string };
  fund: { id: string; name: string };
  rm: { name: string; email: string; region: string } | null;
  severity: "fail" | "warning" | "escalate";
  confidence: number;
  root_cause: string;
  recommended_action: string;
  rm_email_draft: { subject: string; body: string };
  parent_firm_intel?: SpecterIntel;
  parent_firm_canonical?: { name?: string; domain?: string; organization_id?: string };
  specter_impact?: SpecterImpact;
  specter_reranked?: boolean;
  specter_escalated?: boolean;
}

interface TriageResponse {
  tickets: Ticket[];
  stats: {
    total: number;
    fail: number;
    warning: number;
    escalate: number;
    enriched: number;
    high_impact?: number;
    reranked_by_specter?: number;
    policy_escalations?: number;
  };
  durations: { agent_ms: number; specter_ms: number; total_ms: number };
  enrichment?: { hit_rate: number; hits: number; requested: number; unavailable: boolean };
  model: string;
  generated_at: string;
}

interface FilePayload { filename: string; mimeType: string; text: string }
type Phase = "idle" | "loading_files" | "running" | "done" | "error";

const SEVERITY = {
  fail: { color: "text-status-fail", bg: "bg-status-fail-bg", icon: XCircle, label: "Fail" },
  warning: { color: "text-status-warn", bg: "bg-status-warn-bg", icon: AlertTriangle, label: "Warning" },
  escalate: { color: "text-brand-blue", bg: "bg-brand-blue-50", icon: Brain, label: "Escalate" },
};

async function loadDemoData(): Promise<FilePayload[]> {
  return Promise.all(
    DEMO_FILES.map(async (filename) => {
      const res = await fetch(`/demo-data/${filename}`);
      const text = await res.text();
      const mimeType = filename.endsWith(".xml") ? "application/xml" : filename.endsWith(".csv") ? "text/csv" : "text/plain";
      return { filename, mimeType, text };
    })
  );
}

async function readFiles(fileList: FileList | File[]): Promise<FilePayload[]> {
  return Promise.all(
    Array.from(fileList).map(async (file) => ({
      filename: file.name,
      mimeType: file.type || "text/plain",
      text: await file.text(),
    }))
  );
}

async function runTriage(files: FilePayload[]): Promise<TriageResponse> {
  const res = await fetch(`${BACKEND}/triage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ files }),
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`Backend ${res.status}: ${errBody.slice(0, 200)}`);
  }
  return res.json();
}

export default function DocumentAnalyzer() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<TriageResponse | null>(null);
  const [stagedCount, setStagedCount] = useState(0);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [filter, setFilter] = useState<"all" | "fail" | "warning" | "escalate" | "high_impact" | "reranked">("all");
  const [emailCopied, setEmailCopied] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const submit = useCallback(async (files: FilePayload[]) => {
    setPhase("running");
    setError(null);
    setResponse(null);
    setSelected(null);
    try {
      const r = await runTriage(files);
      setResponse(r);
      setPhase("done");
    } catch (e) {
      setError((e as Error).message);
      setPhase("error");
    }
  }, []);

  const handleLoadDemo = useCallback(async () => {
    setPhase("loading_files");
    try {
      const files = await loadDemoData();
      setStagedCount(files.length);
      await submit(files);
    } catch (e) {
      setError((e as Error).message);
      setPhase("error");
    }
  }, [submit]);

  const handleFiles = useCallback(async (fl: FileList | File[]) => {
    setPhase("loading_files");
    try {
      const files = await readFiles(fl);
      setStagedCount(files.length);
      await submit(files);
    } catch (e) {
      setError((e as Error).message);
      setPhase("error");
    }
  }, [submit]);

  const filteredTickets = useMemo(() => {
    if (!response) return [];
    const list = response.tickets.filter((t) => {
      if (filter === "all") return true;
      if (filter === "high_impact") return t.specter_impact?.band === "high";
      if (filter === "reranked") return Boolean(t.specter_reranked);
      return t.severity === filter;
    });
    return list;
  }, [response, filter]);

  const grouped = useMemo(() => {
    const m = new Map<string, Ticket[]>();
    for (const t of filteredTickets) {
      const k = t.client?.parent_firm ?? "Unknown";
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(t);
    }
    return Array.from(m.entries());
  }, [filteredTickets]);

  const isBusy = phase === "loading_files" || phase === "running";

  return (
    <div className="flex h-full">
      <div className="flex-1 p-8 overflow-y-auto">
        <Hero />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <button
            onClick={handleLoadDemo}
            disabled={isBusy}
            className="group relative bg-brand-blue hover:bg-brand-blue-dark disabled:opacity-60 disabled:cursor-wait text-white rounded-xl p-5 text-left transition-all shadow-sm flex items-center gap-4"
          >
            <div className="w-12 h-12 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
              {isBusy ? <Loader2 className="w-5 h-5 animate-spin" /> : <PlayCircle className="w-5 h-5" />}
            </div>
            <div className="flex-1">
              <div className="text-sm font-bold mb-0.5">Run on demo data</div>
              <div className="text-[11px] opacity-80">6 files · LSEG-FXALL MiFIR feedback batch (2026-04-07)</div>
            </div>
            <ChevronRight className="w-4 h-4 opacity-60" />
          </button>

          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
            }}
            onClick={() => !isBusy && fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-5 cursor-pointer transition-all flex items-center gap-4 ${
              isDragOver ? "border-brand-blue bg-brand-blue-50" : "border-border-soft hover:border-brand-blue-100 hover:bg-surface-muted"
            } ${isBusy ? "opacity-50 cursor-wait" : ""}`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
              className="hidden"
              accept=".csv,.xml,.txt,.json"
            />
            <div className="w-12 h-12 rounded-lg bg-surface-muted flex items-center justify-center shrink-0">
              <Upload className="w-5 h-5 text-text-muted" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-bold text-text-heading mb-0.5">Drop your own files</div>
              <div className="text-[11px] text-text-muted">CSV · XML · regulatory feedback bundles</div>
            </div>
          </div>
        </div>

        {isBusy && <PhaseStrip phase={phase} files={stagedCount} />}

        {phase === "error" && (
          <div className="bg-status-fail-bg border border-status-fail/30 text-status-fail text-sm rounded-xl p-4 mb-6">
            <div className="font-semibold mb-1">Triage failed</div>
            <div className="text-xs">{error}</div>
          </div>
        )}

        {response && (
          <>
            <Stats stats={response.stats} durations={response.durations} model={response.model} />

            {response.enrichment?.unavailable && (
              <div className="bg-status-warn-bg border border-status-warn/30 rounded-xl p-3 mb-4 flex items-center gap-3 text-xs text-status-warn">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <div>
                  <span className="font-semibold">Specter enrichment temporarily unavailable</span>
                  <span className="text-text-body"> — triage proceeded without commercial intel ({response.enrichment.hits}/{response.enrichment.requested} firms enriched).</span>
                </div>
              </div>
            )}

            {response.stats.escalate > 0 && (
              <div
                onClick={() => setFilter("escalate")}
                className="cursor-pointer bg-brand-blue-50 border border-brand-blue-100 rounded-xl p-4 mb-6 flex items-center gap-3 hover:bg-brand-blue-100 transition-colors"
              >
                <Brain className="w-4 h-4 text-brand-blue shrink-0" />
                <div className="text-sm flex-1">
                  <span className="font-semibold text-brand-blue">{response.stats.escalate} ticket{response.stats.escalate > 1 ? "s" : ""} routed to human review</span>
                  <span className="text-text-body"> — confidence below 70% or missing data. Click to filter.</span>
                </div>
                <ChevronRight className="w-4 h-4 text-brand-blue" />
              </div>
            )}

            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <h2 className="text-base font-bold text-text-heading">Triage Queue</h2>
              <div className="flex items-center gap-1 ml-auto flex-wrap">
                {([
                  { id: "all", label: "all" },
                  { id: "fail", label: "fail" },
                  { id: "escalate", label: "escalate" },
                  { id: "warning", label: "warning" },
                  { id: "high_impact", label: "high impact" },
                  { id: "reranked", label: "specter-reranked" },
                ] as const).map((k) => (
                  <button
                    key={k.id}
                    onClick={() => setFilter(k.id)}
                    className={`text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-full transition-all ${
                      filter === k.id ? "bg-brand-blue text-white" : "bg-surface-muted text-text-muted hover:bg-brand-blue-50"
                    }`}
                  >
                    {k.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              {grouped.map(([firm, tickets]) => (
                <div key={firm} className="bg-surface border border-border-soft rounded-xl overflow-hidden">
                  <div className="px-4 py-3 bg-surface-muted border-b border-border-soft flex items-center gap-3">
                    <Building2 className="w-4 h-4 text-text-muted" />
                    <div className="text-sm font-semibold text-text-heading">{firm}</div>
                    <div className="text-[11px] text-text-muted">
                      {tickets.length} reject{tickets.length > 1 ? "s" : ""}
                    </div>
                    {tickets[0]?.parent_firm_intel && (
                      <span className="ml-auto inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-brand-blue bg-brand-blue-50 px-2 py-1 rounded-full border border-brand-blue-100 font-semibold">
                        <Sparkles className="w-2.5 h-2.5" />
                        Specter
                      </span>
                    )}
                  </div>
                  <div className="divide-y divide-border-soft">
                    {tickets.map((t) => (
                      <TicketRow
                        key={`${t.reject_id}-${t.trade_ref}`}
                        ticket={t}
                        onClick={() => setSelected(t)}
                        selected={selected?.trade_ref === t.trade_ref}
                      />
                    ))}
                  </div>
                </div>
              ))}
              {grouped.length === 0 && (
                <div className="text-center text-sm text-text-muted py-12">No tickets match this filter.</div>
              )}
            </div>
          </>
        )}

        {!response && phase === "idle" && <EmptyState />}
      </div>

      {selected && (
        <DetailPanel
          ticket={selected}
          onClose={() => setSelected(null)}
          emailCopied={emailCopied}
          setEmailCopied={setEmailCopied}
        />
      )}
    </div>
  );
}

function Hero() {
  return (
    <div className="mb-6">
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-blue-50 border border-brand-blue-100 text-[10px] tracking-[0.15em] uppercase mb-4">
        <Sparkles className="w-3 h-3 text-brand-blue" />
        <span className="text-brand-blue font-bold">Cursor Composer-2</span>
        <span className="text-text-muted">·</span>
        <span className="text-status-pass font-bold">Specter Intel</span>
        <span className="text-text-muted">·</span>
        <span className="text-text-body">FCA / MiFIR Reject Triage</span>
      </div>
      <h1 className="text-3xl font-bold text-text-heading mb-2 tracking-tight">
        Drop a regulatory reject batch.
      </h1>
      <p className="text-text-body text-sm max-w-[680px] leading-relaxed">
        The agent ingests FCA reject feedback alongside your trade registry, the GLEIF authoritative LEI snapshot, and your relationship-management database — root-causes every reject, attributes it to a client and an RM, and drafts a remediation email enriched with Specter commercial intel on the parent firm.
      </p>
    </div>
  );
}

function PhaseStrip({ phase, files }: { phase: Phase; files: number }) {
  return (
    <div className="bg-surface border border-border-soft rounded-xl p-4 mb-6 flex items-center gap-4 shadow-sm">
      <Loader2 className="w-4 h-4 text-brand-blue animate-spin shrink-0" />
      <div className="text-sm text-text-body flex-1">
        {phase === "loading_files" ? `Loading files (${files})…` : `Cursor agent reasoning over ${files} files, then enriching with Specter…`}
      </div>
      <div className="text-[11px] text-text-muted">~12s typical</div>
    </div>
  );
}

function Stats({ stats, durations, model }: { stats: TriageResponse["stats"]; durations: TriageResponse["durations"]; model: string }) {
  const autoResolvable = stats.warning;
  const highImpact = stats.high_impact ?? 0;
  const reranked = stats.reranked_by_specter ?? 0;
  return (
    <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
      <StatCard label="Total Rejects" value={stats.total.toString()} icon={FileText} accent="text-text-heading" bg="bg-surface-muted" />
      <StatCard label="Auto-Resolvable" value={autoResolvable.toString()} icon={AlertTriangle} accent="text-status-warn" bg="bg-status-warn-bg" />
      <StatCard label="Needs Review" value={stats.escalate.toString()} icon={Brain} accent="text-brand-blue" bg="bg-brand-blue-50" />
      <StatCard label="Blocked" value={stats.fail.toString()} icon={XCircle} accent="text-status-fail" bg="bg-status-fail-bg" />
      <StatCard label="High Impact" value={highImpact.toString()} icon={Sparkles} accent="text-status-pass" bg="bg-status-pass-bg" sub={`${reranked} reranked`} />
      <StatCard label="Total Latency" value={`${(durations.total_ms / 1000).toFixed(1)}s`} icon={TrendingUp} accent="text-text-heading" bg="bg-surface-muted" sub={model} />
    </div>
  );
}

function StatCard({
  label, value, icon: Icon, accent, bg, sub,
}: {
  label: string; value: string; icon: React.ElementType; accent: string; bg: string; sub?: string;
}) {
  return (
    <div className="bg-white border border-border-soft rounded-xl p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-7 h-7 rounded-lg ${bg} flex items-center justify-center`}>
          <Icon className={`w-3.5 h-3.5 ${accent}`} />
        </div>
        <div className="text-[10px] uppercase tracking-widest text-text-muted font-bold">{label}</div>
      </div>
      <div className={`text-xl font-extrabold font-mono ${accent}`}>{value}</div>
      {sub && <div className="text-[10px] text-text-muted mt-0.5">{sub}</div>}
    </div>
  );
}

function TicketRow({ ticket, onClick, selected }: { ticket: Ticket; onClick: () => void; selected: boolean }) {
  const cfg = SEVERITY[ticket.severity];
  const Ic = cfg.icon;
  const impact = ticket.specter_impact;
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-all ${selected ? "bg-brand-blue-50" : "hover:bg-surface-muted"}`}
    >
      <div className={`w-8 h-8 rounded-lg ${cfg.bg} flex items-center justify-center shrink-0`}>
        <Ic className={`w-3.5 h-3.5 ${cfg.color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-text-heading truncate">
          <span className="font-mono text-[12px]">{ticket.trade_ref}</span> <span className="text-text-muted">·</span> {ticket.reject_reason}
        </div>
        <div className="text-[11px] text-text-muted truncate mt-0.5">
          {ticket.fund.name} · LEI {ticket.bad_lei.slice(0, 12)}… · {ticket.lei_status}
        </div>
      </div>
      <div className="hidden md:flex flex-col items-end shrink-0 gap-1 mr-2">
        <div className="text-[10px] text-text-muted">{ticket.rm?.name ?? "no RM"}</div>
        <div className="flex items-center gap-1">
          <div className="w-12 h-1 rounded-full bg-border-soft overflow-hidden">
            <div className={`h-full rounded-full ${ticket.confidence >= 0.7 ? "bg-status-pass" : "bg-status-warn"}`} style={{ width: `${ticket.confidence * 100}%` }} />
          </div>
          <div className="text-[10px] font-mono text-text-muted">{Math.round(ticket.confidence * 100)}%</div>
        </div>
      </div>
      {impact && impact.band !== "low" && (
        <span
          title={`Specter impact ${impact.score}/100 — ${impact.signal}`}
          className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-full font-bold shrink-0 ${
            impact.band === "high" ? "bg-status-pass-bg text-status-pass" : "bg-brand-blue-50 text-brand-blue"
          }`}
        >
          {impact.band === "high" ? "High Impact" : "Mid Impact"}
        </span>
      )}
      {ticket.specter_reranked && (
        <span title="Reordered by Specter impact score" className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-full bg-brand-blue-50 text-brand-blue font-bold shrink-0">
          Reranked
        </span>
      )}
      <span className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-full ${cfg.bg} ${cfg.color} font-bold shrink-0`}>
        {cfg.label}
      </span>
      <ChevronRight className="w-4 h-4 text-text-muted shrink-0" />
    </button>
  );
}

function DetailPanel({
  ticket, onClose, emailCopied, setEmailCopied,
}: {
  ticket: Ticket; onClose: () => void; emailCopied: boolean; setEmailCopied: (v: boolean) => void;
}) {
  const intel = ticket.parent_firm_intel;

  const copyEmail = () => {
    const text = `To: ${ticket.rm?.email ?? "(no RM)"}\nSubject: ${ticket.rm_email_draft.subject}\n\n${ticket.rm_email_draft.body}`;
    navigator.clipboard.writeText(text);
    setEmailCopied(true);
    setTimeout(() => setEmailCopied(false), 1800);
  };

  return (
    <div className="w-[440px] border-l border-border-soft bg-surface overflow-y-auto shrink-0">
      <div className="px-5 py-4 border-b border-border-soft flex items-center justify-between sticky top-0 bg-surface z-10">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-brand-blue" />
          <span className="text-sm font-bold text-text-heading">Triage Detail</span>
        </div>
        <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-surface-muted">
          <X className="w-4 h-4 text-text-muted" />
        </button>
      </div>

      <div className="p-5 border-b border-border-soft">
        <div className="text-[10px] uppercase tracking-widest text-text-muted font-bold mb-1">Trade Reference</div>
        <div className="font-mono text-sm font-bold text-text-heading mb-3 break-all">{ticket.trade_ref}</div>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <KV label="Reject Code" value={ticket.reject_code} mono />
          <KV label="LEI Status" value={ticket.lei_status} mono accent="text-status-fail" />
          <KV label="Field" value={ticket.field_name} mono />
          <KV label="Confidence" value={`${Math.round(ticket.confidence * 100)}%`} mono />
        </div>
      </div>

      <Section icon={Database} title="Root Cause">
        <p className="text-xs text-text-body leading-relaxed">{ticket.root_cause}</p>
        <div className="mt-3 bg-surface-muted rounded-lg p-3 border border-border-soft">
          <div className="text-[10px] uppercase tracking-widest text-text-muted font-bold mb-1">Bad LEI</div>
          <div className="font-mono text-xs text-text-heading break-all">{ticket.bad_lei}</div>
        </div>
      </Section>

      <Section icon={Shield} title="Recommended Action">
        <p className="text-xs text-text-body leading-relaxed">{ticket.recommended_action}</p>
      </Section>

      {intel && (
        <Section icon={Sparkles} title="Specter Intel" badge={intel.matched_on === "domain" ? "matched on domain" : "matched on name"}>
          <div className="bg-brand-blue-50 border border-brand-blue-100 rounded-lg p-3">
            <div className="text-sm font-bold text-brand-blue mb-1">{intel.organization_name}</div>
            {ticket.specter_impact && (
              <div className="flex items-center gap-2 mb-2">
                <div className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-bold ${
                  ticket.specter_impact.band === "high" ? "bg-status-pass-bg text-status-pass" : ticket.specter_impact.band === "medium" ? "bg-brand-blue-100 text-brand-blue" : "bg-surface-muted text-text-muted"
                }`}>
                  Impact {ticket.specter_impact.score}/100 · {ticket.specter_impact.band}
                </div>
                {ticket.specter_escalated && (
                  <div className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-brand-blue-50 text-brand-blue font-bold">
                    Policy Escalation
                  </div>
                )}
                {ticket.specter_reranked && (
                  <div className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-brand-blue-50 text-brand-blue font-bold">
                    Reranked
                  </div>
                )}
              </div>
            )}
            {intel.tagline && <div className="text-[11px] text-text-body italic mb-2 leading-relaxed">{intel.tagline}</div>}
            {intel.traction_highlights && (
              <div className="mb-2">
                <div className="text-[10px] uppercase tracking-widest text-text-muted font-bold mb-0.5">Traction</div>
                <div className="text-[11px] text-text-body">{intel.traction_highlights}</div>
              </div>
            )}
            {intel.business_models?.length ? (
              <div className="flex flex-wrap gap-1 mb-2">
                {intel.business_models.map((m) => (
                  <span key={m} className="text-[10px] bg-white border border-brand-blue-100 text-brand-blue px-2 py-0.5 rounded-full font-medium">{m}</span>
                ))}
              </div>
            ) : null}
            {intel.tags?.length ? (
              <div className="flex flex-wrap gap-1">
                {intel.tags.slice(0, 6).map((t) => (
                  <span key={t} className="text-[10px] text-text-muted">#{t.toLowerCase().replace(/\s+/g, "")}</span>
                ))}
              </div>
            ) : null}
            {intel.last_updated && (
              <div className="text-[10px] text-text-muted mt-2">Last updated {intel.last_updated} · via Specter</div>
            )}
          </div>
        </Section>
      )}

      <Section
        icon={Mail}
        title="RM Email Draft"
        actions={
          <button
            onClick={copyEmail}
            className="text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-md bg-brand-blue text-white hover:bg-brand-blue-dark flex items-center gap-1 font-bold"
          >
            <Copy className="w-3 h-3" />
            {emailCopied ? "Copied" : "Copy"}
          </button>
        }
      >
        {ticket.rm ? (
          <>
            <div className="text-[10px] uppercase tracking-widest text-text-muted font-bold mb-1">To</div>
            <div className="text-xs font-mono text-text-heading mb-3 break-all">{ticket.rm.name} &lt;{ticket.rm.email}&gt;</div>
            <div className="text-[10px] uppercase tracking-widest text-text-muted font-bold mb-1">Subject</div>
            <div className="text-xs text-text-heading mb-3 font-medium">{ticket.rm_email_draft.subject}</div>
            <div className="text-[10px] uppercase tracking-widest text-text-muted font-bold mb-1">Body</div>
            <textarea
              readOnly
              value={ticket.rm_email_draft.body}
              className="w-full h-48 text-[11px] font-mono text-text-body bg-surface-muted border border-border-soft rounded-lg p-3 leading-relaxed resize-none"
            />
          </>
        ) : (
          <div className="bg-status-warn-bg border border-status-warn/30 rounded-lg p-3 text-xs text-status-warn">
            No RM mapped for this client. Escalate to compliance ops manually.
          </div>
        )}
      </Section>
    </div>
  );
}

function KV({ label, value, mono, accent }: { label: string; value: string; mono?: boolean; accent?: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-text-muted font-bold">{label}</div>
      <div className={`${mono ? "font-mono" : ""} ${accent ?? "text-text-heading"} font-semibold`}>{value}</div>
    </div>
  );
}

function Section({
  icon: Icon, title, children, badge, actions,
}: {
  icon: React.ElementType; title: string; children: React.ReactNode; badge?: string; actions?: React.ReactNode;
}) {
  return (
    <div className="p-5 border-b border-border-soft last:border-b-0">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-3.5 h-3.5 text-text-muted" />
        <div className="text-[10px] uppercase tracking-widest text-text-muted font-bold">{title}</div>
        {badge && <span className="text-[10px] text-text-muted lowercase italic">{badge}</span>}
        <div className="ml-auto">{actions}</div>
      </div>
      {children}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="border border-dashed border-border-soft rounded-xl p-12 text-center bg-white">
      <Database className="w-10 h-10 mx-auto mb-3 text-text-muted" />
      <div className="text-sm font-bold text-text-heading mb-1">No triage run yet</div>
      <div className="text-xs text-text-muted">Click <em>Run on demo data</em> above, or drop your own MiFIR feedback bundle.</div>
    </div>
  );
}
