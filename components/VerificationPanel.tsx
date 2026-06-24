import { CheckCircle2, CircleAlert, FlaskConical } from "lucide-react";
import type { Verification } from "@/lib/types";

const statusMap = {
  verified: {
    label: "CAS 已验证",
    className: "border-emerald-500/25 bg-emerald-500/8 text-emerald-300",
    icon: CheckCircle2,
  },
  partial: {
    label: "部分验证",
    className: "border-amber-500/25 bg-amber-500/8 text-amber-300",
    icon: CircleAlert,
  },
  manual: {
    label: "人工复核",
    className: "border-cyan-500/25 bg-cyan-500/8 text-cyan-300",
    icon: FlaskConical,
  },
};

export function VerificationPanel({ verification }: { verification: Verification }) {
  const state = statusMap[verification.status];
  const StatusIcon = state.icon;

  return (
    <div className={`border p-4 ${state.className}`}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <StatusIcon className="size-4" />
          {state.label}
        </div>
        <span className="font-mono text-[11px] uppercase tracking-wider opacity-70">
          {verification.engine}
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-zinc-300">{verification.statement}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {verification.checks.map((check) => (
          <span key={check} className="border border-white/10 bg-black/15 px-2 py-1 text-[11px] text-zinc-400">
            {check}
          </span>
        ))}
      </div>
      <div className="mt-4 grid gap-3 text-xs leading-5 text-zinc-300">
        <div className="border border-white/10 bg-black/15 p-3">
          <h4 className="font-bold text-emerald-300">已验证什么</h4>
          <ul className="mt-2 space-y-1.5">
            {verification.verifiedScope.map((item) => (
              <li key={item}>· {item}</li>
            ))}
          </ul>
        </div>
        <div className="border border-white/10 bg-black/15 p-3">
          <h4 className="font-bold text-amber-300">未验证什么</h4>
          <ul className="mt-2 space-y-1.5">
            {verification.unverifiedScope.map((item) => (
              <li key={item}>· {item}</li>
            ))}
          </ul>
        </div>
        <div className="border border-white/10 bg-black/15 p-3">
          <h4 className="font-bold text-cyan-300">为什么仍需人工审核</h4>
          <p className="mt-2">{verification.reviewNote}</p>
        </div>
      </div>
    </div>
  );
}
