import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type BadgeTone =
  "neutral" | "accent" | "success" | "warning" | "danger" | "violet";

const toneClass: Record<BadgeTone, string> = {
  neutral: "border-white/10 bg-white/[0.03] text-zinc-400",
  accent: "border-cyan-400/30 bg-cyan-400/[0.06] text-cyan-300",
  success: "border-emerald-500/35 bg-emerald-500/[0.07] text-emerald-300",
  warning: "border-amber-400/35 bg-amber-400/[0.07] text-amber-300",
  danger: "border-red-500/35 bg-red-500/[0.07] text-red-300",
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
