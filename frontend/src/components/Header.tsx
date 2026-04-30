import { Shield } from "lucide-react";

export default function Header() {
  return (
    <header className="h-16 bg-white border-b border-border-soft flex items-center px-8 shrink-0 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-brand-blue flex items-center justify-center">
          <Shield className="w-4 h-4 text-white" />
        </div>
        <div>
          <div className="text-sm font-bold text-text-heading tracking-tight">MiFIR Rejection Engine</div>
          <div className="text-[10px] text-text-muted font-medium uppercase tracking-widest">FCA Regulatory Feedback Pipeline</div>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-4">
        <div className="text-[11px] text-text-muted font-medium px-3 py-1.5 rounded-full bg-brand-blue-50 border border-brand-blue-100">
          Cursor SDK Agent · Deterministic Fallback
        </div>
        <div className="w-8 h-8 rounded-full bg-brand-blue text-white flex items-center justify-center text-xs font-bold">
          RL
        </div>
      </div>
    </header>
  );
}
