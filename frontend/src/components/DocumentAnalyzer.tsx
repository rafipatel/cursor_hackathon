import { useState, useCallback, useRef } from "react";
import {
  Upload,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  X,
  Brain,
  Shield,
  Sparkles,
  Clock,
  Mail,
  User,
  ThumbsUp,
  ThumbsDown,
  AlertOctagon,
  FileText,
  Search,
  Database,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface DiagnosisResult {
  rejectionId: string;
  rootCause: string;
  severity: "critical" | "warning" | "info";
  explanation: string;
  recommendedFix: string;
  actioner: "client" | "internal" | "regulator";
  regulatoryDeadline: string;
}

interface DraftEmail {
  to: string;
  toName: string;
  subject: string;
  body: string;
  priority: "high" | "medium" | "low";
}

interface LEILookupResult {
  lei: string;
  legalName: string;
  status: string;
  nextRenewalDate: string;
  isExpired: boolean;
  isRenewable: boolean;
}

interface RelationshipManager {
  clientReference: string;
  clientAccountId: string;
  rmName: string;
  rmEmail: string;
  rmRegion: string;
  rmTimezone: string;
}

interface EnrichedRejection {
  fcaFeedback: {
    transactionReferenceNumber: string;
    errorCode: string;
    errorDescription: string;
    rejectedField: string;
    rejectedValue: string;
    clientReference: string;
  };
  submittedReport: {
    transactionReferenceNumber: string;
    venueTransactionId: string;
    buyerIdentificationCode: string;
    sellerIdentificationCode: string;
    clientReference: string;
    tradingDatetime: string;
  } | null;
  tradeRegistry: {
    fxallTradeId: string;
    venueTransactionId: string;
    clientAccountId: string;
    fundId: string;
    clientReference: string;
    tradeDate: string;
  } | null;
  relationshipManager: RelationshipManager | null;
  leiLookup: LEILookupResult | null;
}

interface RejectionResult {
  id: string;
  enrichedRejection: EnrichedRejection;
  diagnosis: DiagnosisResult;
  draftEmail: DraftEmail;
  status: "pending_approval" | "approved" | "rejected" | "escalated";
  approvedAt: string | null;
}

interface AnalysisResult {
  id: string;
  createdAt: string;
  status: "processing" | "complete" | "error";
  summary: { total: number; critical: number; warning: number; info: number };
  rejections: RejectionResult[];
}

const severityConfig = {
  critical: {
    icon: XCircle,
    color: "text-status-fail",
    bg: "bg-status-fail-bg",
    border: "border-status-fail/20",
    label: "Critical",
  },
  warning: {
    icon: AlertTriangle,
    color: "text-status-warn",
    bg: "bg-status-warn-bg",
    border: "border-status-warn/20",
    label: "Warning",
  },
  info: {
    icon: CheckCircle2,
    color: "text-brand-blue",
    bg: "bg-brand-blue-50",
    border: "border-brand-blue-100",
    label: "Info",
  },
};

const approvalStatusConfig = {
  approved: { label: "Approved & Sent", color: "text-status-pass", bg: "bg-status-pass-bg" },
  rejected: { label: "Rejected", color: "text-status-fail", bg: "bg-status-fail-bg" },
  escalated: { label: "Escalated", color: "text-status-warn", bg: "bg-status-warn-bg" },
  pending_approval: { label: "Pending", color: "text-brand-blue", bg: "bg-brand-blue-50" },
};

export default function DocumentAnalyzer() {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [selectedRejection, setSelectedRejection] = useState<RejectionResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [modalTab, setModalTab] = useState<"email" | "analysis">("email");
  const [csvPreview, setCsvPreview] = useState<{ name: string; content: string }[] | null>(null);
  const [csvLoading, setCsvLoading] = useState(false);
  const [expandedCsv, setExpandedCsv] = useState<string | null>(null);
  const [uploadedXml, setUploadedXml] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const runAnalysis = useCallback(async (useAgent = false) => {
    if (!uploadedXml) return;
    setIsLoading(true);
    setError(null);
    setSelectedRejection(null);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ xml: uploadedXml, useAgent }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || err.error || "Analysis failed");
      }

      const result: AnalysisResult = await res.json();
      setAnalysis(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [uploadedXml]);

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      file.text().then((xml) => {
        setUploadedXml(xml);
        setUploadedFileName(file.name);
      });
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      file.text().then((xml) => {
        setUploadedXml(xml);
        setUploadedFileName(file.name);
      });
      e.target.value = "";
    }
  }, []);

  const handleApprove = useCallback(async (rejectionId: string, action: "approved" | "rejected" | "escalated") => {
    if (!analysis) return;

    try {
      const res = await fetch("/api/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysisId: analysis.id, rejectionId, action }),
      });

      if (!res.ok) throw new Error("Approval failed");

      const updated = await res.json();
      setAnalysis((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          rejections: prev.rejections.map((r) =>
            r.id === rejectionId
              ? { ...r, status: updated.newStatus, approvedAt: updated.approvedAt }
              : r
          ),
        };
      });
      setSelectedRejection((prev) =>
        prev && prev.id === rejectionId
          ? { ...prev, status: updated.newStatus, approvedAt: updated.approvedAt }
          : prev
      );
    } catch {
      setError("Failed to update approval status");
    }
  }, [analysis]);

  return (
    <div className="px-10 py-8 max-w-5xl mx-auto">
      {/* Empty state */}
      {!analysis && !isLoading && !error && (
        <>
          {/* Drag upload zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleFileDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all mb-6 bg-white shadow-sm ${
              isDragOver
                ? "border-brand-blue bg-brand-blue-50/80 shadow-[0_8px_20px_rgba(80,104,145,0.18)]"
                : "border-border-medium hover:border-brand-blue-light hover:shadow-[0_8px_20px_rgba(80,104,145,0.14)]"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              className="hidden"
              accept=".xml,.csv"
            />
            <div className={`w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center ${isDragOver ? "bg-brand-blue" : "bg-brand-blue-50"} transition-colors`}>
              <Upload className={`w-7 h-7 ${isDragOver ? "text-white" : "text-brand-blue"} transition-colors`} />
            </div>
            <div className="text-base font-bold text-text-heading mb-1">
              {isDragOver ? "Drop XML to analyze" : "Upload FCA Regulatory Feedback"}
            </div>
            <div className="text-sm text-text-muted mb-4">
              Drag & drop your FCA rejection file or click to browse
            </div>
            <div className="inline-flex items-center gap-1.5 text-[11px] text-text-muted bg-surface-muted px-3 py-1.5 rounded-full font-medium">
              FCA MiFIR Rejection Feedback XML
            </div>
          </div>

          {/* Uploaded file indicator + action buttons */}
          {uploadedXml && (
            <div className="mt-2 mb-4 flex items-center justify-center gap-2">
              <div className="inline-flex items-center gap-2 text-sm text-status-pass bg-status-pass-bg px-4 py-2 rounded-full font-medium">
                <CheckCircle2 className="w-4 h-4" />
                {uploadedFileName ?? "File uploaded"}
              </div>
              <button
                onClick={() => { setUploadedXml(null); setUploadedFileName(null); }}
                className="text-xs text-text-muted hover:text-status-fail transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <div className="flex justify-center gap-3">
            <button
              onClick={() => runAnalysis(false)}
              disabled={!uploadedXml}
              className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all shadow-md ${
                uploadedXml
                  ? "bg-brand-blue text-white hover:bg-brand-blue-dark shadow-brand-blue/20"
                  : "bg-surface-muted text-text-muted cursor-not-allowed shadow-none"
              }`}
            >
              <Sparkles className="w-4 h-4" />
              Run Analysis
            </button>
            <button
              onClick={() => runAnalysis(true)}
              disabled={!uploadedXml}
              className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all shadow-md ${
                uploadedXml
                  ? "bg-brand-navy text-white hover:opacity-90 shadow-brand-navy/20"
                  : "bg-surface-muted text-text-muted cursor-not-allowed shadow-none"
              }`}
            >
              <Brain className="w-4 h-4" />
              Run with AI Agent
            </button>
          </div>
        </>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="bg-white border border-border-soft rounded-2xl p-16 text-center shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-brand-blue-50 mx-auto mb-5 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-brand-blue animate-spin" />
          </div>
          <div className="text-lg font-bold text-text-heading mb-2">Analyzing rejections...</div>
          <div className="text-sm text-text-muted max-w-md mx-auto">
            Parsing FCA feedback, enriching with GLEIF data, joining trade registry,
            and running AI diagnosis agent.
          </div>
          <div className="mt-6 flex items-center justify-center gap-6 text-xs text-text-muted">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-status-pass" /> Feedback parsed
            </span>
            <span className="flex items-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-blue" /> Enriching data
            </span>
            <span className="flex items-center gap-1.5 opacity-40">
              <Brain className="w-3.5 h-3.5" /> Agent diagnosis
            </span>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-status-fail-bg border border-status-fail/20 rounded-2xl p-6 mb-8">
          <div className="flex items-center gap-3">
            <XCircle className="w-5 h-5 text-status-fail" />
            <div>
              <div className="text-sm font-bold text-status-fail">Analysis Failed</div>
              <div className="text-xs text-text-body mt-1">{error}</div>
            </div>
          </div>
          <button
            onClick={() => { setError(null); setAnalysis(null); }}
            className="mt-4 text-xs font-bold text-brand-blue hover:underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Results */}
      {analysis && (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-4 gap-4 mb-8">
            <StatCard icon={FileText} color="text-brand-blue" bg="bg-brand-blue-50" label="Total" value={analysis.summary.total} />
            <StatCard icon={XCircle} color="text-status-fail" bg="bg-status-fail-bg" label="Critical" value={analysis.summary.critical} />
            <StatCard icon={AlertTriangle} color="text-status-warn" bg="bg-status-warn-bg" label="Warning" value={analysis.summary.warning} />
            <StatCard icon={CheckCircle2} color="text-brand-blue" bg="bg-brand-blue-50" label="Info" value={analysis.summary.info} />
          </div>

          {/* Header row */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-extrabold text-text-heading tracking-tight">Rejection Analysis</h2>
            <button
              onClick={() => { setAnalysis(null); setSelectedRejection(null); setError(null); setUploadedXml(null); setUploadedFileName(null); }}
              className="text-xs font-bold text-brand-blue hover:underline"
            >
              New Analysis
            </button>
          </div>

          {/* Rejection cards */}
          <div className="space-y-3">
            {analysis.rejections.map((rej) => {
              const sev = severityConfig[rej.diagnosis.severity];
              const SevIcon = sev.icon;
              const rm = rej.enrichedRejection.relationshipManager;
              const lei = rej.enrichedRejection.leiLookup;
              const fb = rej.enrichedRejection.fcaFeedback;
              const approval = approvalStatusConfig[rej.status];

              return (
                <button
                  key={rej.id}
                  onClick={() => { setSelectedRejection(rej); setEditSubject(rej.draftEmail.subject); setEditBody(rej.draftEmail.body); setModalTab("email"); }}
                  className="w-full text-left bg-white border border-border-soft rounded-xl p-5 flex items-center gap-4 transition-all shadow-sm hover:border-brand-blue-light hover:shadow-md cursor-pointer"
                >
                  <div className={`w-11 h-11 rounded-xl ${sev.bg} flex items-center justify-center shrink-0`}>
                    <SevIcon className={`w-5 h-5 ${sev.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-text-heading truncate">
                      {fb.clientReference} — {fb.errorCode}
                    </div>
                    <div className="text-xs text-text-muted mt-0.5 truncate">
                      {fb.errorDescription}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {rm && (
                      <span className="text-xs text-text-muted">
                        <User className="w-3 h-3 inline mr-1" />{rm.rmName}
                      </span>
                    )}
                    {lei && (
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        lei.status === "ACTIVE" ? "bg-status-pass-bg text-status-pass"
                        : lei.status === "LAPSED" ? "bg-status-warn-bg text-status-warn"
                        : "bg-status-fail-bg text-status-fail"
                      }`}>
                        {lei.status}
                      </span>
                    )}
                    <span className={`text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full border ${sev.bg} ${sev.color} ${sev.border}`}>
                      {sev.label}
                    </span>
                    {rej.status !== "pending_approval" && (
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${approval.bg} ${approval.color}`}>
                        {approval.label}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Center-stage email modal */}
      {selectedRejection && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setSelectedRejection(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header with headline badges */}
            <div className="p-6 border-b border-border-soft">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-extrabold text-text-heading tracking-tight">
                  Rejection Detail
                </h3>
                <button
                  onClick={() => setSelectedRejection(null)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-surface-muted transition-colors"
                >
                  <X className="w-4 h-4 text-text-muted" />
                </button>
              </div>

              {/* Headline badges */}
              <div className="flex flex-wrap gap-3">
                {selectedRejection.enrichedRejection.relationshipManager && (
                  <div className="flex items-center gap-2 bg-brand-blue-50 border border-brand-blue-100 rounded-lg px-3 py-2">
                    <User className="w-4 h-4 text-brand-blue" />
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Relationship Manager</div>
                      <div className="text-sm font-bold text-text-heading">{selectedRejection.enrichedRejection.relationshipManager.rmName}</div>
                    </div>
                  </div>
                )}
                {selectedRejection.enrichedRejection.leiLookup && (
                  <div className={`flex items-center gap-2 rounded-lg px-3 py-2 border ${
                    selectedRejection.enrichedRejection.leiLookup.status === "ACTIVE"
                      ? "bg-status-pass-bg border-status-pass/20"
                      : selectedRejection.enrichedRejection.leiLookup.status === "LAPSED"
                        ? "bg-status-warn-bg border-status-warn/20"
                        : "bg-status-fail-bg border-status-fail/20"
                  }`}>
                    <Shield className={`w-4 h-4 ${
                      selectedRejection.enrichedRejection.leiLookup.status === "ACTIVE" ? "text-status-pass"
                      : selectedRejection.enrichedRejection.leiLookup.status === "LAPSED" ? "text-status-warn"
                      : "text-status-fail"
                    }`} />
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-text-muted">LEI Status (GLEIF)</div>
                      <div className={`text-sm font-bold ${
                        selectedRejection.enrichedRejection.leiLookup.status === "ACTIVE" ? "text-status-pass"
                        : selectedRejection.enrichedRejection.leiLookup.status === "LAPSED" ? "text-status-warn"
                        : "text-status-fail"
                      }`}>{selectedRejection.enrichedRejection.leiLookup.status}</div>
                    </div>
                  </div>
                )}
                <div className={`flex items-center gap-2 rounded-lg px-3 py-2 border ${severityConfig[selectedRejection.diagnosis.severity].bg} ${severityConfig[selectedRejection.diagnosis.severity].border}`}>
                  <Brain className={`w-4 h-4 ${severityConfig[selectedRejection.diagnosis.severity].color}`} />
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-text-muted">AI Diagnosis</div>
                    <div className="text-sm font-bold text-text-heading">{selectedRejection.diagnosis.recommendedFix.slice(0, 80)}{selectedRejection.diagnosis.recommendedFix.length > 80 ? "..." : ""}</div>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 mt-4">
                <button
                  onClick={() => setModalTab("email")}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
                    modalTab === "email"
                      ? "bg-brand-blue text-white"
                      : "bg-surface-muted text-text-muted hover:text-text-heading"
                  }`}
                >
                  <Mail className="w-3.5 h-3.5" />
                  Email
                </button>
                <button
                  onClick={() => setModalTab("analysis")}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
                    modalTab === "analysis"
                      ? "bg-brand-blue text-white"
                      : "bg-surface-muted text-text-muted hover:text-text-heading"
                  }`}
                >
                  <Search className="w-3.5 h-3.5" />
                  Analysis
                </button>
              </div>
            </div>

            {/* Tab content */}
            {modalTab === "email" && (
              <>
                <div className="px-6 py-4 border-b border-border-soft">
                  <div className="flex items-center gap-2 mb-3">
                    <Mail className="w-4 h-4 text-brand-blue" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Draft RM Notification</span>
                    <span className={`ml-auto text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                      selectedRejection.draftEmail.priority === "high" ? "bg-status-fail-bg text-status-fail"
                      : selectedRejection.draftEmail.priority === "medium" ? "bg-status-warn-bg text-status-warn"
                      : "bg-brand-blue-50 text-brand-blue"
                    }`}>{selectedRejection.draftEmail.priority} priority</span>
                  </div>
                  <div className="bg-surface-muted rounded-xl p-5">
                    <div className="text-[11px] text-text-muted mb-1">
                      To: {selectedRejection.draftEmail.toName} &lt;{selectedRejection.draftEmail.to}&gt;
                    </div>
                    <input
                      type="text"
                      value={editSubject}
                      onChange={(e) => setEditSubject(e.target.value)}
                      className="w-full text-sm font-bold text-text-heading mb-3 bg-white border border-border-soft rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue"
                    />
                    <textarea
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      rows={14}
                      className="w-full text-xs text-text-body leading-relaxed bg-white border border-border-soft rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue"
                    />
                  </div>
                </div>
              </>
            )}

            {modalTab === "analysis" && (
              <div className="px-6 py-4 border-b border-border-soft space-y-4">
                {/* AI Diagnosis */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Brain className="w-4 h-4 text-brand-blue" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">AI Diagnosis</span>
                  </div>
                  <div className="bg-surface-muted rounded-xl p-4 text-xs space-y-2">
                    <p className="text-text-body leading-relaxed">{selectedRejection.diagnosis.explanation}</p>
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border-soft">
                      <div><span className="text-text-muted">Root Cause</span><p className="font-semibold text-text-heading mt-0.5">{selectedRejection.diagnosis.rootCause}</p></div>
                      <div><span className="text-text-muted">Recommended Fix</span><p className="font-semibold text-text-heading mt-0.5">{selectedRejection.diagnosis.recommendedFix}</p></div>
                      <div><span className="text-text-muted">Severity</span><p className={`font-bold mt-0.5 ${severityConfig[selectedRejection.diagnosis.severity].color}`}>{selectedRejection.diagnosis.severity.toUpperCase()}</p></div>
                      <div><span className="text-text-muted">Actioner</span><p className="font-semibold text-text-heading mt-0.5 capitalize">{selectedRejection.diagnosis.actioner}</p></div>
                      <div><span className="text-text-muted">Regulatory Deadline</span><p className="font-semibold text-text-heading mt-0.5 flex items-center gap-1"><Clock className="w-3 h-3" />{selectedRejection.diagnosis.regulatoryDeadline}</p></div>
                    </div>
                  </div>
                </div>

                {/* FCA Feedback */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-status-warn" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">FCA Rejection Feedback</span>
                  </div>
                  <div className="bg-surface-muted rounded-xl p-4 text-xs">
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                      <div className="flex justify-between"><span className="text-text-muted">Transaction Ref</span><span className="font-mono font-semibold text-text-heading text-[11px]">{selectedRejection.enrichedRejection.fcaFeedback.transactionReferenceNumber}</span></div>
                      <div className="flex justify-between"><span className="text-text-muted">Error Code</span><span className="font-bold text-status-fail">{selectedRejection.enrichedRejection.fcaFeedback.errorCode}</span></div>
                      <div className="flex justify-between"><span className="text-text-muted">Rejected Field</span><span className="font-semibold text-text-heading">{selectedRejection.enrichedRejection.fcaFeedback.rejectedField}</span></div>
                      <div className="flex justify-between"><span className="text-text-muted">Rejected Value</span><span className="font-mono font-semibold text-text-heading text-[11px]">{selectedRejection.enrichedRejection.fcaFeedback.rejectedValue}</span></div>
                      <div className="col-span-2 flex justify-between"><span className="text-text-muted">Description</span><span className="font-semibold text-text-heading">{selectedRejection.enrichedRejection.fcaFeedback.errorDescription}</span></div>
                    </div>
                  </div>
                </div>

                {/* LEI Status */}
                {selectedRejection.enrichedRejection.leiLookup && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="w-4 h-4 text-brand-blue" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">LEI Status (GLEIF)</span>
                    </div>
                    <div className="bg-surface-muted rounded-xl p-4 text-xs">
                      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                        <div className="flex justify-between"><span className="text-text-muted">LEI</span><span className="font-mono font-semibold text-text-heading text-[11px]">{selectedRejection.enrichedRejection.leiLookup.lei}</span></div>
                        <div className="flex justify-between"><span className="text-text-muted">Legal Name</span><span className="font-semibold text-text-heading">{selectedRejection.enrichedRejection.leiLookup.legalName}</span></div>
                        <div className="flex justify-between">
                          <span className="text-text-muted">Status</span>
                          <span className={`font-bold ${selectedRejection.enrichedRejection.leiLookup.status === "ACTIVE" ? "text-status-pass" : selectedRejection.enrichedRejection.leiLookup.status === "LAPSED" ? "text-status-warn" : "text-status-fail"}`}>{selectedRejection.enrichedRejection.leiLookup.status}</span>
                        </div>
                        <div className="flex justify-between"><span className="text-text-muted">Renewal Date</span><span className="font-semibold text-text-heading">{selectedRejection.enrichedRejection.leiLookup.nextRenewalDate}</span></div>
                        <div className="flex justify-between"><span className="text-text-muted">Expired</span><span className="font-semibold text-text-heading">{selectedRejection.enrichedRejection.leiLookup.isExpired ? "Yes" : "No"}</span></div>
                        <div className="flex justify-between"><span className="text-text-muted">Renewable</span><span className="font-semibold text-text-heading">{selectedRejection.enrichedRejection.leiLookup.isRenewable ? "Yes" : "No"}</span></div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Submitted Report */}
                {selectedRejection.enrichedRejection.submittedReport && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="w-4 h-4 text-brand-blue" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Submitted MiFIR Report</span>
                    </div>
                    <div className="bg-surface-muted rounded-xl p-4 text-xs">
                      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                        <div className="flex justify-between"><span className="text-text-muted">Venue Transaction ID</span><span className="font-mono font-semibold text-text-heading text-[11px]">{selectedRejection.enrichedRejection.submittedReport.venueTransactionId}</span></div>
                        <div className="flex justify-between"><span className="text-text-muted">Trading DateTime</span><span className="font-semibold text-text-heading">{selectedRejection.enrichedRejection.submittedReport.tradingDatetime}</span></div>
                        <div className="flex justify-between"><span className="text-text-muted">Buyer LEI</span><span className="font-mono font-semibold text-text-heading text-[11px]">{selectedRejection.enrichedRejection.submittedReport.buyerIdentificationCode}</span></div>
                        <div className="flex justify-between"><span className="text-text-muted">Seller LEI</span><span className="font-mono font-semibold text-text-heading text-[11px]">{selectedRejection.enrichedRejection.submittedReport.sellerIdentificationCode}</span></div>
                        <div className="flex justify-between"><span className="text-text-muted">Client Reference</span><span className="font-semibold text-text-heading">{selectedRejection.enrichedRejection.submittedReport.clientReference}</span></div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Trade Registry + RM side by side */}
                <div className="grid grid-cols-2 gap-4">
                  {selectedRejection.enrichedRejection.tradeRegistry && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="w-4 h-4 text-brand-blue" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Trade Registry</span>
                      </div>
                      <div className="bg-surface-muted rounded-xl p-4 text-xs space-y-1.5">
                        <div className="flex justify-between"><span className="text-text-muted">FXall Trade ID</span><span className="font-mono font-semibold text-text-heading text-[11px]">{selectedRejection.enrichedRejection.tradeRegistry.fxallTradeId}</span></div>
                        <div className="flex justify-between"><span className="text-text-muted">Client Account</span><span className="font-semibold text-text-heading">{selectedRejection.enrichedRejection.tradeRegistry.clientAccountId}</span></div>
                        <div className="flex justify-between"><span className="text-text-muted">Fund ID</span><span className="font-semibold text-text-heading">{selectedRejection.enrichedRejection.tradeRegistry.fundId}</span></div>
                        <div className="flex justify-between"><span className="text-text-muted">Trade Date</span><span className="font-semibold text-text-heading">{selectedRejection.enrichedRejection.tradeRegistry.tradeDate}</span></div>
                      </div>
                    </div>
                  )}
                  {selectedRejection.enrichedRejection.relationshipManager && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <User className="w-4 h-4 text-brand-blue" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Relationship Manager</span>
                      </div>
                      <div className="bg-surface-muted rounded-xl p-4 text-xs space-y-1.5">
                        <div className="flex justify-between"><span className="text-text-muted">Name</span><span className="font-bold text-text-heading">{selectedRejection.enrichedRejection.relationshipManager.rmName}</span></div>
                        <div className="flex justify-between"><span className="text-text-muted">Email</span><span className="font-semibold text-text-heading">{selectedRejection.enrichedRejection.relationshipManager.rmEmail}</span></div>
                        <div className="flex justify-between"><span className="text-text-muted">Region</span><span className="font-semibold text-text-heading">{selectedRejection.enrichedRejection.relationshipManager.rmRegion}</span></div>
                        <div className="flex justify-between"><span className="text-text-muted">Timezone</span><span className="font-semibold text-text-heading">{selectedRejection.enrichedRejection.relationshipManager.rmTimezone}</span></div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Preview Data button */}
                <div>
                  {!csvPreview ? (
                    <button
                      onClick={async () => {
                        setCsvLoading(true);
                        try {
                          const res = await fetch("/api/preview-data");
                          const data = await res.json();
                          setCsvPreview(data);
                        } catch {
                          setCsvPreview([]);
                        } finally {
                          setCsvLoading(false);
                        }
                      }}
                      disabled={csvLoading}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-brand-navy text-white rounded-xl text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      {csvLoading ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Loading...</>
                      ) : (
                        <><Database className="w-4 h-4" /> Preview Source Data</>
                      )}
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Database className="w-4 h-4 text-brand-blue" />
                          <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Source Data Files</span>
                        </div>
                        <button
                          onClick={() => { setCsvPreview(null); setExpandedCsv(null); }}
                          className="text-[10px] font-bold text-brand-blue hover:underline"
                        >
                          Hide
                        </button>
                      </div>
                      {csvPreview.map((file) => (
                        <div key={file.name} className="border border-border-soft rounded-xl overflow-hidden">
                          <button
                            onClick={() => setExpandedCsv(expandedCsv === file.name ? null : file.name)}
                            className="w-full flex items-center justify-between px-4 py-2.5 bg-surface-muted hover:bg-gray-100 transition-colors text-left"
                          >
                            <span className="text-xs font-bold text-text-heading font-mono">{file.name}</span>
                            {expandedCsv === file.name
                              ? <ChevronUp className="w-4 h-4 text-text-muted" />
                              : <ChevronDown className="w-4 h-4 text-text-muted" />
                            }
                          </button>
                          {expandedCsv === file.name && (
                            <div className="p-3 bg-white overflow-x-auto">
                              <table className="w-full text-[11px]">
                                <thead>
                                  <tr className="border-b border-border-soft">
                                    {file.content.split("\n")[0]?.split(",").map((col: string, i: number) => (
                                      <th key={i} className="text-left py-1.5 px-2 font-bold text-text-heading whitespace-nowrap">{col}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {file.content.split("\n").slice(1).filter((r: string) => r.trim()).map((row: string, ri: number) => (
                                    <tr key={ri} className="border-b border-border-soft/50 hover:bg-brand-blue-50/30">
                                      {row.split(",").map((cell: string, ci: number) => (
                                        <td key={ci} className="py-1.5 px-2 text-text-body whitespace-nowrap font-mono">{cell}</td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Approval actions */}
            <div className="px-6 py-5">
              {selectedRejection.status === "pending_approval" ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleApprove(selectedRejection.id, "approved")}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-status-pass text-white rounded-xl text-sm font-bold hover:opacity-90 transition-opacity"
                  >
                    <ThumbsUp className="w-4 h-4" />
                    Approve & Send
                  </button>
                  <button
                    onClick={() => handleApprove(selectedRejection.id, "escalated")}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-brand-blue text-white rounded-xl text-sm font-bold hover:opacity-90 transition-opacity"
                  >
                    <AlertOctagon className="w-4 h-4" />
                    Escalate
                  </button>
                  <button
                    onClick={() => handleApprove(selectedRejection.id, "rejected")}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-surface-muted text-text-muted rounded-xl text-sm font-bold hover:bg-gray-200 transition-colors"
                  >
                    <ThumbsDown className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className={`text-center py-3 rounded-xl ${approvalStatusConfig[selectedRejection.status].bg}`}>
                  <span className={`text-sm font-bold ${approvalStatusConfig[selectedRejection.status].color}`}>
                    {approvalStatusConfig[selectedRejection.status].label}
                  </span>
                  {selectedRejection.approvedAt && (
                    <span className="text-xs text-text-muted ml-2">
                      at {new Date(selectedRejection.approvedAt).toLocaleTimeString()}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, color, bg, label, value }: {
  icon: React.ElementType;
  color: string;
  bg: string;
  label: string;
  value: number;
}) {
  return (
    <div className="bg-white border border-border-soft rounded-xl p-4 flex items-center gap-3 shadow-sm">
      <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-text-muted">{label}</div>
        <div className="text-2xl font-extrabold text-text-heading">{value}</div>
      </div>
    </div>
  );
}
