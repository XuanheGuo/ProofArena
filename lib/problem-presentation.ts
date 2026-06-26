import type { Difficulty } from "@/lib/types";

export const difficultyBadgeClass: Record<Difficulty, string> = {
  基础: "border-emerald-400/30 text-emerald-300",
  中档: "border-amber-400/30 text-amber-300",
  压轴: "border-red-400/30 text-red-300",
};
