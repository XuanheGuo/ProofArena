import type { KnowledgeNode, Problem, Solution } from "@/lib/types";

type ConceptBoundaryFields = Pick<
  Problem,
  "conceptLinks" | "conceptContrasts" | "boundaryNotes" | "contrastProblems" | "whyNotMethods"
>;

export const conceptBoundaryDemoByProblemId: Record<string, ConceptBoundaryFields> = {
  "tj-2026-09": {
    conceptLinks: [
      {
        conceptId: "k-conic-parameter",
        label: "离心率目标变量",
        relation: "只追踪 $e=c/a$，不完整求参",
        note: "题目只问离心率，关键是尽早把长度关系改写成 $c/a$ 的方程。",
      },
      {
        conceptId: "k-line-conic",
        label: "坐标回代",
        relation: "用几何条件生成点，再代回曲线",
        note: "不是先盲目联立，而是先由等距和角度确定 $P$ 的坐标形态。",
      },
    ],
    conceptContrasts: [
      {
        conceptA: "焦点定义",
        conceptB: "反射性质",
        relationship: "都和圆锥曲线焦点有关，但触发条件完全不同。",
        keyDifference: "焦点定义只需要点在双曲线上；反射性质需要切线或光线反射条件。本题没有切线。",
        commonMistake: "看到焦点就套反射性质，忽略题目给的是等距三角形和角度。",
        exampleProblemIds: ["tj-2026-09", "tj-2026-18"],
      },
    ],
    boundaryNotes: [
      {
        title: "不要把焦点题都做成切线题",
        note: "本题的边界在 $|PF|$、$|PG|$ 和双曲线距离差，不在切线反射。补出右焦点是为了用定义，不是为了引入反射。",
        typicalMisuse: "用“光学性质”解释没有切线的题。",
      },
    ],
    contrastProblems: [
      {
        problemId: "tj-2026-18",
        role: "对比题",
        focus: "真正出现相切条件时如何使用距离公式",
        reason: "它能和本题形成边界：一个是焦点定义，一个是圆切线条件。",
      },
    ],
    whyNotMethods: [
      {
        methodName: "双曲线反射性质",
        reason: "反射性质依赖切线，本题没有切线、法线或反射路径，强行使用会引入不存在的条件。",
        whenItWouldWork: "题目明确给出切线、切点，或要求焦点光线反射路径。",
        relatedConcepts: ["焦点定义", "切线条件", "离心率"],
      },
    ],
  },
  "ng1-2026-18": {
    conceptLinks: [
      {
        conceptId: "k-line-conic",
        label: "焦点弦参数",
        relation: "一条过焦点直线控制两个交点",
        note: "设斜率或有向距离后，根和、根差比直接求两个点坐标更适合面积比。",
      },
      {
        conceptId: "k-conic-area-range",
        label: "面积与角度边界",
        relation: "面积可仿射保持，角度不能",
        note: "仿射圆化能保留共线和面积比，但最后的角度必须回原坐标计算。",
      },
    ],
    conceptContrasts: [
      {
        conceptA: "面积比",
        conceptB: "角度大小",
        relationship: "都来自同一组点，但在仿射变换下性质不同。",
        keyDifference: "面积比在同一仿射变换下保持；角度通常不保持，斜率会被坐标缩放改变。",
        commonMistake: "在圆化后的坐标里直接读角度最值，忘记回到椭圆原坐标。",
        exampleProblemIds: ["ng1-2026-18", "tj-2026-18"],
      },
    ],
    boundaryNotes: [
      {
        title: "仿射不是等距变换",
        note: "圆化法适合处理共线、比例、面积；一旦问题问角度、垂直或距离，就要追踪坐标伸缩后的变化。",
        typicalMisuse: "把圆中的直角直接当作椭圆中的直角。",
      },
    ],
    contrastProblems: [
      {
        problemId: "tj-2026-18",
        role: "相似题",
        focus: "斜率目标量消元",
        reason: "两题都适合把直线斜率作为主变量，但一个含面积比，一个含切线条件。",
      },
    ],
    whyNotMethods: [
      {
        methodName: "圆化后直接求角",
        reason: "仿射变换不保持角度，直接在单位圆中求 $\\angle PQR$ 会得到错误的原坐标角。",
        whenItWouldWork: "只问共线、交比、面积比，或变换本身是等距/相似变换。",
        relatedConcepts: ["仿射变换", "面积比", "角度"],
      },
    ],
  },
  "ng2-2026-18": {
    conceptLinks: [
      {
        conceptId: "k-conic-parameter",
        label: "二次曲线分类",
        relation: "看二次项系数符号和退化项",
        note: "轨迹方程出来后，椭圆/双曲线/抛物线由 $x^2,y^2$ 系数和一次项共同决定。",
      },
      {
        conceptId: "k-parameter-separation",
        label: "参数临界值",
        relation: "用 $t_0=\\pm\\sqrt2$ 划分形状",
        note: "参数临界值不是代数细节，而是曲线类型发生变化的边界。",
      },
    ],
    conceptContrasts: [
      {
        conceptA: "轨迹方程",
        conceptB: "参数方程",
        relationship: "一个描述点集整体，一个描述点如何生成。",
        keyDifference: "轨迹方程适合分类和配方；参数方程适合理解运动来源，但最后仍要消参判断形状。",
        commonMistake: "只写出参数表达就停止，没有说明删点、中心和曲线类型。",
        exampleProblemIds: ["ng2-2026-18", "ng1-2026-18"],
      },
    ],
    boundaryNotes: [
      {
        title: "删点条件也是轨迹的一部分",
        note: "$y\\ne0$ 来自题设 $A$ 不在 $x$ 轴上，不能在消元后丢掉。轨迹方程和限制条件共同定义点集。",
        typicalMisuse: "只看二次方程，忘记原变量限制带来的删点。",
      },
    ],
    contrastProblems: [
      {
        problemId: "ng1-2026-18",
        role: "对比题",
        focus: "同样参数化，但目标是面积与角度",
        reason: "它提醒读者：参数法服务目标，不同目标需要不同保留量。",
      },
    ],
    whyNotMethods: [
      {
        methodName: "只按标准二次曲线背结论",
        reason: "本题有参数 $t_0$ 和删点条件，不能只看到二次项就草率定型。",
        whenItWouldWork: "方程无额外限制，且二次项、一次项和常数项已经配方到标准形。",
        relatedConcepts: ["轨迹方程", "曲线分类", "删点条件"],
      },
    ],
  },
  "tj-2026-16": {
    conceptLinks: [
      {
        conceptId: "k-phase-transform",
        label: "整体相位",
        relation: "把复合角先当成一个变量",
        note: "周期、单调区间和区间最值都先落到相位范围，而不是直接套振幅结论。",
      },
      {
        conceptId: "k-function-extremum",
        label: "区间最值",
        relation: "限制定义域后的全局比较",
        note: "本题第（2）问不是问三角函数全部取值，而是问相位区间内能到哪里。",
      },
    ],
    conceptContrasts: [
      {
        conceptA: "极值",
        conceptB: "最值",
        relationship: "都在描述函数取值的高低，但比较范围不同。",
        keyDifference: "极值只比较局部邻域；最值比较整个定义域或题目给定区间。最值可能出现在端点，极值不一定是最值。",
        commonMistake: "看到正弦函数就直接写最大值 1、最小值 -1，忽略题目只给了一个小区间。",
        exampleProblemIds: ["tj-2026-16", "tj-2026-20"],
      },
    ],
    boundaryNotes: [
      {
        title: "先问变量真正跑到哪里",
        note: "区间最值的边界不在原函数名字上，而在变量范围上。本题要先把 $x$ 的区间映射成 $t=2x+\\dfrac\\pi6$ 的区间。",
        typicalMisuse: "把“函数最大值”误读成“正弦函数全局最大值”。",
      },
      {
        title: "端点不是补丁，是定义域的一部分",
        note: "闭区间最值必须比较端点；导数或单调性只是在帮你确定内部是否还需要找候选点。",
      },
    ],
    contrastProblems: [
      {
        problemId: "tj-2026-20",
        role: "边界题",
        focus: "导数临界点与端点比较",
        reason: "它能展示“局部极值”和“全局最值”在导数题里的分工。",
      },
      {
        problemId: "tj-2026-16",
        role: "相似题",
        focus: "小区间内的三角最值",
        reason: "同一题内第（2）问就是最短的边界样例。",
      },
    ],
    whyNotMethods: [
      {
        methodName: "直接用振幅判断最大最小",
        reason: "振幅只说明全定义域内可能达到的上下界，不保证给定小区间能取到 $1$ 或 $-1$。",
        whenItWouldWork: "当相位区间覆盖到 $\\dfrac\\pi2+2k\\pi$ 或 $-\\dfrac\\pi2+2k\\pi$ 等取极值位置时才可直接命中。",
        relatedConcepts: ["整体相位", "区间最值", "端点比较"],
      },
    ],
  },
  "tj-2026-17": {
    conceptLinks: [
      {
        conceptId: "k-space-vector",
        label: "空间向量坐标法",
        relation: "用坐标统一处理垂直、夹角、体积",
        note: "长方体三条棱天然正交，坐标法可以一套点坐标贯穿三问。",
      },
      {
        conceptId: "k-geometric-reduction",
        label: "空间问题降维",
        relation: "把隐藏垂直关系投影到底面",
        note: "辅助点路线更能解释为什么 $BD\\perp$ 平面 $CEF$，但夹角仍可能需要向量。",
      },
    ],
    conceptContrasts: [
      {
        conceptA: "线面垂直",
        conceptB: "线线垂直",
        relationship: "线面垂直通常通过平面内两条相交直线来证明。",
        keyDifference: "只证一条平面内直线垂直不够；必须证明该直线垂直于平面内两条相交直线。",
        commonMistake: "证明 $BD\\perp CE$ 后就直接写 $BD\\perp$ 平面 $CEF$。",
        exampleProblemIds: ["tj-2026-17"],
      },
    ],
    boundaryNotes: [
      {
        title: "坐标法稳，降维法解释结构",
        note: "考试中坐标法更稳；复盘时降维法能看出垂直关系不是碰巧算出来的，而是底面几何结构决定的。",
      },
    ],
    contrastProblems: [
      {
        problemId: "tj-2026-09",
        role: "迁移题",
        focus: "从几何条件转为可计算变量",
        reason: "一个在空间几何中坐标化，一个在圆锥曲线中坐标化，边界都在“何时值得坐标化”。",
      },
    ],
    whyNotMethods: [
      {
        methodName: "只凭图形直观看垂直",
        reason: "空间图形透视会误导，线面垂直需要严格的向量点积或两条相交线判定。",
        whenItWouldWork: "作为猜想入口可以；正式证明仍要落到判定定理或坐标计算。",
        relatedConcepts: ["线面垂直", "空间向量", "降维"],
      },
    ],
  },
  "tj-2026-18": {
    conceptLinks: [
      {
        conceptId: "k-line-conic",
        label: "直线与圆锥曲线联立",
        relation: "用切线确定直线，再处理交点",
        note: "相切条件先给出截距，椭圆联立再给交点或斜率方程。",
      },
      {
        conceptId: "k-conic-parameter",
        label: "椭圆参数确定",
        relation: "离心率和竖直弦长共同定方程",
        note: "第（1）问的参数确定是第（2）问所有斜率计算的地基。",
      },
    ],
    conceptContrasts: [
      {
        conceptA: "求交点坐标",
        conceptB: "设目标斜率",
        relationship: "都能得到斜率比，但计算路径不同。",
        keyDifference: "坐标法稳定直观；设目标斜率更贴近问题，但需要能控制消元。",
        commonMistake: "题目只问 $k_1/k_2$，却把所有坐标展开到底，增加出错面。",
        exampleProblemIds: ["tj-2026-18", "ng1-2026-18"],
      },
    ],
    boundaryNotes: [
      {
        title: "切线条件不是椭圆切线",
        note: "本题给的是直线与圆 $x^2+y^2=b^2$ 相切，不是与椭圆相切。切线距离公式要用圆心到直线距离。",
        typicalMisuse: "把圆的相切条件错套成椭圆判别式等于零。",
      },
    ],
    contrastProblems: [
      {
        problemId: "tj-2026-09",
        role: "对比题",
        focus: "没有切线时不能用切线性质",
        reason: "两题都含圆锥曲线，但本题真有相切条件，09 题没有。",
      },
    ],
    whyNotMethods: [
      {
        methodName: "椭圆切线判别式",
        reason: "直线与椭圆有两个交点 $P,Q$，并不是椭圆切线；相切对象是圆。",
        whenItWouldWork: "题目说直线与椭圆相切，或交点退化为一个切点。",
        relatedConcepts: ["圆切线", "椭圆交点", "斜率比"],
      },
    ],
  },
  "tj-2026-19": {
    conceptLinks: [
      {
        conceptId: "k-telescoping-sum",
        label: "裂项相消",
        relation: "把相邻项差累加成首尾差",
        note: "当一项能拆成 $g(n)-g(n+1)$ 时，求和会自然望远镜。",
      },
      {
        conceptId: "k-offset-subtraction",
        label: "错位相减",
        relation: "处理等差乘等比结构",
        note: "当通项含 $nq^n$ 或等差因子乘等比因子时，乘以公比再相减更自然。",
      },
    ],
    conceptContrasts: [
      {
        conceptA: "裂项相消",
        conceptB: "错位相减",
        relationship: "都是为了缩短数列求和，但触发结构不同。",
        keyDifference: "裂项适合能拆成相邻项差的结构；错位相减适合等差乘等比结构。",
        commonMistake: "看到求和就机械错位相减，结果原式根本没有稳定公比，反而制造更多项。",
        exampleProblemIds: ["tj-2026-19", "tj-2026-20"],
      },
    ],
    boundaryNotes: [
      {
        title: "先看相邻差，还是先看公比",
        note: "能写成 $g(n)-g(n+1)$ 的，优先裂项；能写成 $(an+b)q^n$ 的，优先错位相减。",
        typicalMisuse: "把取整、分块边界题硬套等比求和模板。",
      },
    ],
    contrastProblems: [
      {
        problemId: "tj-2026-20",
        role: "迁移题",
        focus: "望远镜乘积与指数边界",
        reason: "它把“相邻项抵消”的直觉从求和迁移到连乘积放缩。",
      },
    ],
    whyNotMethods: [
      {
        methodName: "错位相减",
        reason: "本题核心在集合来源、取整和分块边界，不存在固定公比驱动的一串等比项。",
        whenItWouldWork: "若通项形如 $(an+b)q^n$，或求和对象可以整体乘公比后大面积对齐。",
        relatedConcepts: ["裂项相消", "错位相减", "分块求和"],
      },
    ],
  },
  "tj-2026-20": {
    conceptLinks: [
      {
        conceptId: "k-derivative-inequality",
        label: "导数证明函数不等式",
        relation: "用切线和单调性证明每一项放缩",
        note: "第（2）问的单项不等式是后续连乘积估计的基础。",
      },
      {
        conceptId: "k-product-estimation",
        label: "连乘积放缩",
        relation: "把逐项不等式累乘成整体指数界",
        note: "最优指数来自 $f(1/k)$ 在 $0$ 附近的一阶增长，而不是粗略看函数大小。",
      },
    ],
    conceptContrasts: [
      {
        conceptA: "证明可行",
        conceptB: "证明最优",
        relationship: "一个说明某个指数能做到，一个说明再大就做不到。",
        keyDifference: "可行性通常靠逐项放缩或归纳；最优性需要增长阶、极限或反例序列。",
        commonMistake: "证明了 $a=1/3$ 可行后，就直接说最大值是 $1/3$，缺少不能更大的论证。",
        exampleProblemIds: ["tj-2026-20", "tj-2026-16"],
      },
    ],
    boundaryNotes: [
      {
        title: "局部展开看的是 $x=0$ 附近",
        note: "乘积里代入的是 $1/k$，决定指数的是 $f(x)$ 在 $x\\to0^+$ 的一阶项，不是 $x\\to\\infty$ 的增长。",
        typicalMisuse: "把 $f(k)$ 的增长直觉误用于 $f(1/k)$。",
      },
    ],
    contrastProblems: [
      {
        problemId: "tj-2026-19",
        role: "迁移题",
        focus: "相邻结构如何抵消",
        reason: "19 题在求和/分块里看边界，20 题在连乘积里看边界。",
      },
    ],
    whyNotMethods: [
      {
        methodName: "只做数值试探",
        reason: "数值只能猜指数，不能证明所有 $n$ 成立，更不能排除更大的 $a$。",
        whenItWouldWork: "用于发现猜想或检查答案；正式证明仍要给出放缩和最优性论证。",
        relatedConcepts: ["连乘积放缩", "最优常数", "局部展开"],
      },
    ],
  },
};

export const conceptBoundaryDemoByKnowledgeId: Record<string, ConceptBoundaryFields> = {
  "k-function-extremum": conceptBoundaryDemoByProblemId["tj-2026-16"],
  "k-probability-modeling": {
    conceptLinks: [
      {
        conceptId: "k-counting-combinatorics",
        label: "事件关系",
        relation: "先判断能否同时发生，再判断是否互相影响",
        note: "概率题中“不能同时发生”和“发生概率不受影响”是两类完全不同的条件。",
      },
    ],
    conceptContrasts: [
      {
        conceptA: "独立事件",
        conceptB: "互斥事件",
        relationship: "都描述两个事件之间的关系，但一个谈影响，一个谈能否同现。",
        keyDifference: "独立表示是否发生互不影响；互斥表示不能同时发生。非零概率事件不可能既互斥又独立。",
        commonMistake: "把“没有关系”理解成“不会同时发生”，从而把独立误判成互斥。",
        exampleProblemIds: ["tj-2026-19"],
      },
    ],
    boundaryNotes: [
      {
        title: "先算交集，再谈影响",
        note: "互斥看 $P(A\\cap B)=0$；独立看 $P(A\\cap B)=P(A)P(B)$。当 $P(A),P(B)$ 都非零时，两者不能同时成立。",
        typicalMisuse: "把抽签、选择、分类计数中的“不同类别”直接当成独立事件。",
      },
    ],
    contrastProblems: [
      {
        problemId: "tj-2026-19",
        role: "反例题",
        focus: "集合来源和重合关系",
        reason: "它提醒你先判断对象能否重合，再决定能否拆开计数。",
      },
    ],
    whyNotMethods: [
      {
        methodName: "按独立事件直接相乘",
        reason: "若两个事件互斥或共享条件约束，直接乘概率会把不存在的交集也算进去。",
        whenItWouldWork: "当题目明确给出独立重复试验，或能证明 $P(A\\cap B)=P(A)P(B)$。",
        relatedConcepts: ["独立事件", "互斥事件", "条件概率"],
      },
    ],
  },
  "k-block-summation": conceptBoundaryDemoByProblemId["tj-2026-19"],
  "k-sequence-counting": conceptBoundaryDemoByProblemId["tj-2026-19"],
  "k-telescoping-sum": conceptBoundaryDemoByProblemId["tj-2026-19"],
  "k-offset-subtraction": conceptBoundaryDemoByProblemId["tj-2026-19"],
};

export const conceptBoundaryDemoBySolutionId: Record<string, ConceptBoundaryFields> = {
  "tj16-phase": {
    conceptLinks: conceptBoundaryDemoByProblemId["tj-2026-16"].conceptLinks,
    boundaryNotes: [
      {
        title: "整体相位适用的边界",
        note: "这条解法适用，是因为 $2x+\\dfrac\\pi6$ 的相位范围可以完整追踪；如果题目给的是隐式约束，就要先转成相位可比较的范围。",
      },
    ],
    whyNotMethods: conceptBoundaryDemoByProblemId["tj-2026-16"].whyNotMethods,
  },
  "tj19-block": {
    conceptLinks: conceptBoundaryDemoByProblemId["tj-2026-19"].conceptLinks,
    conceptContrasts: conceptBoundaryDemoByProblemId["tj-2026-19"].conceptContrasts,
    whyNotMethods: conceptBoundaryDemoByProblemId["tj-2026-19"].whyNotMethods,
  },
};

export function mergeConceptBoundaryFields<T extends KnowledgeNode | Problem | Solution>(
  item: T,
  fields?: ConceptBoundaryFields
): T {
  if (!fields) return item;

  return {
    ...item,
    conceptLinks: item.conceptLinks ?? fields.conceptLinks,
    conceptContrasts: item.conceptContrasts ?? fields.conceptContrasts,
    boundaryNotes: item.boundaryNotes ?? fields.boundaryNotes,
    contrastProblems: item.contrastProblems ?? fields.contrastProblems,
    whyNotMethods: item.whyNotMethods ?? fields.whyNotMethods,
  };
}
