import { Zap } from "lucide-react";

export default function Header() {
  return (
    <header className="relative h-26 bg-white/10 backdrop-blur-md flex items-center px-8 shrink-0 overflow-visible z-10 shadow-[0_1px_0_rgba(0,0,0,0.05)]">
      {/* Logo mark aligned with title text */}
      <div className="absolute left-8 top-1/2 -translate-y-1/2 w-[52px] h-[52px] rounded-2xl bg-gradient-to-br from-brand-blue to-brand-navy shadow-[0_14px_36px_rgba(26,39,68,0.38)] ring-[3px] ring-white flex items-center justify-center z-20">
        <Zap className="w-[22px] h-[22px] text-white" strokeWidth={2.5} />
      </div>

      {/* Brand text — offset to sit beside the floating mark */}
      <div className="pl-[72px]">
        <div className="font-display text-[18px] text-brand-navy leading-none tracking-tight">
          ComplAI
        </div>
        <div className="text-[9.5px] text-text-muted font-medium uppercase tracking-[0.2em] mt-[3px]">
          Document Compliance Engine
        </div>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-blue to-brand-navy text-white flex items-center justify-center text-[11px] font-semibold tracking-wide shadow-sm">
          OP
        </div>
      </div>
    </header>
  );
}
