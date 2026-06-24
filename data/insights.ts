import type { InsightNode } from "@/lib/types";

export const insightNodes: InsightNode[] = [
  {
    id: "i-phase-first",
    title: "先看整体相位",
    trigger: "看到 $\\sin(\\omega x+\\varphi)$、区间最值或相位平移。",
    idea: "先令 $t=\\omega x+\\varphi$，把复合三角函数还原成标准图像问题。",
    appliesTo: ["三角函数最值", "周期判断", "相位区间映射"],
    relatedKnowledgeIds: ["k-phase-transform"],
    relatedProblemIds: ["tj-2026-16"],
    difficulty: "基础",
  },
  {
    id: "i-coordinate-on-box",
    title: "规则空间图形先坐标化",
    trigger: "长方体、棱柱、分点比例、夹角和体积同时出现。",
    idea: "建立统一坐标系，让证明垂直、求夹角和体积共用同一组向量。",
    appliesTo: ["立体几何", "线面垂直", "二面角", "三棱锥体积"],
    relatedKnowledgeIds: ["k-space-vector"],
    relatedProblemIds: ["tj-2026-17"],
    difficulty: "中档",
  },
  {
    id: "i-project-to-plane",
    title: "把空间关系压回底面",
    trigger: "空间垂直关系看不清，但底面数据很完整。",
    idea: "作投影点、辅助点或截面，把隐藏的直角和距离关系放回平面几何中观察。",
    appliesTo: ["空间几何证明", "面积距离法", "等体积"],
    relatedKnowledgeIds: ["k-geometric-reduction"],
    relatedProblemIds: ["tj-2026-17"],
    difficulty: "中档",
  },
  {
    id: "i-target-variable",
    title: "目标量是什么，就设什么",
    trigger: "题目最终只问斜率比、乘积、和式等目标量，而不是完整对象。",
    idea: "把目标量作为主变量，减少无关坐标或中间量，直接建立目标方程。",
    appliesTo: ["圆锥曲线斜率问题", "解析几何消元", "参数题"],
    relatedKnowledgeIds: ["k-line-conic"],
    relatedProblemIds: ["tj-2026-18"],
    difficulty: "中档",
  },
  {
    id: "i-tangent-condition",
    title: "切线条件先转距离",
    trigger: "给定直线斜率，并说明它与圆相切。",
    idea: "用圆心到直线距离等于半径确定截距，再进入曲线联立。",
    appliesTo: ["直线与圆", "圆锥曲线", "解析几何参数确定"],
    relatedKnowledgeIds: ["k-line-conic", "k-conic-parameter"],
    relatedProblemIds: ["tj-2026-18"],
    difficulty: "基础",
  },
  {
    id: "i-count-by-sources",
    title: "集合计数先拆来源",
    trigger: "两个数列、两个集合或多个规则生成同一批元素。",
    idea: "先判断是否重合，再分别计数，最后合并；不要把序列项数直接当集合元素个数。",
    appliesTo: ["数列并集", "集合计数", "取整函数"],
    relatedKnowledgeIds: ["k-sequence-counting"],
    relatedProblemIds: ["tj-2026-19"],
    difficulty: "中档",
  },
  {
    id: "i-block-at-powers",
    title: "按幂边界分块",
    trigger: "出现 $\\lfloor\\log_a n\\rfloor$、幂次阈值或阶梯变化。",
    idea: "找出函数在哪些区间保持不变，以幂边界分块或研究相邻增量。",
    appliesTo: ["分块求和", "取整函数", "交错和"],
    relatedKnowledgeIds: ["k-block-summation", "k-sequence-counting"],
    relatedProblemIds: ["tj-2026-19"],
    difficulty: "压轴",
  },
  {
    id: "i-tangent-lower-bound",
    title: "切线小问常是后续下界",
    trigger: "第一问求切线，第二问紧接着证明函数不等式。",
    idea: "把切线写成候选下界，构造差函数证明曲线在切线上方。",
    appliesTo: ["导数压轴", "函数不等式", "切线放缩"],
    relatedKnowledgeIds: ["k-derivative-inequality"],
    relatedProblemIds: ["tj-2026-20"],
    difficulty: "中档",
  },
  {
    id: "i-product-to-telescope",
    title: "连乘积找望远镜",
    trigger: "出现 $f(1)f(1/2)\\cdots f(1/n)$ 或逐项下界。",
    idea: "先给每项找可乘的下界，再尝试化成 $\\frac{k+1}{k}$ 这类能望远镜的结构。",
    appliesTo: ["连乘积", "最佳指数", "导数不等式"],
    relatedKnowledgeIds: ["k-product-estimation", "k-derivative-inequality"],
    relatedProblemIds: ["tj-2026-20"],
    difficulty: "压轴",
  },
];

export function getInsightNode(id: string) {
  return insightNodes.find((node) => node.id === id);
}

export function getInsightsByCategory(category: string) {
  return insightNodes.filter((node) => node.relatedKnowledgeIds.some((id) => id.startsWith(category)));
}
