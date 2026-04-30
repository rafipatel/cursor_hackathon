import { Zap, Settings } from "lucide-react";

export default function Header() {
  return (
    <header className="h-14 bg-bg-header border-b border-border flex items-center px-6 gap-4 shrink-0">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-accent-cyan/20 flex items-center justify-center">
          <Zap className="w-4 h-4 text-accent-cyan" />
        </div>
        <div>
          <div className="text-sm font-semibold">Adaptive AI Ops</div>
          <div className="text-[10px] text-text-muted">Document Compliance Engine</div>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <div className="flex items-center gap-2 text-[11px] text-text-muted">
          <Settings className="w-3.5 h-3.5" />
          <span className="font-mono">model: doc-analysis-v2 · 97% conf</span>
        </div>
        <div className="w-8 h-8 rounded-full bg-accent-purple flex items-center justify-center text-xs font-bold">
          OP
        </div>
      </div>
    </header>
  );
}
