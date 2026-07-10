import type { Difficulty } from "@/lib/types";

// Reads [data-theme] CSS variables directly (app/globals.css) rather than
// hardcoded Tailwind color literals, so it can't silently fall out of the
// light/dark override whitelist — see docs/UI_UX_AUDIT.md A2.
export const difficultyBadgeClass: Record<Difficulty, string> = {
  基础: "border-[var(--verified-border)] text-[var(--verified)]",
  中档: "border-[var(--contest-border)] text-[var(--contest)]",
  压轴: "border-[var(--danger-border)] text-[var(--danger)]",
};
