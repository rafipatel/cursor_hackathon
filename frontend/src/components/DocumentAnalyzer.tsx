import { useState, useCallback, useRef } from "react";
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  Sparkles,
  X,
  ChevronRight,
  Brain,
  Shield,
  Clock,
  FileWarning,
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

const statusConfig: Record<DocStatus, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  uploading: { icon: Loader2, color: "text-accent-cyan", bg: "bg-accent-cyan/15", label: "Uploading" },
  analyzing: { icon: Loader2, color: "text-accent-purple", bg: "bg-accent-purple/15", label: "Analyzing" },
  pass: { icon: CheckCircle2, color: "text-accent-green", bg: "bg-accent-green/15", label: "Passed" },
  warning: { icon: AlertTriangle, color: "text-accent-yellow", bg: "bg-accent-yellow/15", label: "Warnings" },
  fail: { icon: XCircle, color: "text-accent-red", bg: "bg-accent-red/15", label: "Issues Found" },
};

const severityConfig = {
  error: { icon: XCircle, color: "text-accent-red", bg: "bg-accent-red/15", border: "border-accent-red/30" },
  warning: { icon: AlertTriangle, color: "text-accent-yellow", bg: "bg-accent-yellow/15", border: "border-accent-yellow/30" },
  info: { icon: CheckCircle2, color: "text-accent-cyan", bg: "bg-accent-cyan/15", border: "border-accent-cyan/30" },
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

  const analyzedDocs = documents.filter((d) => d.status !== "analyzing" && d.status !== "uploading");
  const passCount = documents.filter((d) => d.status === "pass").length;
  const warnCount = documents.filter((d) => d.status === "warning").length;
  const failCount = documents.filter((d) => d.status === "fail").length;
  const analyzingCount = documents.filter((d) => d.status === "analyzing").length;

  return (
    <div className="flex h-full">
      <div className="flex-1 p-6 overflow-y-auto">
        {/* Hero */}
        <div className="mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent-cyan/10 border border-accent-cyan/20 text-[10px] tracking-[0.15em] uppercase mb-4">
            <Sparkles className="w-3 h-3 text-accent-cyan" />
            <span className="text-accent-cyan">AI-Powered</span>
            <span className="text-text-muted">·</span>
            <span className="text-accent-green">Document Analysis</span>
            <span className="text-text-muted">·</span>
            <span className="text-accent-purple">Compliance Engine</span>
          </div>
          <h1 className="text-3xl font-bold mb-2">
            Upload documents for{" "}
            <span className="bg-gradient-to-r from-accent-cyan to-accent-green bg-clip-text text-transparent">
              instant compliance analysis
            </span>
          </h1>
          <p className="text-text-secondary text-sm max-w-[640px]">
            Drop your files below. Our AI engine scans for missing signatures, expired dates,
            inconsistent data, regulatory gaps, and formatting issues — flagging problems in seconds.
          </p>
        </div>

        {/* Upload zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all mb-6 ${
            isDragOver
              ? "border-accent-cyan bg-accent-cyan/5"
              : "border-border hover:border-border-light hover:bg-bg-card/50"
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
          <Upload className={`w-10 h-10 mx-auto mb-3 ${isDragOver ? "text-accent-cyan" : "text-text-muted"}`} />
          <div className="text-sm font-medium mb-1">
            {isDragOver ? "Drop files to analyze" : "Drag & drop documents here"}
          </div>
          <div className="text-xs text-text-muted">
            or click to browse · PDF, DOC, XLS, CSV, images · up to 50MB each
          </div>
        </div>

        {/* Stats row */}
        {documents.length > 0 && (
          <div className="grid grid-cols-4 gap-4 mb-6">
            <StatCard icon={FileText} color="text-accent-cyan" bg="bg-accent-cyan/15" label="Total Documents" value={documents.length.toString()} />
            <StatCard icon={CheckCircle2} color="text-accent-green" bg="bg-accent-green/15" label="Passed" value={passCount.toString()} />
            <StatCard icon={AlertTriangle} color="text-accent-yellow" bg="bg-accent-yellow/15" label="Warnings" value={warnCount.toString()} />
            <StatCard icon={XCircle} color="text-accent-red" bg="bg-accent-red/15" label="Issues Found" value={failCount.toString()} />
          </div>
        )}

        {/* Document list */}
        {documents.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold">Analysis Results</h2>
              {analyzingCount > 0 && (
                <span className="flex items-center gap-2 text-[11px] text-accent-purple">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Analyzing {analyzingCount} document{analyzingCount > 1 ? "s" : ""}…
                </span>
              )}
            </div>
            <div className="space-y-2">
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
                    className={`w-full text-left bg-bg-card border rounded-xl p-4 flex items-center gap-4 transition-all ${
                      isSelected
                        ? "border-accent-cyan/50 bg-accent-cyan/5"
                        : "border-border hover:border-border-light hover:bg-bg-card-hover"
                    } ${isProcessing ? "opacity-70 cursor-wait" : "cursor-pointer"}`}
                  >
                    <div className={`w-10 h-10 rounded-lg ${cfg.bg} flex items-center justify-center shrink-0`}>
                      <Icon className={`w-4 h-4 ${cfg.color} ${isProcessing ? "animate-spin" : ""}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{doc.name}</div>
                      <div className="text-[11px] text-text-muted">{doc.size} · {doc.type.split("/").pop()}</div>
                    </div>
                    {!isProcessing && (
                      <>
                        <div className="text-right shrink-0">
                          <span className={`text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full border ${cfg.bg} ${cfg.color} border-current/20`}>
                            {cfg.label}
                          </span>
                        </div>
                        <div className="w-16 shrink-0">
                          <div className="text-right text-sm font-bold font-mono">{doc.score}%</div>
                          <div className="h-1 rounded-full bg-border overflow-hidden mt-1">
                            <div
                              className={`h-full rounded-full ${
                                doc.status === "pass" ? "bg-accent-green" : doc.status === "warning" ? "bg-accent-yellow" : "bg-accent-red"
                              }`}
                              style={{ width: `${doc.score}%` }}
                            />
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-text-muted shrink-0" />
                      </>
                    )}
                    {isProcessing && (
                      <span className="text-[11px] text-accent-purple">Analyzing…</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Detail panel */}
      {selectedDoc && (
        <div className="w-[380px] border-l border-border bg-bg-sidebar overflow-y-auto shrink-0">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-accent-purple" />
              <span className="text-sm font-semibold">Analysis Detail</span>
            </div>
            <button onClick={() => setSelectedDoc(null)} className="w-6 h-6 rounded flex items-center justify-center hover:bg-bg-card transition-colors">
              <X className="w-4 h-4 text-text-muted" />
            </button>
          </div>

          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-3 mb-3">
              <FileText className="w-5 h-5 text-accent-cyan" />
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{selectedDoc.name}</div>
                <div className="text-[10px] text-text-muted">{selectedDoc.size} · Analyzed at {selectedDoc.analyzedAt}</div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="text-[10px] tracking-[0.12em] uppercase text-text-muted mb-1">Compliance Score</div>
                <div className="text-2xl font-bold font-mono">{selectedDoc.score}%</div>
              </div>
              <div className={`w-12 h-12 rounded-xl ${statusConfig[selectedDoc.status].bg} flex items-center justify-center`}>
                {(() => {
                  const Ic = statusConfig[selectedDoc.status].icon;
                  return <Ic className={`w-6 h-6 ${statusConfig[selectedDoc.status].color}`} />;
                })()}
              </div>
            </div>
            <div className="h-2 rounded-full bg-border overflow-hidden mt-3">
              <div
                className={`h-full rounded-full transition-all ${
                  selectedDoc.status === "pass" ? "bg-accent-green" : selectedDoc.status === "warning" ? "bg-accent-yellow" : "bg-accent-red"
                }`}
                style={{ width: `${selectedDoc.score}%` }}
              />
            </div>
          </div>

          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-1.5 mb-2">
              <Brain className="w-3 h-3 text-accent-purple" />
              <span className="text-[10px] tracking-[0.12em] uppercase text-text-muted">AI Summary</span>
            </div>
            <p className="text-xs text-text-secondary leading-relaxed">{selectedDoc.summary}</p>
          </div>

          <div className="p-4">
            <div className="flex items-center gap-1.5 mb-3">
              <FileWarning className="w-3 h-3 text-accent-orange" />
              <span className="text-[10px] tracking-[0.12em] uppercase text-text-muted">
                Issues ({selectedDoc.issues.length})
              </span>
            </div>
            <div className="space-y-2">
              {selectedDoc.issues.map((issue, i) => {
                const cfg = severityConfig[issue.severity];
                const Ic = cfg.icon;
                return (
                  <div key={i} className={`${cfg.bg} border ${cfg.border} rounded-lg p-3`}>
                    <div className="flex items-start gap-2">
                      <Ic className={`w-3.5 h-3.5 ${cfg.color} shrink-0 mt-0.5`} />
                      <div>
                        <div className="text-xs font-medium">{issue.title}</div>
                        <div className="text-[11px] text-text-secondary mt-1 leading-relaxed">{issue.detail}</div>
                        {issue.location && (
                          <div className="text-[10px] text-text-muted mt-1.5 flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
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

          {selectedDoc.status !== "pass" && (
            <div className="p-4 border-t border-border">
              <div className="flex items-center gap-1.5 mb-2">
                <Shield className="w-3 h-3 text-accent-cyan" />
                <span className="text-[10px] tracking-[0.12em] uppercase text-text-muted">Recommendation</span>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed">
                {selectedDoc.status === "fail"
                  ? "This document has critical issues that must be resolved before it can be accepted. Please address all errors and re-upload."
                  : "This document has minor issues. Review the warnings and consider updating before final submission."}
              </p>
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
    <div className="bg-bg-card border border-border rounded-xl p-4 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <div>
        <div className="text-[10px] tracking-[0.12em] uppercase text-text-muted">{label}</div>
        <div className="text-xl font-bold font-mono">{value}</div>
      </div>
    </div>
  );
}
