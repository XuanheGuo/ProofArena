import type { TagMatch } from "@/lib/types";

export const tagKnowledgeMap: Record<string, string[]> = {
  三角函数: ["k-phase-transform"],
  周期与最值: ["k-phase-transform", "k-function-extremum", "k-local-vs-global-extremum"],
  极值: ["k-local-vs-global-extremum", "k-function-extremum"],
  最值: ["k-local-vs-global-extremum", "k-function-extremum"],
  二倍角: ["k-phase-transform"],
  辅助角: ["k-trig-transform", "k-phase-transform"],
  三角恒等变形: ["k-trig-transform"],
  三角恒等式: ["k-trig-transform"],
  立体几何: ["k-space-vector", "k-geometric-reduction"],
  空间向量: ["k-space-vector"],
  平面向量: ["k-plane-vector"],
  向量: ["k-plane-vector", "k-space-vector"],
  二面角: ["k-space-vector"],
  辅助线: ["k-geometric-reduction"],
  圆锥曲线: ["k-conic-parameter", "k-line-conic"],
  椭圆: ["k-conic-parameter", "k-line-conic"],
  双曲线: ["k-conic-parameter", "k-line-conic", "k-hyperbola-focal-triangle"],
  抛物线: ["k-conic-parameter", "k-line-conic"],
  离心率: ["k-conic-parameter", "k-hyperbola-focal-triangle"],
  焦点弦: ["k-focal-chord-ellipse", "k-line-conic"],
  焦半径: ["k-focal-chord-ellipse"],
  参数法: ["k-line-conic", "k-conic-parameter"],
  轨迹: ["k-trajectory-classification", "k-conic-parameter"],
  曲线分类: ["k-trajectory-classification"],
  仿射: ["k-affine-transform"],
  均值不等式: ["k-basic-inequality"],
  直线与圆: ["k-line-conic"],
  弦中点: ["k-conic-midpoint-chord", "k-line-conic"],
  点差法: ["k-conic-midpoint-chord"],
  面积最值: ["k-conic-area-range", "k-function-extremum"],
  范围问题: ["k-conic-area-range", "k-function-extremum"],
  数列: ["k-sequence-counting", "k-block-summation", "k-telescoping-sum", "k-offset-subtraction"],
  递推: ["k-recursive-sequence", "k-induction-proof"],
  递推数列: ["k-recursive-sequence"],
  数学归纳法: ["k-induction-proof"],
  集合计数: ["k-sequence-counting"],
  分块求和: ["k-block-summation", "k-telescoping-sum", "k-offset-subtraction"],
  裂项相消: ["k-telescoping-sum"],
  错位相减: ["k-offset-subtraction"],
  导数: ["k-derivative-inequality"],
  零点: ["k-derivative-zero"],
  双根: ["k-derivative-zero", "k-vieta-root-relation"],
  参数: ["k-parameter-separation", "k-derivative-zero"],
  分离参数: ["k-parameter-separation"],
  根的关系: ["k-vieta-root-relation"],
  根的乘积: ["k-vieta-root-relation"],
  函数不等式: ["k-derivative-inequality"],
  对数不等式: ["k-log-inequality", "k-derivative-inequality"],
  指数不等式: ["k-log-inequality", "k-derivative-inequality"],
  乘积估计: ["k-product-estimation"],
  概率统计: ["k-probability-modeling", "k-event-relation-boundary"],
  排列组合: ["k-counting-combinatorics"],
  概率: ["k-probability-modeling", "k-counting-combinatorics", "k-event-relation-boundary"],
  独立事件: ["k-event-relation-boundary"],
  互斥事件: ["k-event-relation-boundary"],
  分布列: ["k-random-variable"],
  数学期望: ["k-random-variable"],
  统计图表: ["k-statistics-regression"],
  回归分析: ["k-statistics-regression"],
  复数: ["k-complex-number-geometry"],
  标准解: [],
  启发解: [],
  稳健解: [],
  教学解: [],
};

export const tagInsightMap: Record<string, string[]> = {
  三角函数: ["i-phase-first"],
  周期与最值: ["i-phase-first"],
  辅助角: ["i-trig-a-sin-b-cos"],
  三角恒等变形: ["i-trig-a-sin-b-cos"],
  立体几何: ["i-coordinate-on-box", "i-project-to-plane"],
  空间向量: ["i-coordinate-on-box"],
  平面向量: ["i-vector-dot-zero"],
  向量: ["i-vector-dot-zero"],
  辅助线: ["i-project-to-plane"],
  圆锥曲线: ["i-target-variable", "i-tangent-condition"],
  椭圆: ["i-target-variable"],
  双曲线: ["i-target-variable", "i-eccentricity-from-isosceles"],
  离心率: ["i-eccentricity-from-isosceles"],
  焦点弦: ["i-center-symmetry-chord", "i-focal-chord-param"],
  参数法: ["i-target-variable", "i-focal-chord-param"],
  轨迹: ["i-trajectory-type-coefficient"],
  曲线分类: ["i-trajectory-type-coefficient"],
  仿射: ["i-affine-ellipse-to-circle"],
  均值不等式: ["i-am-gm-equal-condition"],
  抛物线: ["i-target-variable"],
  直线与圆: ["i-tangent-condition"],
  弦中点: ["i-midpoint-chord"],
  点差法: ["i-midpoint-chord"],
  面积最值: ["i-area-to-distance"],
  范围问题: ["i-area-to-distance"],
  数列: ["i-count-by-sources", "i-block-at-powers"],
  递推: ["i-recursive-difference", "i-induction-any-n"],
  递推数列: ["i-recursive-difference"],
  数学归纳法: ["i-induction-any-n"],
  集合计数: ["i-count-by-sources"],
  分块求和: ["i-block-at-powers"],
  导数: ["i-tangent-lower-bound"],
  零点: ["i-double-root-graph"],
  双根: ["i-double-root-graph", "i-vieta-product-target"],
  参数: ["i-separate-parameter"],
  分离参数: ["i-separate-parameter"],
  根的关系: ["i-vieta-product-target"],
  根的乘积: ["i-vieta-product-target"],
  函数不等式: ["i-tangent-lower-bound"],
  对数不等式: ["i-log-touch-tangent"],
  指数不等式: ["i-log-touch-tangent"],
  乘积估计: ["i-product-to-telescope"],
  排列组合: ["i-at-least-use-complement"],
  概率: ["i-at-least-use-complement"],
  分布列: ["i-random-variable-list-values"],
  数学期望: ["i-random-variable-list-values"],
  统计图表: ["i-statistics-check-units"],
  回归分析: ["i-statistics-check-units"],
  复数: ["i-complex-distance"],
  标准解: [],
  启发解: [],
  稳健解: [],
  教学解: [],
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
