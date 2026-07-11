export const captions = {
  book: "数学，不止有答案。",
  unfold: "一道题，不止一种解法。",
  arena: "同一道题，不同思路。",
  matrix: "正确，只是第一层。",
  graph: "从答案文本，到推理网络。",
  product: "阅读。比较。提交。挑战。",
  ending: "让数学推理进入竞技场。",
};

export const routeCards = [
  {
    label: "教学解",
    title: "从关键观察开始",
    detail: "先解释为什么这样想，再展开完整推理。",
    accent: "cyan",
  },
  {
    label: "几何解",
    title: "看见结构",
    detail: "把代数条件转成形状关系，边界自然出现。",
    accent: "amber",
  },
  {
    label: "代数解",
    title: "可复算、可验证",
    detail: "每一步都能检查，适合审核和迁移。",
    accent: "green",
  },
] as const;

export const metrics = ["正确性", "考场性", "结构美感", "计算量", "讲解友好"];

export const graphNodes = [
  "Observation",
  "Transformation",
  "Verification",
  "Boundary",
  "Challenge",
];
