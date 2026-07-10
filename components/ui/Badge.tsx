import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type BadgeTone =
  | "neutral"
  | "accent"
  | "success"
  | "verified"
  | "warning"
  | "contest"
  | "danger"
  | "violet";

// Tones read the [data-theme] CSS variables directly (app/globals.css) instead
// of hardcoded Tailwind color literals, so they can't fall out of sync with
// whatever shades the [data-theme] override list happens to whitelist — see
// docs/UI_UX_AUDIT.md A2. "success"/"verified" and "warning"/"contest" are
// the same underlying token under two names for call-site readability.
const toneClass: Record<BadgeTone, string> = {
  neutral: "border-white/10 bg-white/[0.03] text-zinc-400",
  accent:
    "border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent)]",
  success:
    "border-[var(--verified-border)] bg-[var(--verified-soft)] text-[var(--verified)]",
  verified:
    "border-[var(--verified-border)] bg-[var(--verified-soft)] text-[var(--verified)]",
  warning:
    "border-[var(--contest-border)] bg-[var(--contest-soft)] text-[var(--contest)]",
  contest:
    "border-[var(--contest-border)] bg-[var(--contest-soft)] text-[var(--contest)]",
  danger:
    "border-[var(--danger-border)] bg-[var(--danger-soft)] text-[var(--danger)]",
  violet: "border-violet-400/30 bg-violet-400/[0.06] text-violet-300",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 border px-2 py-0.5 text-xs font-bold",
        toneClass[tone],
        className,
      )}
      {...props}
    />
  );
}
