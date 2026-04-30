import { useState, useCallback, useRef } from "react";
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  X,
  ChevronRight,
  Brain,
  Shield,
  Clock,
  FileWarning,
  Sparkles,
  ArrowRight,
} from "lucide-react";

type DocStatus = "uploading" | "analyzing" | "pass" | "warning" | "fail";

interface Issue {
  severity: "error" | "warning" | "info";
  title: string;
  detail: string;
  location?: string;
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
}

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
  "Board resolution with missing signatory. Cannot proceed until all directors have signed.",
  "Audit report — clean with minor metadata gaps. Acceptable for filing.",
];

function generateMockAnalysis(file: File, index: number): AnalyzedDoc {
  const rand = Math.random();
  let status: DocStatus;
  let issues: Issue[];
  let score: number;

  if (rand < 0.3) {
    status = "fail";
    issues = [...mockIssues.error];
    score = Math.floor(Math.random() * 30) + 20;
  } else if (rand < 0.55) {
    status = "warning";
    issues = [...mockIssues.warning];
    score = Math.floor(Math.random() * 25) + 60;
  } else {
    status = "pass";
    issues = [...mockIssues.clean];
    score = Math.floor(Math.random() * 10) + 90;
  }

  const sizeKB = file.size / 1024;
  const sizeStr = sizeKB > 1024 ? `${(sizeKB / 1024).toFixed(1)} MB` : `${Math.round(sizeKB)} KB`;

  return {
    id: `doc-${Date.now()}-${index}`,
    name: file.name,
    size: sizeStr,
    type: file.type || "application/octet-stream",
    status,
    score,
    issues,
    summary: mockSummaries[index % mockSummaries.length],
    analyzedAt: new Date().toLocaleTimeString(),
  };
}

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

export default function DocumentAnalyzer() {
  const [documents, setDocuments] = useState<AnalyzedDoc[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<AnalyzedDoc | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files);

    const newDocs: AnalyzedDoc[] = fileArray.map((file, i) => ({
      id: `doc-${Date.now()}-${i}`,
      name: file.name,
      size: `${Math.round(file.size / 1024)} KB`,
      type: file.type || "application/octet-stream",
      status: "analyzing" as DocStatus,
      score: 0,
      issues: [],
      summary: "",
    }));

    setDocuments((prev) => [...newDocs, ...prev]);

    fileArray.forEach((file, i) => {
      const delay = 1500 + Math.random() * 2500;
      setTimeout(() => {
        const analyzed = generateMockAnalysis(file, i);
        analyzed.id = newDocs[i].id;
        setDocuments((prev) =>
          prev.map((d) => (d.id === newDocs[i].id ? analyzed : d))
        );
      }, delay);
    });
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        processFiles(e.dataTransfer.files);
      }
    },
    [processFiles]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        processFiles(e.target.files);
        e.target.value = "";
      }
    },
    [processFiles]
  );

  const loadDemo = useCallback(() => {
    const demoFiles: AnalyzedDoc[] = [
      {
        id: `demo-${Date.now()}-0`, name: "Q3-Financial-Statement.pdf", size: "2.4 MB", type: "application/pdf",
        status: "analyzing", score: 0, issues: [], summary: "",
      },
      {
        id: `demo-${Date.now()}-1`, name: "KYC-Verification-ClientA.pdf", size: "840 KB", type: "application/pdf",
        status: "analyzing", score: 0, issues: [], summary: "",
      },
      {
        id: `demo-${Date.now()}-2`, name: "Insurance-Policy-MC445.pdf", size: "1.1 MB", type: "application/pdf",
        status: "analyzing", score: 0, issues: [], summary: "",
      },
      {
        id: `demo-${Date.now()}-3`, name: "Board-Resolution-2024.doc", size: "560 KB", type: "application/msword",
        status: "analyzing", score: 0, issues: [], summary: "",
      },
      {
        id: `demo-${Date.now()}-4`, name: "Tax-Return-FY2024.xlsx", size: "3.2 MB", type: "application/vnd.ms-excel",
        status: "analyzing", score: 0, issues: [], summary: "",
      },
      {
        id: `demo-${Date.now()}-5`, name: "Loan-Agreement-Draft.pdf", size: "1.8 MB", type: "application/pdf",
        status: "analyzing", score: 0, issues: [], summary: "",
      },
    ];

    const demoResults: Partial<AnalyzedDoc>[] = [
      {
        status: "pass", score: 96,
        summary: "Fully compliant regulatory filing. All required fields present, signatures valid, dates current.",
        issues: [{ severity: "info", title: "All checks passed", detail: "Document meets all compliance requirements. No issues found." }],
      },
      {
        status: "warning", score: 74,
        summary: "KYC verification document with inconsistent entity naming. Recommend standardizing before submission.",
        issues: [
          { severity: "warning", title: "Low resolution scan", detail: "Page 4 scan quality is below 150 DPI. May cause readability issues during audit.", location: "Page 4" },
          { severity: "info", title: "Metadata missing", detail: "Document author and creation date are not embedded in file metadata." },
        ],
      },
      {
        status: "fail", score: 31,
        summary: "Insurance policy document — expired validity date and missing signature block require immediate attention before processing.",
        issues: [
          { severity: "error", title: "Missing signature", detail: "Document requires authorized signatory on page 3. Signature field is empty.", location: "Page 3, Section 4.2" },
          { severity: "error", title: "Expired date", detail: "The certification date has expired. Document was valid until 2024-12-31.", location: "Page 1, Header" },
          { severity: "warning", title: "Inconsistent naming", detail: "Company name appears as both 'Acme Corp' and 'ACME Corporation' across sections.", location: "Pages 2, 5, 8" },
        ],
      },
      {
        status: "pass", score: 92,
        summary: "Board resolution properly executed. All directors have signed, dates are current, and quorum was met.",
        issues: [{ severity: "info", title: "All checks passed", detail: "Document meets all compliance requirements. No issues found." }],
      },
      {
        status: "fail", score: 38,
        summary: "Tax return filing has critical calculation discrepancies. Revenue figures do not reconcile with supporting schedules.",
        issues: [
          { severity: "error", title: "Calculation discrepancy", detail: "Total revenue on page 2 (£842,000) does not match sum of quarterly figures (£831,400). Variance: £10,600.", location: "Page 2, Line 14" },
          { severity: "error", title: "Missing schedule", detail: "Schedule C (Capital Allowances) is referenced but not included in the filing.", location: "Page 5" },
        ],
      },
      {
        status: "warning", score: 68,
        summary: "Loan agreement draft has formatting issues and a clause referencing outdated regulatory framework. Review before execution.",
        issues: [
          { severity: "warning", title: "Outdated regulation reference", detail: "Clause 8.3 references FCA Handbook MCOB 11.6 which was superseded in Jan 2025.", location: "Page 7, Clause 8.3" },
          { severity: "warning", title: "Formatting inconsistency", detail: "Section numbering jumps from 5.4 to 5.6 — section 5.5 appears to be missing.", location: "Page 4" },
        ],
      },
    ];

    setDocuments(demoFiles);
    setSelectedDoc(null);

    demoFiles.forEach((doc, i) => {
      const delay = 800 + i * 600;
      setTimeout(() => {
        setDocuments((prev) =>
          prev.map((d) =>
            d.id === doc.id
              ? { ...d, ...demoResults[i], analyzedAt: new Date().toLocaleTimeString() }
              : d
          )
        );
      }, delay);
    });
  }, []);

  const passCount = documents.filter((d) => d.status === "pass").length;
  const warnCount = documents.filter((d) => d.status === "warning").length;
  const failCount = documents.filter((d) => d.status === "fail").length;
  const analyzingCount = documents.filter((d) => d.status === "analyzing").length;

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
              AI-Powered Compliance
            </div>
            <h1 className="text-[42px] leading-[1.1] font-black text-white tracking-tight mb-4">
              Document compliance<br />analysis engine
            </h1>
            <p className="text-base text-white/75 max-w-lg leading-relaxed font-medium">
              Upload your documents below. Our AI scans for missing signatures, expired dates,
              inconsistent data, and regulatory gaps — flagging problems in seconds.
            </p>
          </div>
        </div>

        <div className="px-10 py-8 max-w-5xl mx-auto">
          {/* Upload zone */}
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
              multiple
              onChange={handleFileSelect}
              className="hidden"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg"
            />
            <div className={`w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center ${isDragOver ? "bg-brand-blue" : "bg-brand-blue-50"} transition-colors`}>
              <Upload className={`w-7 h-7 ${isDragOver ? "text-white" : "text-brand-blue"} transition-colors`} />
            </div>
            <div className="text-base font-bold text-text-heading mb-1">
              {isDragOver ? "Drop files to analyze" : "Drag & drop documents here"}
            </div>
            <div className="text-sm text-text-muted mb-4">
              or click to browse
            </div>
            <div className="inline-flex items-center gap-1.5 text-[11px] text-text-muted bg-surface-muted px-3 py-1.5 rounded-full font-medium">
              PDF, DOC, XLS, CSV, images · up to 50MB each
            </div>
          </div>

          {/* Demo button */}
          {documents.length === 0 && (
            <div className="flex justify-center -mt-4 mb-8">
              <button
                onClick={(e) => { e.stopPropagation(); loadDemo(); }}
                className="flex items-center gap-2 px-5 py-2.5 bg-brand-blue text-white rounded-xl text-sm font-bold hover:bg-brand-blue-dark transition-colors shadow-md shadow-brand-blue/20"
              >
                <Sparkles className="w-4 h-4" />
                Load Demo Documents
              </button>
            </div>
          )}

          {/* Stats row */}
          {documents.length > 0 && (
            <div className="grid grid-cols-4 gap-4 mb-8">
              <StatCard icon={FileText} color="text-brand-blue" bg="bg-brand-blue-50" label="Total" value={documents.length.toString()} />
              <StatCard icon={CheckCircle2} color="text-status-pass" bg="bg-status-pass-bg" label="Passed" value={passCount.toString()} />
              <StatCard icon={AlertTriangle} color="text-status-warn" bg="bg-status-warn-bg" label="Warnings" value={warnCount.toString()} />
              <StatCard icon={XCircle} color="text-status-fail" bg="bg-status-fail-bg" label="Issues" value={failCount.toString()} />
            </div>
          )}

          {/* Results */}
          {documents.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-extrabold text-text-heading tracking-tight">Analysis Results</h2>
                {analyzingCount > 0 && (
                  <span className="flex items-center gap-2 text-xs text-brand-blue font-semibold">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Analyzing {analyzingCount} document{analyzingCount > 1 ? "s" : ""}…
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
                    <button
                      key={doc.id}
                      onClick={() => !isProcessing && setSelectedDoc(doc)}
                      disabled={isProcessing}
                      className={`w-full text-left bg-white border rounded-xl p-5 flex items-center gap-4 transition-all shadow-sm ${
                        isSelected
                          ? "border-brand-blue ring-2 ring-brand-blue/10 shadow-md"
                          : "border-border-soft hover:border-brand-blue-light hover:shadow-md"
                      } ${isProcessing ? "opacity-60 cursor-wait" : "cursor-pointer"}`}
                    >
                      <div className={`w-11 h-11 rounded-xl ${cfg.bg} flex items-center justify-center shrink-0`}>
                        <Icon className={`w-5 h-5 ${cfg.color} ${isProcessing ? "animate-spin" : ""}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-text-heading truncate">{doc.name}</div>
                        <div className="text-xs text-text-muted mt-0.5">{doc.size} · {doc.type.split("/").pop()?.toUpperCase()}</div>
                      </div>
                      {!isProcessing && (
                        <>
                          <span className={`text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
                            {cfg.label}
                          </span>
                          <div className="w-20 shrink-0 text-right">
                            <div className="text-lg font-extrabold text-text-heading">{doc.score}%</div>
                            <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden mt-1">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  doc.status === "pass" ? "bg-status-pass" : doc.status === "warning" ? "bg-status-warn" : "bg-status-fail"
                                }`}
                                style={{ width: `${doc.score}%` }}
                              />
                            </div>
                          </div>
                          <ArrowRight className="w-4 h-4 text-text-muted shrink-0" />
                        </>
                      )}
                      {isProcessing && (
                        <span className="text-xs text-brand-blue font-semibold">Processing…</span>
                      )}
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
        <div className="w-[400px] border-l border-border-soft bg-white overflow-y-auto shrink-0 shadow-xl">
          <div className="p-5 border-b border-border-soft flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-text-heading tracking-tight">Analysis Detail</h3>
            <button onClick={() => setSelectedDoc(null)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-surface-muted transition-colors">
              <X className="w-4 h-4 text-text-muted" />
            </button>
          </div>

          {/* Doc info + score */}
          <div className="p-5 border-b border-border-soft">
            <div className="flex items-start gap-3 mb-5">
              <div className="w-11 h-11 rounded-xl bg-brand-blue-50 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-brand-blue" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-text-heading truncate">{selectedDoc.name}</div>
                <div className="text-[11px] text-text-muted mt-0.5">{selectedDoc.size} · Analyzed at {selectedDoc.analyzedAt}</div>
              </div>
            </div>

            <div className="bg-surface-muted rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1">Compliance Score</div>
                  <div className="text-4xl font-black text-text-heading tracking-tight">{selectedDoc.score}%</div>
                </div>
                <div className={`w-14 h-14 rounded-2xl ${statusConfig[selectedDoc.status].bg} flex items-center justify-center`}>
                  {(() => {
                    const Ic = statusConfig[selectedDoc.status].icon;
                    return <Ic className={`w-7 h-7 ${statusConfig[selectedDoc.status].color}`} />;
                  })()}
                </div>
              </div>
              <div className="h-2.5 rounded-full bg-white overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    selectedDoc.status === "pass" ? "bg-status-pass" : selectedDoc.status === "warning" ? "bg-status-warn" : "bg-status-fail"
                  }`}
                  style={{ width: `${selectedDoc.score}%` }}
                />
              </div>
            </div>
          </div>

          {/* AI Summary */}
          <div className="p-5 border-b border-border-soft">
            <div className="flex items-center gap-2 mb-3">
              <Brain className="w-4 h-4 text-brand-blue" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">AI Summary</span>
            </div>
            <p className="text-sm text-text-body leading-relaxed">{selectedDoc.summary}</p>
          </div>

          {/* Issues */}
          <div className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <FileWarning className="w-4 h-4 text-status-warn" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
                Issues ({selectedDoc.issues.length})
              </span>
            </div>
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
                        {issue.location && (
                          <div className="text-[11px] text-text-muted mt-2 flex items-center gap-1 font-medium">
                            <Clock className="w-3 h-3" />
                            {issue.location}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recommendation */}
          {selectedDoc.status !== "pass" && (
            <div className="p-5 border-t border-border-soft">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-4 h-4 text-brand-blue" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Recommendation</span>
              </div>
              <div className="bg-brand-blue-50 border border-brand-blue-100 rounded-xl p-4">
                <p className="text-sm text-brand-blue-dark leading-relaxed font-medium">
                  {selectedDoc.status === "fail"
                    ? "This document has critical issues that must be resolved before it can be accepted. Please address all errors and re-upload."
                    : "This document has minor issues. Review the warnings and consider updating before final submission."}
                </p>
              </div>
            </div>
          )}
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
