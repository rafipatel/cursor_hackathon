import { Zap } from "lucide-react";

export default function Header() {
  return (
    <header className="h-16 bg-white border-b border-border-soft flex items-center px-8 shrink-0 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-brand-blue flex items-center justify-center">
          <Zap className="w-4 h-4 text-white" />
        </div>
        <div>
          <div className="text-sm font-bold text-text-heading tracking-tight">Adaptive AI Ops</div>
          <div className="text-[10px] text-text-muted font-medium uppercase tracking-widest">Document Compliance Engine</div>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-4">
        <div className="text-[11px] text-text-muted font-medium px-3 py-1.5 rounded-full bg-brand-blue-50 border border-brand-blue-100">
          Model: doc-analysis-v2 · 97% confidence
        </div>
        <div className="w-8 h-8 rounded-full bg-brand-blue text-white flex items-center justify-center text-xs font-bold">
          OP
        </div>
      </div>
    </header>
  );
}
