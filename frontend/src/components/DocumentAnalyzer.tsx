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
  Phone,
  ThumbsUp,
  ThumbsDown,
  AlertOctagon,

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
  managingLou: string;
}

interface RelationshipManager {
  clientReference: string;
  clientName: string;
  rmName: string;
  rmEmail: string;
  rmPhone: string;
  clientTier: string;
  region: string;
}

interface EnrichedRejection {
  fcaFeedback: {
    transactionReferenceNumber: string;
    errorCode: string;
    errorDescription: string;
    rejectedField: string;
    rejectedValue: string;
    feedbackTimestamp: string;
  };
  submittedReport: {
    transactionReferenceNumber: string;
    venueTransactionId: string;
    price: string;
    quantity: string;
    currency: string;
    tradeDatetime: string;
  } | null;
  tradeRegistry: {
    clientAccountId: string;
    clientReference: string;
    tradeType: string;
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
  summary: {
    total: number;
    critical: number;
    warning: number;
    info: number;
  };
  rejections: RejectionResult[];
}

const DEMO_XML = `<?xml version="1.0" encoding="UTF-8"?>
<FCAFeedback>
  <Header>
    <MessageType>REJECTION_FEEDBACK</MessageType>
    <SendingEntity>FCA</SendingEntity>
    <ReceivingEntity>LSEG_FXALL</ReceivingEntity>
    <CreationTimestamp>2026-04-07T08:30:00Z</CreationTimestamp>
    <MessageId>FCA-FB-2026-04-07-001</MessageId>
  </Header>
  <RejectedTransactions>
    <Transaction>
      <ReferenceNumber>FXALL-20260407-001</ReferenceNumber>
      <RejectionCode>LEIV001</RejectionCode>
      <RejectionDescription>Invalid LEI - Entity identifier has lapsed and is no longer valid for reporting purposes</RejectionDescription>
      <RejectedField>BuyerIdentificationCode</RejectedField>
      <RejectedValue>213800FERQ5LE3H0XU88</RejectedValue>
      <FeedbackTimestamp>2026-04-07T08:30:00Z</FeedbackTimestamp>
    </Transaction>
    <Transaction>
      <ReferenceNumber>FXALL-20260407-002</ReferenceNumber>
      <RejectionCode>LEIV001</RejectionCode>
      <RejectionDescription>Invalid LEI - Entity identifier has lapsed and is no longer valid for reporting purposes</RejectionDescription>
      <RejectedField>BuyerIdentificationCode</RejectedField>
      <RejectedValue>213800FERQ5LE3H0XU88</RejectedValue>
      <FeedbackTimestamp>2026-04-07T08:30:01Z</FeedbackTimestamp>
    </Transaction>
    <Transaction>
      <ReferenceNumber>FXALL-20260407-003</ReferenceNumber>
      <RejectionCode>LEIV002</RejectionCode>
      <RejectionDescription>Invalid LEI - Entity identifier has been annulled and retired from the GLEIF database</RejectionDescription>
      <RejectedField>BuyerIdentificationCode</RejectedField>
      <RejectedValue>5299000J2N45DDNE4Y28</RejectedValue>
      <FeedbackTimestamp>2026-04-07T08:30:02Z</FeedbackTimestamp>
    </Transaction>
  </RejectedTransactions>
</FCAFeedback>`;

const severityConfig = {
  critical: { icon: XCircle, color: "text-status-fail", bg: "bg-status-fail-bg", border: "border-status-fail/20", label: "Critical" },
  warning: { icon: AlertTriangle, color: "text-status-warn", bg: "bg-status-warn-bg", border: "border-status-warn/20", label: "Warning" },
  info: { icon: CheckCircle2, color: "text-brand-blue", bg: "bg-brand-blue-50", border: "border-brand-blue-100", label: "Info" },
};

const approvalStatusConfig = {
  pending_approval: { color: "text-status-warn", bg: "bg-status-warn-bg", label: "Pending Review" },
  approved: { color: "text-status-pass", bg: "bg-status-pass-bg", label: "Approved" },
  rejected: { color: "text-status-fail", bg: "bg-status-fail-bg", label: "Rejected" },
  escalated: { color: "text-brand-blue", bg: "bg-brand-blue-50", label: "Escalated" },
};

export default function DocumentAnalyzer() {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [selectedRejection, setSelectedRejection] = useState<RejectionResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const analyzeXML = useCallback(async (xml: string) => {
    setIsLoading(true);
    setError(null);
    setSelectedRejection(null);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ xml }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || err.error || "Analysis failed");
      }

      const result: AnalysisResult = await res.json();
      setAnalysis(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) {
        const text = await file.text();
        analyzeXML(text);
      }
    },
    [analyzeXML]
  );

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        const text = await file.text();
        analyzeXML(text);
        e.target.value = "";
      }
    },
    [analyzeXML]
  );

  const handleApprove = useCallback(
    async (rejectionId: string, action: "approved" | "rejected" | "escalated") => {
      if (!analysis) return;

      try {
        const res = await fetch("/api/approve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ analysisId: analysis.id, rejectionId, action }),
        });

        if (res.ok) {
          setAnalysis((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              rejections: prev.rejections.map((r) =>
                r.id === rejectionId
                  ? { ...r, status: action, approvedAt: action === "approved" ? new Date().toISOString() : null }
                  : r
              ),
            };
          });
          setSelectedRejection((prev) =>
            prev?.id === rejectionId
              ? { ...prev, status: action, approvedAt: action === "approved" ? new Date().toISOString() : null }
              : prev
          );
        }
      } catch {
        // Silently handle - status will show stale
      }
    },
    [analysis]
  );

  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-y-auto">
        {/* Hero banner */}
        <div className="bg-brand-blue relative overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>
          </div>
          <div className="relative px-10 py-12 max-w-5xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-[11px] font-semibold text-white/90 uppercase tracking-widest mb-5">
              <Sparkles className="w-3 h-3" />
              Cursor SDK Agent Pipeline
            </div>
            <h1 className="text-[42px] leading-[1.1] font-black text-white tracking-tight mb-4">
              Transaction rejection<br />remediation engine
            </h1>
            <p className="text-base text-white/75 max-w-lg leading-relaxed font-medium">
              Upload FCA feedback XML. The pipeline parses rejections, enriches with GLEIF and trade data,
              diagnoses root causes via AI agent, and drafts RM notifications for your approval.
            </p>
          </div>
        </div>

        <div className="px-10 py-8 max-w-5xl mx-auto">
          {/* Upload zone */}
          {!analysis && !isLoading && (
            <>
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all mb-8 bg-white ${
                  isDragOver
                    ? "border-brand-blue bg-brand-blue-50 shadow-lg shadow-brand-blue/10"
                    : "border-border-medium hover:border-brand-blue-light hover:shadow-md"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileSelect}
                  className="hidden"
                  accept=".xml"
                />
                <div className={`w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center ${isDragOver ? "bg-brand-blue" : "bg-brand-blue-50"} transition-colors`}>
                  <Upload className={`w-7 h-7 ${isDragOver ? "text-white" : "text-brand-blue"} transition-colors`} />
                </div>
                <div className="text-base font-bold text-text-heading mb-1">
                  {isDragOver ? "Drop FCA feedback XML" : "Upload FCA regulatory feedback"}
                </div>
                <div className="text-sm text-text-muted mb-4">
                  Drag & drop your FCA rejection XML file or click to browse
                </div>
                <div className="inline-flex items-center gap-1.5 text-[11px] text-text-muted bg-surface-muted px-3 py-1.5 rounded-full font-medium">
                  FCA MiFIR Rejection Feedback XML
                </div>
              </div>

              <div className="flex justify-center -mt-4 mb-8">
                <button
                  onClick={() => analyzeXML(DEMO_XML)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-brand-blue text-white rounded-xl text-sm font-bold hover:bg-brand-blue-dark transition-colors shadow-md shadow-brand-blue/20"
                >
                  <Sparkles className="w-4 h-4" />
                  Run Demo Analysis
                </button>
              </div>
            </>
          )}

          {/* Loading state */}
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
                <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-status-pass" /> XML parsed</span>
                <span className="flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin text-brand-blue" /> Enriching data</span>
                <span className="flex items-center gap-1.5 opacity-40"><Brain className="w-3.5 h-3.5" /> Agent diagnosis</span>
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
                <StatCard icon={FileText} color="text-brand-blue" bg="bg-brand-blue-50" label="Rejections" value={analysis.summary.total.toString()} />
                <StatCard icon={XCircle} color="text-status-fail" bg="bg-status-fail-bg" label="Critical" value={analysis.summary.critical.toString()} />
                <StatCard icon={AlertTriangle} color="text-status-warn" bg="bg-status-warn-bg" label="Warnings" value={analysis.summary.warning.toString()} />
                <StatCard icon={CheckCircle2} color="text-status-pass" bg="bg-status-pass-bg" label="Info" value={analysis.summary.info.toString()} />
              </div>

              {/* New analysis button */}
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-extrabold text-text-heading tracking-tight">Rejection Analysis</h2>
                <button
                  onClick={() => { setAnalysis(null); setSelectedRejection(null); setError(null); }}
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
                  const approval = approvalStatusConfig[rej.status];
                  const isSelected = selectedRejection?.id === rej.id;
                  const rm = rej.enrichedRejection.relationshipManager;
                  const lei = rej.enrichedRejection.leiLookup;

                  return (
                    <button
                      key={rej.id}
                      onClick={() => setSelectedRejection(rej)}
                      className={`w-full text-left bg-white border rounded-xl p-5 flex items-center gap-4 transition-all shadow-sm ${
                        isSelected
                          ? "border-brand-blue ring-2 ring-brand-blue/10 shadow-md"
                          : "border-border-soft hover:border-brand-blue-light hover:shadow-md"
                      } cursor-pointer`}
                    >
                      <div className={`w-11 h-11 rounded-xl ${sev.bg} flex items-center justify-center shrink-0`}>
                        <SevIcon className={`w-5 h-5 ${sev.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-text-heading truncate">
                          {rej.enrichedRejection.fcaFeedback.transactionReferenceNumber}
                        </div>
                        <div className="text-xs text-text-muted mt-0.5 truncate">
                          {rm?.clientName ?? "Unknown Client"} — {lei?.legalName ?? rej.enrichedRejection.fcaFeedback.rejectedValue}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full border ${sev.bg} ${sev.color} ${sev.border}`}>
                          {sev.label}
                        </span>
                        <span className={`text-[11px] font-bold px-3 py-1.5 rounded-full ${approval.bg} ${approval.color}`}>
                          {approval.label}
                        </span>
                      </div>
                      <ArrowRight className="w-4 h-4 text-text-muted shrink-0" />
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Detail panel */}
      {selectedRejection && (
        <div className="w-[440px] border-l border-border-soft bg-white overflow-y-auto shrink-0 shadow-xl">
          <div className="p-5 border-b border-border-soft flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-text-heading tracking-tight">Rejection Detail</h3>
            <button onClick={() => setSelectedRejection(null)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-surface-muted transition-colors">
              <X className="w-4 h-4 text-text-muted" />
            </button>
          </div>

          {/* Severity + Transaction */}
          <div className="p-5 border-b border-border-soft">
            <div className="flex items-start gap-3 mb-4">
              {(() => {
                const sev = severityConfig[selectedRejection.diagnosis.severity];
                const SevIcon = sev.icon;
                return (
                  <div className={`w-11 h-11 rounded-xl ${sev.bg} flex items-center justify-center shrink-0`}>
                    <SevIcon className={`w-5 h-5 ${sev.color}`} />
                  </div>
                );
              })()}
              <div className="min-w-0">
                <div className="text-sm font-bold text-text-heading">{selectedRejection.enrichedRejection.fcaFeedback.transactionReferenceNumber}</div>
                <div className="text-[11px] text-text-muted mt-0.5">
                  {selectedRejection.enrichedRejection.fcaFeedback.errorCode} — {selectedRejection.enrichedRejection.fcaFeedback.feedbackTimestamp}
                </div>
              </div>
            </div>

            <div className="bg-surface-muted rounded-xl p-4 text-xs space-y-1.5">
              <div className="flex justify-between"><span className="text-text-muted">Rejected Field</span><span className="font-semibold text-text-heading">{selectedRejection.enrichedRejection.fcaFeedback.rejectedField}</span></div>
              <div className="flex justify-between"><span className="text-text-muted">Rejected Value</span><span className="font-mono font-semibold text-text-heading text-[11px]">{selectedRejection.enrichedRejection.fcaFeedback.rejectedValue}</span></div>
              {selectedRejection.enrichedRejection.submittedReport && (
                <>
                  <div className="flex justify-between"><span className="text-text-muted">Trade Value</span><span className="font-semibold text-text-heading">{selectedRejection.enrichedRejection.submittedReport.price} {selectedRejection.enrichedRejection.submittedReport.currency}</span></div>
                  <div className="flex justify-between"><span className="text-text-muted">Quantity</span><span className="font-semibold text-text-heading">{selectedRejection.enrichedRejection.submittedReport.quantity}</span></div>
                </>
              )}
            </div>
          </div>

          {/* AI Diagnosis */}
          <div className="p-5 border-b border-border-soft">
            <div className="flex items-center gap-2 mb-3">
              <Brain className="w-4 h-4 text-brand-blue" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">AI Diagnosis</span>
            </div>
            <div className="mb-3">
              <div className="text-sm font-bold text-text-heading mb-1">{selectedRejection.diagnosis.rootCause}</div>
              <p className="text-xs text-text-body leading-relaxed">{selectedRejection.diagnosis.explanation}</p>
            </div>
            <div className={`${severityConfig[selectedRejection.diagnosis.severity].bg} border ${severityConfig[selectedRejection.diagnosis.severity].border} rounded-xl p-3`}>
              <div className="flex items-center gap-2 mb-1">
                <Shield className="w-3.5 h-3.5 text-brand-blue" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Recommended Fix</span>
              </div>
              <p className="text-xs text-text-body leading-relaxed">{selectedRejection.diagnosis.recommendedFix}</p>
            </div>
            <div className="mt-3 flex items-center gap-4 text-xs text-text-muted">
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {selectedRejection.diagnosis.regulatoryDeadline}</span>
              <span className="flex items-center gap-1"><User className="w-3 h-3" /> Actioner: {selectedRejection.diagnosis.actioner}</span>
            </div>
          </div>

          {/* LEI Status */}
          {selectedRejection.enrichedRejection.leiLookup && (
            <div className="p-5 border-b border-border-soft">
              <div className="flex items-center gap-2 mb-3">
                <FileWarning className="w-4 h-4 text-status-warn" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">LEI Status (GLEIF)</span>
              </div>
              <div className="bg-surface-muted rounded-xl p-4 text-xs space-y-1.5">
                <div className="flex justify-between"><span className="text-text-muted">LEI</span><span className="font-mono font-semibold text-text-heading text-[11px]">{selectedRejection.enrichedRejection.leiLookup.lei}</span></div>
                <div className="flex justify-between"><span className="text-text-muted">Legal Name</span><span className="font-semibold text-text-heading">{selectedRejection.enrichedRejection.leiLookup.legalName}</span></div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Status</span>
                  <span className={`font-bold ${selectedRejection.enrichedRejection.leiLookup.status === "ACTIVE" ? "text-status-pass" : selectedRejection.enrichedRejection.leiLookup.status === "LAPSED" ? "text-status-warn" : "text-status-fail"}`}>
                    {selectedRejection.enrichedRejection.leiLookup.status}
                  </span>
                </div>
                <div className="flex justify-between"><span className="text-text-muted">Renewal Date</span><span className="font-semibold text-text-heading">{selectedRejection.enrichedRejection.leiLookup.nextRenewalDate}</span></div>
                <div className="flex justify-between"><span className="text-text-muted">Renewable</span><span className="font-semibold text-text-heading">{selectedRejection.enrichedRejection.leiLookup.isRenewable ? "Yes" : "No"}</span></div>
                <div className="flex justify-between"><span className="text-text-muted">Managing LOU</span><span className="font-semibold text-text-heading">{selectedRejection.enrichedRejection.leiLookup.managingLou}</span></div>
              </div>
            </div>
          )}

          {/* RM Contact */}
          {selectedRejection.enrichedRejection.relationshipManager && (
            <div className="p-5 border-b border-border-soft">
              <div className="flex items-center gap-2 mb-3">
                <User className="w-4 h-4 text-brand-blue" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Relationship Manager</span>
              </div>
              <div className="bg-surface-muted rounded-xl p-4">
                <div className="text-sm font-bold text-text-heading mb-1">{selectedRejection.enrichedRejection.relationshipManager.rmName}</div>
                <div className="text-xs text-text-muted mb-2">{selectedRejection.enrichedRejection.relationshipManager.clientName} — {selectedRejection.enrichedRejection.relationshipManager.clientTier} tier</div>
                <div className="flex items-center gap-4 text-xs text-text-body">
                  <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {selectedRejection.enrichedRejection.relationshipManager.rmEmail}</span>
                  <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {selectedRejection.enrichedRejection.relationshipManager.rmPhone}</span>
                </div>
              </div>
            </div>
          )}

          {/* Draft Email */}
          <div className="p-5 border-b border-border-soft">
            <div className="flex items-center gap-2 mb-3">
              <Mail className="w-4 h-4 text-brand-blue" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Draft RM Notification</span>
              <span className={`ml-auto text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                selectedRejection.draftEmail.priority === "high" ? "bg-status-fail-bg text-status-fail" :
                selectedRejection.draftEmail.priority === "medium" ? "bg-status-warn-bg text-status-warn" :
                "bg-brand-blue-50 text-brand-blue"
              }`}>{selectedRejection.draftEmail.priority} priority</span>
            </div>
            <div className="bg-surface-muted rounded-xl p-4">
              <div className="text-[11px] text-text-muted mb-1">To: {selectedRejection.draftEmail.toName} &lt;{selectedRejection.draftEmail.to}&gt;</div>
              <div className="text-xs font-bold text-text-heading mb-3">{selectedRejection.draftEmail.subject}</div>
              <div className="text-xs text-text-body whitespace-pre-line leading-relaxed border-t border-border-soft pt-3">
                {selectedRejection.draftEmail.body}
              </div>
            </div>
          </div>

          {/* Approval Actions */}
          <div className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-4 h-4 text-brand-blue" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Review Decision</span>
            </div>
            {selectedRejection.status === "pending_approval" ? (
              <div className="flex gap-2">
                <button
                  onClick={() => handleApprove(selectedRejection.id, "approved")}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-status-pass text-white rounded-xl text-sm font-bold hover:opacity-90 transition-opacity"
                >
                  <ThumbsUp className="w-4 h-4" />
                  Approve & Send
                </button>
                <button
                  onClick={() => handleApprove(selectedRejection.id, "escalated")}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-blue text-white rounded-xl text-sm font-bold hover:opacity-90 transition-opacity"
                >
                  <AlertOctagon className="w-4 h-4" />
                  Escalate
                </button>
                <button
                  onClick={() => handleApprove(selectedRejection.id, "rejected")}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-surface-muted text-text-muted rounded-xl text-sm font-bold hover:bg-gray-200 transition-colors"
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
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  color,
  bg,
  label,
  value,
}: {
  icon: React.ElementType;
  color: string;
  bg: string;
  label: string;
  value: string;
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
