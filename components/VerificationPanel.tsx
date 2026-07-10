import { CheckCircle2, CircleAlert, FlaskConical } from "lucide-react";
import { MathBlock } from "@/components/MathBlock";
import type { Verification, VerificationStatus } from "@/lib/types";

// className values read [data-theme] CSS variables directly (app/globals.css)
// rather than hardcoded Tailwind color literals, so they can't silently fall
// out of the light/dark override whitelist — see docs/UI_UX_AUDIT.md A2.
// Exported so compact verification badges (ProblemCard, SolutionCard,
// SolutionCompareCard) share the same status → label/icon/color mapping.
export const verificationStatusMeta: Record<
  VerificationStatus,
  { label: string; className: string; icon: typeof CheckCircle2 }
> = {
  verified: {
    label: "CAS 已验证",
    className:
      "border-[var(--verified-border)] bg-[var(--verified-soft)] text-[var(--verified)]",
    icon: CheckCircle2,
  },
  partial: {
    label: "部分验证",
    className:
      "border-[var(--contest-border)] bg-[var(--contest-soft)] text-[var(--contest)]",
    icon: CircleAlert,
  },
  manual: {
    label: "人工复核",
    className:
      "border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent)]",
    icon: FlaskConical,
  },
};

export function VerificationBadge({
  status,
  className,
}: {
  status: VerificationStatus;
  className?: string;
}) {
  const state = verificationStatusMeta[status];
  const StatusIcon = state.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 border px-1.5 py-0.5 text-[10px] font-bold ${state.className} ${className ?? ""}`}
    >
      <StatusIcon className="size-3" />
      {state.label}
    </span>
  );
}

export function VerificationPanel({
  verification,
}: {
  verification: Verification;
}) {
  const state = verificationStatusMeta[verification.status];
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
      <p className="mt-3 text-sm leading-6 text-zinc-300">
        <MathBlock>{verification.statement}</MathBlock>
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {verification.checks.map((check) => (
          <span
            key={check}
            className="border border-white/10 bg-black/15 px-2 py-1 text-[11px] text-zinc-400"
          >
            {check}
          </span>
        ))}
      </div>
      <div className="mt-4 grid gap-3 text-xs leading-5 text-zinc-300">
        <div className="border border-white/10 bg-black/15 p-3">
          <h4 className="font-bold text-emerald-300">已验证什么</h4>
          <ul className="mt-2 space-y-1.5">
            {verification.verifiedScope.map((item) => (
              <li key={item}>
                · <MathBlock>{item}</MathBlock>
              </li>
            ))}
          </ul>
        </div>
        <div className="border border-white/10 bg-black/15 p-3">
          <h4 className="font-bold text-amber-300">未验证什么</h4>
          <ul className="mt-2 space-y-1.5">
            {verification.unverifiedScope.map((item) => (
              <li key={item}>
                · <MathBlock>{item}</MathBlock>
              </li>
            ))}
          </ul>
        </div>
        <div className="border border-white/10 bg-black/15 p-3">
          <h4 className="font-bold text-cyan-300">为什么仍需人工审核</h4>
          <p className="mt-2">
            <MathBlock>{verification.reviewNote}</MathBlock>
          </p>
        </div>
      </div>
    </div>
  );
}
