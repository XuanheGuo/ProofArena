import type { TagMatch } from "@/lib/types";

export const tagKnowledgeMap: Record<string, string[]> = {
  三角函数: ["k-phase-transform"],
  周期与最值: ["k-phase-transform", "k-function-extremum"],
  二倍角: ["k-phase-transform"],
  立体几何: ["k-space-vector", "k-geometric-reduction"],
  空间向量: ["k-space-vector"],
  二面角: ["k-space-vector"],
  辅助线: ["k-geometric-reduction"],
  圆锥曲线: ["k-conic-parameter", "k-line-conic"],
  椭圆: ["k-conic-parameter", "k-line-conic"],
  直线与圆: ["k-line-conic"],
  数列: ["k-sequence-counting", "k-block-summation"],
  集合计数: ["k-sequence-counting"],
  分块求和: ["k-block-summation"],
  导数: ["k-derivative-inequality"],
  函数不等式: ["k-derivative-inequality"],
  乘积估计: ["k-product-estimation"],
  概率统计: ["k-probability-modeling"],
};

export const tagInsightMap: Record<string, string[]> = {
  三角函数: ["i-phase-first"],
  周期与最值: ["i-phase-first"],
  立体几何: ["i-coordinate-on-box", "i-project-to-plane"],
  空间向量: ["i-coordinate-on-box"],
  辅助线: ["i-project-to-plane"],
  圆锥曲线: ["i-target-variable", "i-tangent-condition"],
  椭圆: ["i-target-variable"],
  直线与圆: ["i-tangent-condition"],
  数列: ["i-count-by-sources", "i-block-at-powers"],
  集合计数: ["i-count-by-sources"],
  分块求和: ["i-block-at-powers"],
  导数: ["i-tangent-lower-bound"],
  函数不等式: ["i-tangent-lower-bound"],
  乘积估计: ["i-product-to-telescope"],
};

const normalizeTag = (tag: string) => tag.trim().replace(/^#/, "");

export function matchTagsToKnowledge(tags: string[]): TagMatch[] {
  return tags
    .map((tag): TagMatch | null => {
      const normalized = normalizeTag(tag);
      const matchedKnowledgeIds = tagKnowledgeMap[normalized] ?? [];
      const matchedInsightIds = tagInsightMap[normalized] ?? [];

      if (matchedKnowledgeIds.length === 0 && matchedInsightIds.length === 0) return null;

      const confidence = matchedKnowledgeIds.length > 0 && matchedInsightIds.length > 0 ? 0.86 : 0.72;

      return {
        tag: normalized,
        matchedKnowledgeIds,
        matchedInsightIds,
        confidence,
        source: "auto",
      };
    })
    .filter((match): match is TagMatch => Boolean(match));
}

export function mergeMatches(...groups: Array<TagMatch[] | undefined>) {
  const merged = new Map<string, TagMatch>();

  for (const group of groups) {
    for (const match of group ?? []) {
      const current = merged.get(match.tag);
      if (!current) {
        merged.set(match.tag, match);
        continue;
      }

      merged.set(match.tag, {
        ...current,
        matchedKnowledgeIds: [...new Set([...current.matchedKnowledgeIds, ...match.matchedKnowledgeIds])],
        matchedInsightIds: [...new Set([...current.matchedInsightIds, ...match.matchedInsightIds])],
        confidence: Math.max(current.confidence, match.confidence),
        source: current.source === "manual" || match.source === "manual" ? "manual" : "auto",
      });
    }
  }

  return [...merged.values()];
}
