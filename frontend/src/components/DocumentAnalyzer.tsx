import { useState, useCallback, useRef } from "react";
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  X,
  Brain,
  Shield,
  Clock,
  FileWarning,
  Sparkles,
  ArrowRight,
  Mail,
  User,
  Calendar,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

// ── Types ─────────────────────────────────────────────────────────────────────

type DocStatus = "uploading" | "analyzing" | "pass" | "warning" | "fail";
type DocMode = "mock" | "live";

interface Issue {
  severity: "error" | "warning" | "info";
  title: string;
  detail: string;
  location?: string;
}

interface RMNotification {
  to_email: string;
  to_name: string;
  client_name: string;
  subject: string;
  body: string;
  transaction_ref: string;
  deadline: string;
}

interface AnalyzedDoc {
  id: string;
  name: string;
  size: string;
  type: string;
  status: DocStatus;
  score: number;
  issues: Issue[];
  summary: string;
  analyzedAt?: string;
  mode: DocMode;
  transaction_ref?: string;
  error_code?: string;
  rm_notification?: RMNotification | null;
  action_owner?: string;
  recommended_fix?: string;
}

// ── Mock data ─────────────────────────────────────────────────────────────────

const mockIssues: Record<string, Issue[]> = {
  error: [
    { severity: "error", title: "Missing signature", detail: "Document requires authorized signatory on page 3. Signature field is empty.", location: "Page 3, Section 4.2" },
    { severity: "error", title: "Expired date", detail: "The certification date has expired. Document was valid until 2024-12-31.", location: "Page 1, Header" },
    { severity: "warning", title: "Inconsistent naming", detail: "Company name appears as both 'Acme Corp' and 'ACME Corporation' across sections.", location: "Pages 2, 5, 8" },
  ],
  warning: [
    { severity: "warning", title: "Low resolution scan", detail: "Page 4 scan quality is below 150 DPI. May cause readability issues during audit.", location: "Page 4" },
    { severity: "info", title: "Metadata missing", detail: "Document author and creation date are not embedded in file metadata." },
  ],
  clean: [
    { severity: "info", title: "All checks passed", detail: "Document meets all compliance requirements. No issues found." },
  ],
};

const mockSummaries = [
  "Financial statement with multiple compliance gaps detected. Missing authorized signature and expired certification require immediate attention.",
  "Contract document in good standing. Minor scan quality issue on one page — recommend re-scanning for archive quality.",
  "Fully compliant regulatory filing. All required fields present, signatures valid, dates current.",
  "KYC verification document with inconsistent entity naming. Recommend standardizing before submission.",
  "Insurance policy document — expired validity date detected. Renewal required before processing.",
  "Tax return filing — all figures verified against source data. Clean compliance status.",
];

function generateMockAnalysis(index: number): Partial<AnalyzedDoc> {
  const rand = Math.random();
  let status: DocStatus;
  let issues: Issue[];
  let score: number;
  if (rand < 0.3) { status = "fail"; issues = [...mockIssues.error]; score = Math.floor(Math.random() * 30) + 20; }
  else if (rand < 0.55) { status = "warning"; issues = [...mockIssues.warning]; score = Math.floor(Math.random() * 25) + 60; }
  else { status = "pass"; issues = [...mockIssues.clean]; score = Math.floor(Math.random() * 10) + 90; }
  return { status, score, issues, summary: mockSummaries[index % mockSummaries.length], analyzedAt: new Date().toLocaleTimeString(), mode: "mock" };
}

// ── Live API ──────────────────────────────────────────────────────────────────

interface PipelineResult {
  transaction_ref: string;
  enriched: {
    rejection: { error_code: string; field: string; reject_reason: string };
    relationship: { rm_name: string; rm_email: string } | null;
    buyer_lei_info: { lei_status: string; entity_legal_name: string } | null;
    seller_lei_info: { lei_status: string; entity_legal_name: string } | null;
  };
  agent: {
    diagnosis: { root_cause: string; severity: "critical" | "warning" | "info"; recommended_fix: string; action_owner: string; error_code: string };
    notification: RMNotification | null;
  };
}

interface PipelineResponse { batch_id: string; processed_at: string; total: number; results: PipelineResult[] }

function severityToStatus(s: "critical" | "warning" | "info"): DocStatus {
  return s === "critical" ? "fail" : s === "warning" ? "warning" : "pass";
}
function severityToScore(s: "critical" | "warning" | "info"): number {
  return s === "critical" ? Math.floor(Math.random() * 20) + 10 : s === "warning" ? Math.floor(Math.random() * 20) + 60 : Math.floor(Math.random() * 10) + 88;
}

async function analyzeFcaXml(file: File, batchIndex: number): Promise<AnalyzedDoc[]> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE}/api/analyze`, { method: "POST", body: formData });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? res.statusText);
  }
  const data: PipelineResponse = await res.json();
  return data.results.map((r, i) => {
    const { agent, enriched } = r;
    const status = severityToStatus(agent.diagnosis.severity);
    const issues: Issue[] = [
      { severity: status === "fail" ? "error" : status === "warning" ? "warning" : "info", title: `${agent.diagnosis.error_code} — ${enriched.rejection.field}`, detail: agent.diagnosis.root_cause, location: enriched.rejection.field },
    ];
    if (enriched.buyer_lei_info && enriched.buyer_lei_info.lei_status !== "ACTIVE")
      issues.push({ severity: "error", title: `Buyer LEI ${enriched.buyer_lei_info.lei_status}`, detail: `${enriched.buyer_lei_info.entity_legal_name} — status: ${enriched.buyer_lei_info.lei_status}`, location: "Buyer ID" });
    if (enriched.seller_lei_info && enriched.seller_lei_info.lei_status !== "ACTIVE")
      issues.push({ severity: "error", title: `Seller LEI ${enriched.seller_lei_info.lei_status}`, detail: `${enriched.seller_lei_info.entity_legal_name} — status: ${enriched.seller_lei_info.lei_status}`, location: "Seller ID" });
    return {
      id: `live-${data.batch_id}-${batchIndex}-${i}`,
      name: r.transaction_ref,
      size: file.name,
      type: "FCA MiFIR Rejection",
      status,
      score: severityToScore(agent.diagnosis.severity),
      issues,
      summary: agent.diagnosis.root_cause,
      analyzedAt: new Date(data.processed_at).toLocaleTimeString(),
      mode: "live" as DocMode,
      transaction_ref: r.transaction_ref,
      error_code: agent.diagnosis.error_code,
      rm_notification: agent.notification,
      action_owner: agent.diagnosis.action_owner,
      recommended_fix: agent.diagnosis.recommended_fix,
    };
  });
}

// ── UI config ─────────────────────────────────────────────────────────────────

const statusConfig: Record<DocStatus, { icon: React.ElementType; color: string; bg: string; border: string; label: string }> = {
  uploading: { icon: Loader2, color: "text-brand-blue", bg: "bg-brand-blue-50", border: "border-brand-blue-100", label: "Uploading" },
  analyzing: { icon: Loader2, color: "text-brand-blue", bg: "bg-brand-blue-50", border: "border-brand-blue-100", label: "Analyzing" },
  pass: { icon: CheckCircle2, color: "text-status-pass", bg: "bg-status-pass-bg", border: "border-status-pass/20", label: "Passed" },
  warning: { icon: AlertTriangle, color: "text-status-warn", bg: "bg-status-warn-bg", border: "border-status-warn/20", label: "Warnings" },
  fail: { icon: XCircle, color: "text-status-fail", bg: "bg-status-fail-bg", border: "border-status-fail/20", label: "Issues Found" },
};
const severityConfig = {
  error: { icon: XCircle, color: "text-status-fail", bg: "bg-status-fail-bg", border: "border-status-fail/20" },
  warning: { icon: AlertTriangle, color: "text-status-warn", bg: "bg-status-warn-bg", border: "border-status-warn/20" },
  info: { icon: CheckCircle2, color: "text-brand-blue", bg: "bg-brand-blue-50", border: "border-brand-blue-100" },
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function DocumentAnalyzer() {
  const [documents, setDocuments] = useState<AnalyzedDoc[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<AnalyzedDoc | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const batchCounter = useRef(0);

  const processFiles = useCallback((files: FileList | File[]) => {
    setApiError(null);
    Array.from(files).forEach((file) => {
      const isXml = file.name.toLowerCase().endsWith(".xml") || file.type.includes("xml");

      if (isXml) {
        const placeholderId = `upload-${Date.now()}-${Math.random()}`;
        const batchIdx = ++batchCounter.current;
        setDocuments((prev) => [{
          id: placeholderId, name: file.name, size: `${Math.round(file.size / 1024)} KB`,
          type: "FCA Feedback XML", status: "analyzing", score: 0, issues: [], summary: "", mode: "live",
        }, ...prev]);
        analyzeFcaXml(file, batchIdx)
          .then((results) => setDocuments((prev) => [...results, ...prev.filter((d) => d.id !== placeholderId)]))
          .catch((err: unknown) => {
            setApiError(`API error: ${err instanceof Error ? err.message : String(err)}`);
            setDocuments((prev) => prev.filter((d) => d.id !== placeholderId));
          });
      } else {
        const id = `mock-${Date.now()}-${Math.random()}`;
        setDocuments((prev) => [{
          id, name: file.name, size: `${Math.round(file.size / 1024)} KB`,
          type: file.type || "document", status: "analyzing", score: 0, issues: [], summary: "", mode: "mock",
        }, ...prev]);
        setTimeout(() => {
          setDocuments((prev) => prev.map((d) => d.id === id ? { ...d, ...generateMockAnalysis(Math.floor(Math.random() * 6)) } : d));
        }, 1500 + Math.random() * 2000);
      }
    });
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) processFiles(e.dataTransfer.files);
  }, [processFiles]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) { processFiles(e.target.files); e.target.value = ""; }
  }, [processFiles]);

  const loadDemo = useCallback(() => {
    setApiError(null);
    const demos: AnalyzedDoc[] = [
      { id: `d0-${Date.now()}`, name: "Q3-Financial-Statement.pdf", size: "2.4 MB", type: "application/pdf", status: "analyzing", score: 0, issues: [], summary: "", mode: "mock" },
      { id: `d1-${Date.now()}`, name: "KYC-Verification-ClientA.pdf", size: "840 KB", type: "application/pdf", status: "analyzing", score: 0, issues: [], summary: "", mode: "mock" },
      { id: `d2-${Date.now()}`, name: "Insurance-Policy-MC445.pdf", size: "1.1 MB", type: "application/pdf", status: "analyzing", score: 0, issues: [], summary: "", mode: "mock" },
    ];
    const results: Partial<AnalyzedDoc>[] = [
      { status: "pass", score: 96, summary: "Fully compliant. All fields present, signatures valid.", issues: [{ severity: "info", title: "All checks passed", detail: "No issues found." }] },
      { status: "warning", score: 74, summary: "Minor scan quality issue on page 4.", issues: [{ severity: "warning", title: "Low resolution scan", detail: "Page 4 below 150 DPI.", location: "Page 4" }] },
      { status: "fail", score: 31, summary: "Expired validity date and missing signature.", issues: [{ severity: "error", title: "Missing signature", detail: "Page 3 empty.", location: "Page 3" }, { severity: "error", title: "Expired date", detail: "Expired 2024-12-31.", location: "Page 1" }] },
    ];
    setDocuments(demos); setSelectedDoc(null);
    demos.forEach((doc, i) => setTimeout(() => setDocuments((prev) => prev.map((d) => d.id === doc.id ? { ...d, ...results[i], analyzedAt: new Date().toLocaleTimeString() } : d)), 800 + i * 600));
  }, []);

  const passCount = documents.filter((d) => d.status === "pass").length;
  const warnCount = documents.filter((d) => d.status === "warning").length;
  const failCount = documents.filter((d) => d.status === "fail").length;
  const analyzingCount = documents.filter((d) => d.status === "analyzing" || d.status === "uploading").length;

  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-y-auto">
        {/* Hero */}
        <div className="bg-brand-blue relative overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
              <defs><pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5" /></pattern></defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>
          </div>
          <div className="relative px-10 py-12 max-w-5xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-[11px] font-semibold text-white/90 uppercase tracking-widest mb-5">
              <Sparkles className="w-3 h-3" />
              AI-Powered Compliance · FCA MiFIR
            </div>
            <h1 className="text-[42px] leading-[1.1] font-black text-white tracking-tight mb-4">
              Document compliance<br />analysis engine
            </h1>
            <p className="text-base text-white/75 max-w-lg leading-relaxed font-medium">
              Upload FCA feedback XML to run the full MiFIR rejection pipeline — enrichment, LEI validation, AI diagnosis, and RM notifications. Other file types use the mock analyzer.
            </p>
          </div>
        </div>

        <div className="px-10 py-8 max-w-5xl mx-auto">
          {/* Error banner */}
          {apiError && (
            <div className="mb-6 p-4 bg-status-fail-bg border border-status-fail/20 rounded-xl flex items-start gap-3">
              <XCircle className="w-5 h-5 text-status-fail shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="text-sm font-bold text-text-heading">Pipeline error</div>
                <div className="text-sm text-text-body mt-0.5">{apiError}</div>
                <div className="text-xs text-text-muted mt-1">Make sure the backend is running: <code className="bg-white px-1 py-0.5 rounded font-mono">npm run server</code></div>
              </div>
              <button onClick={() => setApiError(null)}><X className="w-4 h-4 text-text-muted" /></button>
            </div>
          )}

          {/* Upload zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all mb-8 bg-white ${
              isDragOver ? "border-brand-blue bg-brand-blue-50 shadow-lg shadow-brand-blue/10" : "border-border-medium hover:border-brand-blue-light hover:shadow-md"
            }`}
          >
            <input ref={fileInputRef} type="file" multiple onChange={handleFileSelect} className="hidden"
              accept=".xml,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg" />
            <div className={`w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center ${isDragOver ? "bg-brand-blue" : "bg-brand-blue-50"} transition-colors`}>
              <Upload className={`w-7 h-7 ${isDragOver ? "text-white" : "text-brand-blue"} transition-colors`} />
            </div>
            <div className="text-base font-bold text-text-heading mb-1">{isDragOver ? "Drop files to analyze" : "Drag & drop documents here"}</div>
            <div className="text-sm text-text-muted mb-4">or click to browse</div>
            <div className="flex flex-wrap justify-center gap-2">
              <span className="inline-flex items-center gap-1 text-[11px] text-brand-blue bg-brand-blue-50 border border-brand-blue-100 px-3 py-1.5 rounded-full font-semibold">XML → Live Pipeline</span>
              <span className="inline-flex items-center gap-1 text-[11px] text-text-muted bg-surface-muted px-3 py-1.5 rounded-full font-medium">PDF, DOC, XLS → Mock Analyzer</span>
            </div>
          </div>

          {documents.length === 0 && (
            <div className="flex justify-center -mt-4 mb-8">
              <button onClick={(e) => { e.stopPropagation(); loadDemo(); }}
                className="flex items-center gap-2 px-5 py-2.5 bg-brand-blue text-white rounded-xl text-sm font-bold hover:bg-brand-blue-dark transition-colors shadow-md shadow-brand-blue/20">
                <Sparkles className="w-4 h-4" />Load Demo Documents
              </button>
            </div>
          )}

          {/* Stats */}
          {documents.length > 0 && (
            <div className="grid grid-cols-4 gap-4 mb-8">
              <StatCard icon={FileText} color="text-brand-blue" bg="bg-brand-blue-50" label="Total" value={documents.length.toString()} />
              <StatCard icon={CheckCircle2} color="text-status-pass" bg="bg-status-pass-bg" label="Passed" value={passCount.toString()} />
              <StatCard icon={AlertTriangle} color="text-status-warn" bg="bg-status-warn-bg" label="Warnings" value={warnCount.toString()} />
              <StatCard icon={XCircle} color="text-status-fail" bg="bg-status-fail-bg" label="Issues" value={failCount.toString()} />
            </div>
          )}

          {/* Results list */}
          {documents.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-extrabold text-text-heading tracking-tight">Analysis Results</h2>
                {analyzingCount > 0 && (
                  <span className="flex items-center gap-2 text-xs text-brand-blue font-semibold">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />Analyzing {analyzingCount} document{analyzingCount > 1 ? "s" : ""}…
                  </span>
                )}
              </div>
              <div className="space-y-3">
                {documents.map((doc) => {
                  const cfg = statusConfig[doc.status];
                  const Icon = cfg.icon;
                  const isSelected = selectedDoc?.id === doc.id;
                  const isProcessing = doc.status === "analyzing" || doc.status === "uploading";
                  return (
                    <button key={doc.id} onClick={() => !isProcessing && setSelectedDoc(doc)} disabled={isProcessing}
                      className={`w-full text-left bg-white border rounded-xl p-5 flex items-center gap-4 transition-all shadow-sm ${
                        isSelected ? "border-brand-blue ring-2 ring-brand-blue/10 shadow-md" : "border-border-soft hover:border-brand-blue-light hover:shadow-md"
                      } ${isProcessing ? "opacity-60 cursor-wait" : "cursor-pointer"}`}>
                      <div className={`w-11 h-11 rounded-xl ${cfg.bg} flex items-center justify-center shrink-0`}>
                        <Icon className={`w-5 h-5 ${cfg.color} ${isProcessing ? "animate-spin" : ""}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-bold text-text-heading truncate">{doc.name}</div>
                          {doc.mode === "live" && !isProcessing && (
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-brand-blue text-white shrink-0">Live</span>
                          )}
                        </div>
                        <div className="text-xs text-text-muted mt-0.5">{doc.size} · {doc.type}</div>
                      </div>
                      {!isProcessing && (
                        <>
                          <span className={`text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full border ${cfg.bg} ${cfg.color} ${cfg.border}`}>{cfg.label}</span>
                          <div className="w-20 shrink-0 text-right">
                            <div className="text-lg font-extrabold text-text-heading">{doc.score}%</div>
                            <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden mt-1">
                              <div className={`h-full rounded-full transition-all ${doc.status === "pass" ? "bg-status-pass" : doc.status === "warning" ? "bg-status-warn" : "bg-status-fail"}`}
                                style={{ width: `${doc.score}%` }} />
                            </div>
                          </div>
                          <ArrowRight className="w-4 h-4 text-text-muted shrink-0" />
                        </>
                      )}
                      {isProcessing && <span className="text-xs text-brand-blue font-semibold">Processing…</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Detail panel */}
      {selectedDoc && (
        <div className="w-[420px] border-l border-border-soft bg-white overflow-y-auto shrink-0 shadow-xl">
          <div className="p-5 border-b border-border-soft flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-text-heading tracking-tight">Analysis Detail</h3>
            <button onClick={() => setSelectedDoc(null)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-surface-muted transition-colors">
              <X className="w-4 h-4 text-text-muted" />
            </button>
          </div>

          <div className="p-5 border-b border-border-soft">
            <div className="flex items-start gap-3 mb-5">
              <div className="w-11 h-11 rounded-xl bg-brand-blue-50 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-brand-blue" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-text-heading truncate">{selectedDoc.name}</div>
                <div className="text-[11px] text-text-muted mt-0.5">{selectedDoc.type} · {selectedDoc.analyzedAt}</div>
                {selectedDoc.transaction_ref && <div className="text-[11px] text-brand-blue mt-1 font-semibold">Ref: {selectedDoc.transaction_ref}</div>}
              </div>
            </div>
            <div className="bg-surface-muted rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1">Compliance Score</div>
                  <div className="text-4xl font-black text-text-heading tracking-tight">{selectedDoc.score}%</div>
                </div>
                <div className={`w-14 h-14 rounded-2xl ${statusConfig[selectedDoc.status].bg} flex items-center justify-center`}>
                  {(() => { const Ic = statusConfig[selectedDoc.status].icon; return <Ic className={`w-7 h-7 ${statusConfig[selectedDoc.status].color}`} />; })()}
                </div>
              </div>
              <div className="h-2.5 rounded-full bg-white overflow-hidden">
                <div className={`h-full rounded-full ${selectedDoc.status === "pass" ? "bg-status-pass" : selectedDoc.status === "warning" ? "bg-status-warn" : "bg-status-fail"}`}
                  style={{ width: `${selectedDoc.score}%` }} />
              </div>
            </div>
          </div>

          <div className="p-5 border-b border-border-soft">
            <div className="flex items-center gap-2 mb-3"><Brain className="w-4 h-4 text-brand-blue" /><span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">AI Summary</span></div>
            <p className="text-sm text-text-body leading-relaxed">{selectedDoc.summary}</p>
          </div>

          <div className="p-5 border-b border-border-soft">
            <div className="flex items-center gap-2 mb-4"><FileWarning className="w-4 h-4 text-status-warn" /><span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Issues ({selectedDoc.issues.length})</span></div>
            <div className="space-y-3">
              {selectedDoc.issues.map((issue, i) => {
                const cfg = severityConfig[issue.severity];
                const Ic = cfg.icon;
                return (
                  <div key={i} className={`${cfg.bg} border ${cfg.border} rounded-xl p-4`}>
                    <div className="flex items-start gap-2.5">
                      <Ic className={`w-4 h-4 ${cfg.color} shrink-0 mt-0.5`} />
                      <div>
                        <div className="text-sm font-bold text-text-heading">{issue.title}</div>
                        <div className="text-xs text-text-body mt-1 leading-relaxed">{issue.detail}</div>
                        {issue.location && <div className="text-[11px] text-text-muted mt-2 flex items-center gap-1 font-medium"><Clock className="w-3 h-3" />{issue.location}</div>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {selectedDoc.recommended_fix && (
            <div className="p-5 border-b border-border-soft">
              <div className="flex items-center gap-2 mb-3"><Shield className="w-4 h-4 text-brand-blue" /><span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Recommended Fix</span></div>
              <div className="bg-brand-blue-50 border border-brand-blue-100 rounded-xl p-4">
                <p className="text-sm text-brand-blue-dark leading-relaxed font-medium">{selectedDoc.recommended_fix}</p>
                {selectedDoc.action_owner && (
                  <div className="mt-2 flex items-center gap-1.5 text-[11px] text-brand-blue font-semibold"><User className="w-3 h-3" />Action owner: {selectedDoc.action_owner}</div>
                )}
              </div>
            </div>
          )}

          {selectedDoc.rm_notification && (
            <div className="p-5">
              <div className="flex items-center gap-2 mb-3"><Mail className="w-4 h-4 text-brand-blue" /><span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">RM Notification Draft</span></div>
              <div className="bg-surface-muted border border-border-soft rounded-xl p-4 space-y-2 text-sm">
                <div className="flex gap-2"><span className="text-text-muted font-semibold w-14 shrink-0">To</span><span className="text-text-heading font-medium">{selectedDoc.rm_notification.to_name} &lt;{selectedDoc.rm_notification.to_email}&gt;</span></div>
                <div className="flex gap-2"><span className="text-text-muted font-semibold w-14 shrink-0">Subject</span><span className="text-text-heading font-medium">{selectedDoc.rm_notification.subject}</span></div>
                <div className="flex gap-2 items-center"><span className="text-text-muted font-semibold w-14 shrink-0 flex items-center gap-1"><Calendar className="w-3 h-3" />Due</span><span className="text-status-fail font-bold">{selectedDoc.rm_notification.deadline}</span></div>
                <div className="pt-2 border-t border-border-soft">
                  <pre className="text-xs text-text-body whitespace-pre-wrap leading-relaxed font-sans">{selectedDoc.rm_notification.body}</pre>
                </div>
              </div>
            </div>
          )}

          {!selectedDoc.recommended_fix && selectedDoc.status !== "pass" && (
            <div className="p-5 border-t border-border-soft">
              <div className="flex items-center gap-2 mb-3"><Shield className="w-4 h-4 text-brand-blue" /><span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Recommendation</span></div>
              <div className="bg-brand-blue-50 border border-brand-blue-100 rounded-xl p-4">
                <p className="text-sm text-brand-blue-dark leading-relaxed font-medium">
                  {selectedDoc.status === "fail" ? "Critical issues must be resolved before this document can be accepted. Address all errors and re-upload." : "Minor issues detected. Review warnings and update before final submission."}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, color, bg, label, value }: { icon: React.ElementType; color: string; bg: string; label: string; value: string }) {
  return (
    <div className="bg-white border border-border-soft rounded-xl p-4 flex items-center gap-3 shadow-sm">
      <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center shrink-0`}><Icon className={`w-5 h-5 ${color}`} /></div>
      <div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-text-muted">{label}</div>
        <div className="text-2xl font-extrabold text-text-heading">{value}</div>
      </div>
    </div>
  );
}
