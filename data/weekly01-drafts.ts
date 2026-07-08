import type { ContestAnswerType, LearningGuide, Problem } from "@/lib/types";

type Weekly01Draft = {
  id: string;
  year: number;
  region: Problem["region"];
  paper: string;
  number: string;
  difficulty: Problem["difficulty"];
  questionType: Problem["questionType"];
  tags: string[];
  title: string;
  statement: string[];
  answer: string;
  sourcePdf: string;
  sourcePage: number;
  learningGuide: LearningGuide;
  notes: string;
};

export type Weekly01SprintAnswerKey = {
  draftProblemId: string;
  answerType: ContestAnswerType;
  answerKey: string[];
  formatNote: string;
};

const sourcePdf = "https://pan.baidu.com/s/1jADsDvOVIkFvTOYNJspRkg?pwd=6666";

function guide(tags: string[], recommendation: string): LearningGuide {
  return {
    observation: [
      "先找目标量，不要把所有条件一上来全部展开。",
      "至少保留两条路线：考场稳定算法，以及能解释结构的短路线。",
      "提交时写清等价转化和边界情况，比只给答案更重要。",
    ],
    triggers: tags.slice(0, 4),
    pitfalls: [
      "忽略定义域、端点或正负条件。",
      "把必要条件当充分条件。",
      "只写计算过程，不解释为什么覆盖了所有情况。",
    ],
    readingPath: ["先完成标准路线", "再找结构观察", "最后比较两条路线的适用边界"],
    recommendation,
  };
}

// 2026-07-08 校对说明：全部 28 道题的题干均已补成完整、可独立作答的版本，
// 每道题的 answer 字段都带有至少一种完整分步解析（比赛进行中仅管理员可见，
// 赛后随题目页公开）。原先标记"待发布前按原卷复核"的普通题/挑战题因无法获取
// 原卷图片，已按对应区县卷的题型与知识点自拟改编并完整验算，number 字段注明。
function draft(input: Omit<Weekly01Draft, "year" | "region" | "sourcePdf" | "learningGuide" | "notes"> & { note?: string }): Weekly01Draft {
  return {
    ...input,
    year: 2026,
    region: "天津模考题",
    sourcePdf,
    learningGuide: guide(input.tags, "Weekly 01 草稿题：优先用于比赛，不进入公开题库；赛后可按选手优秀解法再补 Proof Graph。"),
    notes: input.note ?? "从 2024-2026 天津各区高三模考题中筛选整理/改编；题干与解析已于 2026-07-08 完整校对。",
  };
}

const authoredNote = "按对应天津一模卷的题型与知识点自拟改编（非原题），题干、答案与解析已于 2026-07-08 完整验算校对。";

export const weekly01DraftProblems: Weekly01Draft[] = [
  draft({
    id: "pa-weekly01-s01",
    paper: "2026 天津十二校联考高三一模数学",
    number: "第 1 题改编",
    difficulty: "基础",
    questionType: "单选",
    tags: ["集合", "补集", "并集"],
    title: "集合运算速判",
    statement: ["已知全集 $U=\\{1,2,3,4,5,6\\}$，$A=\\{1,3,5\\}$，$B=\\{2,3,4\\}$，则 $(\\complement_U A)\\cup B$ 等于（ ）", "A. $\\{2,4,6\\}$；B. $\\{1,2,3,4,5\\}$；C. $\\{2,3,4,6\\}$；D. $\\{1,3,5\\}$。"],
    answer: "C。解析：$\\complement_U A=\\{2,4,6\\}$；再并上 $B=\\{2,3,4\\}$ 得 $(\\complement_U A)\\cup B=\\{2,3,4,6\\}$，故选 C。",
    sourcePage: 1,
  }),
  draft({
    id: "pa-weekly01-s02",
    paper: "2026 天津河西区高三一模数学",
    number: "第 2 题改编",
    difficulty: "基础",
    questionType: "单选",
    tags: ["充分必要条件", "指数函数", "不等式"],
    title: "指数不等式与充分必要条件",
    statement: ["设实数 $a,b$ 满足 $2^a>2^b$，则下列判断中正确的是（ ）", "A. $a>b$；B. $a>|b|$；C. $|a|>|b|$；D. $a-b>1$。"],
    answer: "A。解析：$y=2^x$ 在 $\\mathbb{R}$ 上严格递增，故 $2^a>2^b\\iff a>b$，A 正确。反例排除其余：取 $a=1,b=-2$，则 $a<|b|$、$|a|<|b|$，B、C 错；取 $a=0.5,b=0$，则 $a-b=0.5<1$，D 错。",
    sourcePage: 1,
  }),
  draft({
    id: "pa-weekly01-s03",
    paper: "2026 天津十二校联考高三一模数学",
    number: "第 2 题改编",
    difficulty: "基础",
    questionType: "单选",
    tags: ["充分必要条件", "倒数函数", "不等式"],
    title: "正数倒数差的方向",
    statement: ["设 $a>b>0$，则下列结论正确的是（ ）", "A. $\\dfrac1a>\\dfrac1b$；B. $a-b>\\dfrac1a-\\dfrac1b$；C. $a+b<\\dfrac1a+\\dfrac1b$；D. $ab<1$。"],
    answer: "B。解析：$\\dfrac1a-\\dfrac1b=\\dfrac{b-a}{ab}<0<a-b$，故 B 成立。A 与倒数函数在正半轴上的单调性相反，错；C、D 取 $a=2,b=1$：$a+b=3>\\dfrac1a+\\dfrac1b=\\dfrac32$，$ab=2>1$，均错。",
    sourcePage: 1,
  }),
  draft({
    id: "pa-weekly01-s04",
    paper: "2026 天津河西区高三一模数学",
    number: "第 10 题改编",
    difficulty: "基础",
    questionType: "填空",
    tags: ["复数", "模长", "代数运算"],
    title: "复数模长速算",
    statement: ["已知复数 $z$ 满足 $z(1-i)=3+i$，则 $|z|=$____。"],
    answer: "$\\sqrt5$。解析：$z=\\dfrac{3+i}{1-i}=\\dfrac{(3+i)(1+i)}{(1-i)(1+i)}=\\dfrac{2+4i}{2}=1+2i$，所以 $|z|=\\sqrt{1^2+2^2}=\\sqrt5$。另法：两边取模，$|z|\\cdot|1-i|=|3+i|$，即 $|z|=\\dfrac{\\sqrt{10}}{\\sqrt2}=\\sqrt5$。",
    sourcePage: 5,
  }),
  draft({
    id: "pa-weekly01-s05",
    paper: "2026 天津河西区高三一模数学",
    number: "第 11 题改编",
    difficulty: "基础",
    questionType: "填空",
    tags: ["二项式定理", "常数项"],
    title: "二项展开式常数项",
    statement: ["$(x-\\dfrac1{2x})^6$ 的展开式中的常数项为____。"],
    answer: "$-\\dfrac{5}{2}$。解析：通项 $T_{k+1}=\\binom6k x^{6-k}\\left(-\\dfrac1{2x}\\right)^k=\\binom6k\\left(-\\dfrac12\\right)^k x^{6-2k}$。令 $6-2k=0$ 得 $k=3$，常数项为 $\\binom63\\left(-\\dfrac12\\right)^3=20\\times\\left(-\\dfrac18\\right)=-\\dfrac52$。",
    sourcePage: 5,
  }),
  draft({
    id: "pa-weekly01-s06",
    paper: "2026 天津河西区高三一模数学",
    number: "第 12 题改编",
    difficulty: "基础",
    questionType: "填空",
    tags: ["直线与圆", "弦长", "点到直线距离"],
    title: "圆的弦长",
    statement: ["直线 $x-y=2$ 被圆 $x^2+y^2=8$ 截得的弦长为____。"],
    answer: "$2\\sqrt6$。解析：圆心 $O(0,0)$ 到直线 $x-y-2=0$ 的距离 $d=\\dfrac{|-2|}{\\sqrt2}=\\sqrt2$，半径 $r=2\\sqrt2$，弦长 $=2\\sqrt{r^2-d^2}=2\\sqrt{8-2}=2\\sqrt6$。",
    sourcePage: 5,
  }),
  draft({
    id: "pa-weekly01-s07",
    paper: "2026 天津和平区高三一模数学",
    number: "第 10 题改编",
    difficulty: "基础",
    questionType: "填空",
    tags: ["复数", "共轭复数"],
    title: "复数除法与共轭",
    statement: ["设 $z=\\dfrac{3+i}{1+i}$，则 $\\overline z=$____。"],
    answer: "$2+i$。解析：$z=\\dfrac{(3+i)(1-i)}{(1+i)(1-i)}=\\dfrac{3-3i+i+1}{2}=\\dfrac{4-2i}{2}=2-i$，故 $\\overline z=2+i$。",
    sourcePage: 2,
  }),
  draft({
    id: "pa-weekly01-s08",
    paper: "2026 天津和平区高三一模数学",
    number: "第 11 题改编",
    difficulty: "基础",
    questionType: "填空",
    tags: ["二项式定理", "指定项系数"],
    title: "指定幂次的系数",
    statement: ["$(\\dfrac1{3x^2}+x)^6$ 的展开式中 $x^{-3}$ 的系数为____。"],
    answer: "$\\dfrac{20}{27}$。解析：通项 $T_{k+1}=\\binom6k\\left(\\dfrac1{3x^2}\\right)^{6-k}x^k=\\binom6k 3^{k-6}x^{3k-12}$。令 $3k-12=-3$ 得 $k=3$，系数为 $\\binom63\\cdot3^{-3}=\\dfrac{20}{27}$。",
    sourcePage: 2,
  }),
  draft({
    id: "pa-weekly01-s09",
    paper: "2026 天津和平区高三一模数学",
    number: "第 12 题改编",
    difficulty: "基础",
    questionType: "填空",
    tags: ["直线与圆", "参数范围", "距离"],
    title: "直线族与圆的位置关系",
    statement: ["若直线 $y=x+m$ 与圆 $x^2+y^2=8$ 相交，则参数 $m$ 满足 $|m|<$____。"],
    answer: "$4$。解析：相交等价于圆心到直线 $x-y+m=0$ 的距离小于半径：$\\dfrac{|m|}{\\sqrt2}<2\\sqrt2$，即 $|m|<4$。",
    sourcePage: 3,
  }),
  draft({
    id: "pa-weekly01-s10",
    paper: "2026 天津十二校联考高三一模数学",
    number: "第 10 题改编",
    difficulty: "基础",
    questionType: "填空",
    tags: ["复数", "虚部"],
    title: "复数虚部",
    statement: ["已知 $z(1-i)=3+i$，则 $z$ 的虚部为____。"],
    answer: "$2$。解析：$z=\\dfrac{3+i}{1-i}=\\dfrac{(3+i)(1+i)}{2}=\\dfrac{2+4i}{2}=1+2i$，虚部为 $2$（注意虚部是实数 $2$，不是 $2i$）。",
    sourcePage: 4,
  }),
  draft({
    id: "pa-weekly01-s11",
    paper: "2026 天津十二校联考高三一模数学",
    number: "第 11 题改编",
    difficulty: "基础",
    questionType: "填空",
    tags: ["二项式定理", "指定项系数"],
    title: "含根式二项式系数",
    statement: ["$(x-\\dfrac2{\\sqrt{x}})^6$ 的展开式中 $x^3$ 的系数为____。"],
    answer: "$60$。解析：通项 $T_{k+1}=\\binom6k x^{6-k}\\left(-\\dfrac2{\\sqrt x}\\right)^k=\\binom6k(-2)^k x^{6-\\frac{3k}2}$。令 $6-\\dfrac{3k}2=3$ 得 $k=2$，系数为 $\\binom62(-2)^2=15\\times4=60$。",
    sourcePage: 4,
  }),
  draft({
    id: "pa-weekly01-s12",
    paper: "2026 天津十二校联考高三一模数学",
    number: "第 12 题改编",
    difficulty: "基础",
    questionType: "填空",
    tags: ["抛物线", "圆", "弦长"],
    title: "抛物线焦半径与圆",
    statement: ["抛物线 $y^2=4x$ 上一点 $P$ 到焦点 $F$ 的距离为圆半径。若以 $P$ 为圆心的圆截 $y$ 轴所得弦长为 $6$，则该圆半径为____。"],
    answer: "$5$。解析：设 $P(x_0,y_0)$，由焦半径公式 $r=x_0+1$。$P$ 到 $y$ 轴距离为 $x_0$，由弦长 $2\\sqrt{r^2-x_0^2}=6$ 得 $r^2-x_0^2=9$，即 $(x_0+1)^2-x_0^2=2x_0+1=9$，$x_0=4$，$r=5$。",
    sourcePage: 4,
  }),
  draft({
    id: "pa-weekly01-s13",
    paper: "2026 天津河西区高三一模数学",
    number: "第 5 题改编",
    difficulty: "基础",
    questionType: "填空",
    tags: ["基本不等式", "最值"],
    title: "线性约束下乘积最值",
    statement: ["已知 $a,b>0$，且 $2a+b=1$，则 $ab$ 的最大值为____。"],
    answer: "$\\dfrac18$。解析：$ab=\\dfrac12(2a)b\\le\\dfrac12\\left(\\dfrac{2a+b}2\\right)^2=\\dfrac12\\cdot\\dfrac14=\\dfrac18$，当且仅当 $2a=b=\\dfrac12$（即 $a=\\dfrac14,b=\\dfrac12$）时取等。",
    sourcePage: 2,
  }),
  draft({
    id: "pa-weekly01-s14",
    paper: "天津模考风格原创补充",
    number: "计时题补充",
    difficulty: "基础",
    questionType: "填空",
    tags: ["等差数列", "前n项和", "方程"],
    title: "等差数列前项和速算",
    statement: ["等差数列 $\\{a_n\\}$ 满足 $a_1=1$，公差 $d=2$。若其前 $n$ 项和 $S_n=100$，则 $n=$____。"],
    answer: "$10$。解析：$S_n=na_1+\\dfrac{n(n-1)}2 d=n+n(n-1)=n^2$，由 $n^2=100$ 且 $n\\in\\mathbb{N}^*$ 得 $n=10$。",
    sourcePage: 2,
    note: "原创补充题，用于替换答案尚需复核的河西区一模数列速答候选题；风格按天津模考基础数列题设置。",
  }),
  draft({
    id: "pa-weekly01-s15",
    paper: "2026 天津河东区高三一模数学",
    number: "第 5 题改编",
    difficulty: "基础",
    questionType: "单选",
    tags: ["对数", "指数", "大小比较"],
    title: "指对数大小比较",
    statement: ["设 $a=\\log_{\\sqrt2}2$，$b=2^{\\sqrt2}$，$c=\\ln 30$，则下列大小关系正确的是（ ）", "A. $a<b<c$；B. $b<a<c$；C. $a<c<b$；D. $c<b<a$。"],
    answer: "A。解析：$a=\\log_{\\sqrt2}2=2$。因 $1<\\sqrt2<\\dfrac32$，故 $2=2^1<b=2^{\\sqrt2}<2^{3/2}=2\\sqrt2<3$；而 $c=\\ln30>\\ln e^3=3$（因 $e^3\\approx20.1<30$）。所以 $a<b<3<c$，选 A。",
    sourcePage: 2,
  }),
  draft({
    id: "pa-weekly01-d01",
    paper: "2026 天津和平区高三一模数学",
    number: "第 7 题风格改编（自拟）",
    difficulty: "中档",
    questionType: "解答",
    tags: ["圆锥曲线", "双曲线", "抛物线", "渐近线"],
    title: "双曲线、抛物线与渐近线",
    statement: [
      "已知双曲线 $C:\\ \\dfrac{y^2}{a^2}-\\dfrac{x^2}{b^2}=1\\ (a>0,\\ b>0)$ 的一个焦点与抛物线 $x^2=4\\sqrt3\\,y$ 的焦点重合，且 $C$ 的渐近线的斜率为 $\\pm\\sqrt2$。",
      "求双曲线 $C$ 的方程。",
    ],
    answer: "$\\dfrac{y^2}{2}-x^2=1$。解析：（1）抛物线 $x^2=4\\sqrt3 y$ 的焦点为 $(0,\\sqrt3)$（由 $x^2=2py$ 型，$2p=4\\sqrt3$，焦点 $(0,\\frac p2)=(0,\\sqrt3)$）。（2）该焦点在 $y$ 轴上，与 $\\dfrac{y^2}{a^2}-\\dfrac{x^2}{b^2}=1$ 的焦点位置一致，故 $c=\\sqrt3$，即 $a^2+b^2=3$。（3）此型双曲线的渐近线为 $y=\\pm\\dfrac ab x$，由斜率 $\\pm\\sqrt2$ 得 $a=\\sqrt2\\,b$，即 $a^2=2b^2$。（4）代入得 $3b^2=3$，$b^2=1$，$a^2=2$，所以 $C:\\ \\dfrac{y^2}2-x^2=1$。检验：$c^2=2+1=3$，焦点 $(0,\\pm\\sqrt3)$ 含 $(0,\\sqrt3)$；渐近线 $y=\\pm\\sqrt2 x$。",
    sourcePage: 2,
    note: authoredNote,
  }),
  draft({
    id: "pa-weekly01-d02",
    paper: "2026 天津和平区高三一模数学",
    number: "第 6 题风格改编（自拟）",
    difficulty: "中档",
    questionType: "解答",
    tags: ["立体几何", "线面垂直", "线面角", "空间向量"],
    title: "正三棱柱中的线面关系",
    statement: [
      "在正三棱柱 $ABC-A_1B_1C_1$ 中，底面边长为 $2$，侧棱 $AA_1=2$，$M$ 为 $BC$ 的中点。",
      "（1）证明：$AM\\perp$ 平面 $BCC_1B_1$；",
      "（2）求直线 $A_1M$ 与平面 $BCC_1B_1$ 所成角的正切值。",
    ],
    answer: "（1）证明：底面 $\\triangle ABC$ 为等边三角形，$M$ 为 $BC$ 中点，故 $AM\\perp BC$。正三棱柱中 $BB_1\\perp$ 底面 $ABC$，而 $AM\\subset$ 底面，故 $BB_1\\perp AM$。又 $BC\\cap BB_1=B$，两线都在平面 $BCC_1B_1$ 内，所以 $AM\\perp$ 平面 $BCC_1B_1$。（2）$\\tan\\theta=\\dfrac{\\sqrt3}2$。解析：设 $N$ 为 $B_1C_1$ 中点，与（1）同理 $A_1N\\perp$ 平面 $BCC_1B_1$，即 $A_1$ 在该平面上的射影为 $N$，故 $\\angle A_1MN$ 即所求线面角。$A_1N=AM=\\sqrt3$（边长 $2$ 的等边三角形中线），$MN=AA_1=2$，且 $A_1N\\perp MN$，所以 $\\tan\\theta=\\dfrac{A_1N}{MN}=\\dfrac{\\sqrt3}2$。坐标法核验：取 $B(0,0,0),C(2,0,0),A(1,\\sqrt3,0)$，则 $M(1,0,0),A_1(1,\\sqrt3,2)$，平面 $BCC_1B_1$ 为 $y=0$，$\\overrightarrow{MA_1}=(0,\\sqrt3,2)$，$\\sin\\theta=\\dfrac{\\sqrt3}{\\sqrt7}$，$\\tan\\theta=\\dfrac{\\sqrt3}2$。",
    sourcePage: 2,
    note: authoredNote,
  }),
  draft({
    id: "pa-weekly01-d03",
    paper: "2026 天津和平区高三一模数学",
    number: "第 14 题风格改编（自拟）",
    difficulty: "中档",
    questionType: "解答",
    tags: ["向量", "菱形", "数量积", "最值"],
    title: "菱形中的向量与最值",
    statement: [
      "在菱形 $ABCD$ 中，边长为 $2$，$\\angle BAD=60^\\circ$。",
      "（1）点 $E$ 在边 $BC$ 上，$\\overrightarrow{BE}=\\lambda\\overrightarrow{BC}$。若 $\\overrightarrow{AE}\\cdot\\overrightarrow{BD}=-1$，求 $\\lambda$ 的值；",
      "（2）点 $P$ 在对角线 $BD$ 上运动（含端点），求 $\\overrightarrow{PA}\\cdot\\overrightarrow{PC}$ 的最小值。",
    ],
    answer: "（1）$\\lambda=\\dfrac12$。解析：设 $\\vec b=\\overrightarrow{AB},\\ \\vec d=\\overrightarrow{AD}$，则 $|\\vec b|=|\\vec d|=2$，$\\vec b\\cdot\\vec d=2\\times2\\times\\cos60^\\circ=2$。$\\overrightarrow{AE}=\\vec b+\\lambda\\vec d$（因 $\\overrightarrow{BC}=\\vec d$），$\\overrightarrow{BD}=\\vec d-\\vec b$。故 $\\overrightarrow{AE}\\cdot\\overrightarrow{BD}=(\\vec b+\\lambda\\vec d)\\cdot(\\vec d-\\vec b)=\\vec b\\cdot\\vec d-|\\vec b|^2+\\lambda|\\vec d|^2-\\lambda\\,\\vec b\\cdot\\vec d=2-4+4\\lambda-2\\lambda=2\\lambda-2$。令 $2\\lambda-2=-1$ 得 $\\lambda=\\dfrac12$。（2）最小值 $-3$。解析：设两对角线交于 $O$，则 $O$ 为 $AC$、$BD$ 公共中点，$\\overrightarrow{OC}=-\\overrightarrow{OA}$。$\\overrightarrow{PA}\\cdot\\overrightarrow{PC}=(\\overrightarrow{PO}+\\overrightarrow{OA})\\cdot(\\overrightarrow{PO}+\\overrightarrow{OC})=|\\overrightarrow{PO}|^2-|\\overrightarrow{OA}|^2$。而 $|AC|^2=|\\vec b+\\vec d|^2=4+4+2\\times2=12$，故 $|OA|=\\sqrt3$。$P$ 可取到 $O$，此时 $|\\overrightarrow{PO}|=0$，故最小值为 $0-3=-3$。",
    sourcePage: 3,
    note: authoredNote,
  }),
  draft({
    id: "pa-weekly01-d04",
    paper: "2026 天津和平区高三一模数学",
    number: "第 15 题风格改编（自拟）",
    difficulty: "中档",
    questionType: "解答",
    tags: ["分段函数", "零点", "参数范围", "分类讨论"],
    title: "分段函数的零点个数",
    statement: [
      "设 $a\\in\\mathbb{R}$，函数 $f(x)=\\begin{cases}2^x-a, & x\\le 0,\\\\ (x-a)(x-2a), & x>0.\\end{cases}$",
      "若 $f(x)$ 恰有三个零点，求 $a$ 的取值范围。",
    ],
    answer: "$a\\in(0,1]$。解析：分两段计数。（1）左段 $x\\le0$：$2^x=a$。$2^x$ 在 $(-\\infty,0]$ 上的值域为 $(0,1]$，故 $0<a\\le1$ 时恰有一个零点 $x=\\log_2 a\\le0$；$a\\le0$ 或 $a>1$ 时无零点。（2）右段 $x>0$：$(x-a)(x-2a)=0$ 的根为 $x=a$ 与 $x=2a$。$a>0$ 时两根均为正且互异（$a\\ne2a$），两个零点；$a=0$ 时根 $x=0$ 不在 $x>0$ 内，无零点；$a<0$ 时两根为负，无零点。（3）合计：$a\\le0$ 时共 $0$ 个；$0<a\\le1$ 时共 $1+2=3$ 个；$a>1$ 时共 $0+2=2$ 个。故恰有三个零点当且仅当 $a\\in(0,1]$。边界检验：$a=1$ 时零点为 $x=0,1,2$，恰三个。",
    sourcePage: 3,
    note: authoredNote,
  }),
  draft({
    id: "pa-weekly01-d05",
    paper: "2026 天津河西区高三一模数学",
    number: "第 8 题风格改编（自拟）",
    difficulty: "中档",
    questionType: "解答",
    tags: ["圆锥曲线", "双曲线", "抛物线", "离心率"],
    title: "共焦点条件下的双曲线离心率",
    statement: [
      "已知双曲线 $\\dfrac{x^2}{a^2}-\\dfrac{y^2}{b^2}=1\\ (a>0,\\ b>0)$ 的右焦点 $F$ 与抛物线 $y^2=8x$ 的焦点重合，双曲线的两条渐近线与抛物线的准线交于 $A,B$ 两点，且 $|AB|=4\\sqrt3$。",
      "求双曲线的离心率。",
    ],
    answer: "$e=2$。解析：（1）抛物线 $y^2=8x$ 的焦点为 $(2,0)$，故 $c=2$；准线为 $x=-2$。（2）渐近线 $y=\\pm\\dfrac ba x$ 与 $x=-2$ 交于 $\\left(-2,\\mp\\dfrac{2b}a\\right)$，故 $|AB|=\\dfrac{4b}a$。（3）由 $\\dfrac{4b}a=4\\sqrt3$ 得 $b=\\sqrt3\\,a$，于是 $c^2=a^2+b^2=4a^2$，$e=\\dfrac ca=2$（由 $c=2$ 得 $a=1,b=\\sqrt3$，双曲线为 $x^2-\\dfrac{y^2}3=1$）。",
    sourcePage: 2,
    note: authoredNote,
  }),
  draft({
    id: "pa-weekly01-d06",
    paper: "2026 天津河西区高三一模数学",
    number: "第 9 题风格改编（自拟）",
    difficulty: "中档",
    questionType: "解答",
    tags: ["三角函数", "周期", "单调区间", "零点"],
    title: "三角函数的零点之和",
    statement: [
      "已知函数 $f(x)=2\\sin\\left(2x+\\dfrac{\\pi}{3}\\right)-1$。",
      "（1）求 $f(x)$ 的最小正周期与单调递增区间；",
      "（2）求 $f(x)$ 在 $[0,2\\pi]$ 上所有零点之和。",
    ],
    answer: "（1）最小正周期 $T=\\dfrac{2\\pi}2=\\pi$；由 $-\\dfrac\\pi2+2k\\pi\\le 2x+\\dfrac\\pi3\\le\\dfrac\\pi2+2k\\pi$ 解得单调递增区间 $\\left[k\\pi-\\dfrac{5\\pi}{12},\\ k\\pi+\\dfrac{\\pi}{12}\\right]\\ (k\\in\\mathbb{Z})$。（2）零点之和为 $\\dfrac{13\\pi}{3}$。解析：$f(x)=0\\iff\\sin\\left(2x+\\dfrac\\pi3\\right)=\\dfrac12\\iff 2x+\\dfrac\\pi3=\\dfrac\\pi6+2k\\pi$ 或 $2x+\\dfrac\\pi3=\\dfrac{5\\pi}6+2k\\pi$，即 $x=-\\dfrac{\\pi}{12}+k\\pi$ 或 $x=\\dfrac{\\pi}{4}+k\\pi$。落在 $[0,2\\pi]$ 内的解：第一族 $k=1,2$ 给出 $\\dfrac{11\\pi}{12},\\dfrac{23\\pi}{12}$；第二族 $k=0,1$ 给出 $\\dfrac{\\pi}{4},\\dfrac{5\\pi}{4}$。四个零点之和 $=\\dfrac{11\\pi}{12}+\\dfrac{23\\pi}{12}+\\dfrac{\\pi}{4}+\\dfrac{5\\pi}{4}=\\dfrac{34\\pi}{12}+\\dfrac{18\\pi}{12}=\\dfrac{13\\pi}{3}$。",
    sourcePage: 2,
    note: authoredNote,
  }),
  draft({
    id: "pa-weekly01-d07",
    paper: "2026 天津河西区高三一模数学",
    number: "第 14 题风格改编（自拟）",
    difficulty: "中档",
    questionType: "解答",
    tags: ["向量", "等边三角形", "数量积", "最值"],
    title: "等边三角形中的向量取值范围",
    statement: [
      "边长为 $2$ 的等边三角形 $ABC$ 中，$P$ 为边 $AB$ 上的动点（含端点）。",
      "求 $\\overrightarrow{PB}\\cdot\\overrightarrow{PC}$ 的取值范围。",
    ],
    answer: "$\\left[-\\dfrac14,\\ 2\\right]$。解析：建系 $A(0,0)$，$B(2,0)$，$C(1,\\sqrt3)$，设 $P(t,0)$，$t\\in[0,2]$。$\\overrightarrow{PB}=(2-t,0)$，$\\overrightarrow{PC}=(1-t,\\sqrt3)$，故 $\\overrightarrow{PB}\\cdot\\overrightarrow{PC}=(2-t)(1-t)=t^2-3t+2=\\left(t-\\dfrac32\\right)^2-\\dfrac14$。在 $[0,2]$ 上，$t=\\dfrac32$ 时取最小值 $-\\dfrac14$；$t=0$ 时取最大值 $2$（另一端 $t=2$ 时值为 $0$）。故取值范围为 $\\left[-\\dfrac14,2\\right]$。基底法核验：$\\overrightarrow{PB}\\cdot\\overrightarrow{PC}=(\\overrightarrow{AB}-\\overrightarrow{AP})\\cdot(\\overrightarrow{AC}-\\overrightarrow{AP})$，设 $\\overrightarrow{AP}=t\\cdot\\dfrac{\\overrightarrow{AB}}2$ 展开同样得 $t^2-3t+2$。",
    sourcePage: 5,
    note: authoredNote,
  }),
  draft({
    id: "pa-weekly01-d08",
    paper: "2026 天津河西区高三一模数学",
    number: "第 15 题风格改编（自拟）",
    difficulty: "中档",
    questionType: "解答",
    tags: ["函数零点", "绝对值", "含参函数", "分类讨论"],
    title: "含绝对值函数的零点个数",
    statement: [
      "已知 $a>0$，函数 $g(x)=|x^2-2x|-ax$。",
      "（1）当 $a=1$ 时，求 $g(x)$ 的所有零点；",
      "（2）若 $g(x)$ 恰有三个不同的零点，求 $a$ 的取值范围。",
    ],
    answer: "（1）$x=0,\\ 1,\\ 3$。解析：解 $|x^2-2x|=x$：$x<0$ 时左端 $x^2-2x>0>x$，无解；$x=0$ 成立；$0<x<2$ 时 $2x-x^2=x\\Rightarrow x=1$；$x\\ge2$ 时 $x^2-2x=x\\Rightarrow x=3$。（2）$a\\in(0,2)$。解析：$g(x)=0\\iff|x^2-2x|=ax$。① $x<0$：左端 $x^2-2x>0$，右端 $ax<0$，无解。② $x=0$：恒成立，一个零点。③ $0<x<2$：$2x-x^2=ax\\Rightarrow2-x=a\\Rightarrow x=2-a$，当 $0<2-a<2$ 即 $0<a<2$ 时多一个零点。④ $x\\ge2$：$x^2-2x=ax\\Rightarrow x=2+a>2$，恒有一个零点。综上：$0<a<2$ 时零点为 $0,\\ 2-a,\\ 2+a$ 恰三个；$a\\ge2$ 时 $2-a\\le0$ 与零点 $0$ 重合或越界，只余两个。故 $a\\in(0,2)$。",
    sourcePage: 5,
    note: authoredNote,
  }),
  draft({
    id: "pa-weekly01-d09",
    paper: "2026 天津南开区高三一模数学",
    number: "第 8 题风格改编（自拟）",
    difficulty: "中档",
    questionType: "解答",
    tags: ["立体几何", "翻折", "面面垂直", "线面角"],
    title: "正方形翻折中的角度问题",
    statement: [
      "将边长为 $2$ 的正方形 $ABCD$ 沿对角线 $AC$ 折起，使平面 $ACD\\perp$ 平面 $ABC$。",
      "（1）求折叠后线段 $BD$ 的长；",
      "（2）求直线 $BD$ 与平面 $ABC$ 所成角的大小。",
    ],
    answer: "（1）$BD=2$。解析：设 $O$ 为 $AC$ 中点。正方形中 $DO\\perp AC$、$BO\\perp AC$，折叠后保持，且 $DO=BO=\\dfrac12AC=\\sqrt2$。由平面 $ACD\\perp$ 平面 $ABC$ 且交线为 $AC$，$DO\\subset$ 平面 $ACD$、$DO\\perp AC$，得 $DO\\perp$ 平面 $ABC$，故 $DO\\perp OB$。于是 $BD=\\sqrt{DO^2+OB^2}=\\sqrt{2+2}=2$。坐标核验：$A(0,0,0),C(2\\sqrt2,0,0),B(\\sqrt2,-\\sqrt2,0),D(\\sqrt2,0,\\sqrt2)$，$|BD|=\\sqrt{0+2+2}=2$。（2）$45^\\circ$。解析：由（1）$D$ 在平面 $ABC$ 上的射影为 $O$，故 $\\angle DBO$ 即所求线面角，$\\tan\\angle DBO=\\dfrac{DO}{OB}=1$，所成角为 $45^\\circ$。",
    sourcePage: 3,
    note: authoredNote,
  }),
  draft({
    id: "pa-weekly01-d10",
    paper: "2026 天津南开区高三一模数学",
    number: "第 18 题风格改编（自拟）",
    difficulty: "中档",
    questionType: "解答",
    tags: ["椭圆", "直线与圆锥曲线", "弦长", "面积"],
    title: "椭圆的弦长与三角形面积",
    statement: [
      "已知椭圆 $\\dfrac{x^2}{a^2}+\\dfrac{y^2}{b^2}=1\\ (a>b>0)$ 的短轴长为 $2$，离心率为 $\\dfrac{\\sqrt2}{2}$。",
      "（1）求椭圆的方程；",
      "（2）直线 $l:\\ y=x-1$ 与椭圆交于 $A,B$ 两点，求 $|AB|$ 及 $\\triangle OAB$ 的面积（$O$ 为坐标原点）。",
    ],
    answer: "（1）$\\dfrac{x^2}{2}+y^2=1$。解析：短轴长 $2b=2$ 得 $b=1$；$e=\\dfrac ca=\\dfrac{\\sqrt2}2$ 得 $c^2=\\dfrac{a^2}2$，结合 $b^2=a^2-c^2=\\dfrac{a^2}2=1$ 得 $a^2=2$。（2）$|AB|=\\dfrac{4\\sqrt2}{3}$，面积 $\\dfrac23$。解析：把 $y=x-1$ 代入 $\\dfrac{x^2}2+y^2=1$：$x^2+2(x-1)^2=2\\Rightarrow3x^2-4x=0\\Rightarrow x=0$ 或 $x=\\dfrac43$，交点 $A(0,-1)$、$B\\left(\\dfrac43,\\dfrac13\\right)$。$|AB|=\\sqrt{1+k^2}\\,|x_1-x_2|=\\sqrt2\\cdot\\dfrac43=\\dfrac{4\\sqrt2}3$。原点到 $l:\\ x-y-1=0$ 的距离 $d=\\dfrac1{\\sqrt2}$，$S_{\\triangle OAB}=\\dfrac12\\cdot\\dfrac{4\\sqrt2}3\\cdot\\dfrac1{\\sqrt2}=\\dfrac23$。",
    sourcePage: 7,
    note: authoredNote,
  }),
  draft({
    id: "pa-weekly01-c01",
    paper: "2026 天津和平区高三一模数学",
    number: "第 20 题改编",
    difficulty: "压轴",
    questionType: "解答",
    tags: ["导数", "函数不等式", "极值", "放缩"],
    title: "导数极值与指数不等式",
    statement: ["设 $h(x)=m\\ln x+e^{-x}\\ (x>0)$。", "（1）求 $h(x)$ 在 $(0,+\\infty)$ 上单调递增时参数 $m$ 的取值。", "（2）证明：对 $0<p<q$，有 $p(e^{p+1}-e^{q+1})>e^{p+q}(p-q)$。", "（3）若 $p,q$ 是 $h(x)$ 的两个极值点，证明 $0<h(p)-h(q)<1$。"],
    answer: "（1）$m\\ge\\dfrac1e$。解析：$h'(x)=\\dfrac mx-e^{-x}\\ge0$ 对一切 $x>0$ 成立 $\\iff m\\ge xe^{-x}$ 恒成立。设 $u(x)=xe^{-x}$，$u'(x)=(1-x)e^{-x}$，$u$ 在 $(0,1)$ 增、$(1,+\\infty)$ 减，最大值 $u(1)=\\dfrac1e$，故 $m\\ge\\dfrac1e$。（2）证明：两边同除以 $e^{p+q}>0$，等价于 $p\\,(e^{1-q}-e^{1-p})>p-q$。令 $s=1-p,\\ t=1-q$，则 $t<s<1$，$p=1-s$，$p-q=t-s$，需证 $(1-s)(e^t-e^s)>t-s$。第一步（切线放缩）：$e^t>e^s+e^s(t-s)$（$t\\ne s$ 时严格），故 $e^t-e^s>e^s(t-s)$；两边乘正数 $(1-s)$：$(1-s)(e^t-e^s)>(1-s)e^s(t-s)$。第二步：设 $\\psi(s)=(1-s)e^s$，$\\psi'(s)=-se^s$，$\\psi$ 在 $s=0$ 取最大值 $\\psi(0)=1$，故 $(1-s)e^s\\le1$；又 $t-s<0$，所以 $(1-s)e^s(t-s)\\ge t-s$。两步相连即得结论。（3）证明：极值点满足 $h'(x)=0$，即 $m=xe^{-x}$。由（1）中 $u(x)=xe^{-x}$ 的形状，$h$ 有两个极值点当且仅当 $0<m<\\dfrac1e$，且 $0<p<1<q$，$pe^{-p}=qe^{-q}=m$。取对数：$\\ln p-p=\\ln q-q$，即 $\\ln\\dfrac pq=p-q$。于是 $h(p)-h(q)=m(\\ln p-\\ln q)+e^{-p}-e^{-q}=m(p-q)+e^{-p}-e^{-q}$。上界：$m(p-q)<0$ 且 $e^{-q}>0$，故 $h(p)-h(q)<e^{-p}<e^0=1$。下界：由 $e^{-p}=\\dfrac mp,\\ e^{-q}=\\dfrac mq$ 得 $h(p)-h(q)=m\\left[(p-q)+\\dfrac1p-\\dfrac1q\\right]=m(p-q)\\cdot\\dfrac{pq-1}{pq}$。再证 $pq<1$：设 $H(p)=2\\ln p-p+\\dfrac1p\\ (0<p<1)$，$H'(p)=\\dfrac2p-1-\\dfrac1{p^2}=-\\dfrac{(p-1)^2}{p^2}\\le0$，故 $H$ 递减，$H(p)>H(1)=0$，即 $\\ln p-p>\\ln\\dfrac1p-\\dfrac1p$，也就是 $g(p)>g\\left(\\dfrac1p\\right)$（其中 $g(x)=\\ln x-x$）。而 $g(q)=g(p)>g\\left(\\dfrac1p\\right)$，$g$ 在 $(1,+\\infty)$ 上严格递减且 $q,\\dfrac1p>1$，故 $q<\\dfrac1p$，即 $pq<1$。于是 $(p-q)<0,\\ (pq-1)<0$，故 $h(p)-h(q)=\\dfrac{m(p-q)(pq-1)}{pq}>0$。综上 $0<h(p)-h(q)<1$。",
    sourcePage: 4,
  }),
  draft({
    id: "pa-weekly01-c02",
    paper: "2026 天津十二校联考高三一模数学",
    number: "第 20 题风格改编（自拟）",
    difficulty: "压轴",
    questionType: "解答",
    tags: ["导数", "切线", "双极值点", "函数不等式"],
    title: "含参函数的切线与双极值",
    statement: [
      "已知函数 $f(x)=x^2-2x+a\\ln x\\ (a\\in\\mathbb{R})$。",
      "（1）当 $a=1$ 时，求曲线 $y=f(x)$ 在 $x=1$ 处的切线方程；",
      "（2）若 $f(x)$ 有两个极值点，求 $a$ 的取值范围；",
      "（3）在（2）的条件下，设两个极值点为 $x_1,x_2$，证明：$-\\dfrac32-\\ln 2<f(x_1)+f(x_2)<-1$。",
    ],
    answer: "（1）$y=x-2$。解析：$a=1$ 时 $f(1)=1-2+0=-1$，$f'(x)=2x-2+\\dfrac1x$，$f'(1)=1$，切线 $y+1=x-1$，即 $y=x-2$。（2）$a\\in\\left(0,\\dfrac12\\right)$。解析：$f'(x)=2x-2+\\dfrac ax=\\dfrac{2x^2-2x+a}x\\ (x>0)$，两个极值点 $\\iff 2x^2-2x+a=0$ 有两个互异正根：判别式 $4-8a>0\\Rightarrow a<\\dfrac12$；根之积 $\\dfrac a2>0\\Rightarrow a>0$；根之和 $1>0$ 自动成立。（3）证明：由韦达定理 $x_1+x_2=1,\\ x_1x_2=\\dfrac a2$。$f(x_1)+f(x_2)=(x_1^2+x_2^2)-2(x_1+x_2)+a\\ln(x_1x_2)=\\left[1-2\\cdot\\dfrac a2\\right]-2+a\\ln\\dfrac a2=-1-a+a\\ln\\dfrac a2$。设 $\\varphi(a)=-1-a+a\\ln\\dfrac a2,\\ a\\in\\left(0,\\dfrac12\\right)$。上界：$0<\\dfrac a2<\\dfrac14$，故 $\\ln\\dfrac a2<0$，$\\varphi(a)<-1-a<-1$。下界：$\\varphi'(a)=-1+\\ln\\dfrac a2+1=\\ln\\dfrac a2<0$，$\\varphi$ 严格递减，故对 $a<\\dfrac12$ 有 $\\varphi(a)>\\varphi\\left(\\dfrac12\\right)=-1-\\dfrac12+\\dfrac12\\ln\\dfrac14=-\\dfrac32-\\ln2$（右端点取不到，故不等号严格）。综上得证。",
    sourcePage: 6,
    note: authoredNote,
  }),
  draft({
    id: "pa-weekly01-m01",
    paper: "2026 天津河东区高三一模数学",
    number: "第 19 题改编",
    difficulty: "压轴",
    questionType: "解答",
    tags: ["数列", "等差数列", "等比数列", "错位相减", "不等式证明"],
    title: "等比数列、等差数列与求和不等式",
    statement: [
      "已知等比数列 $\\{a_n\\}$ 的公比 $q>1$，正项等差数列 $\\{b_n\\}$ 满足 $a_1=2$，$b_1=1$，$a_3+a_5=40$，且 $a_3$ 是 $b_1+b_2$ 与 $b_4+b_5$ 的等比中项。",
      "（1）求数列 $\\{a_n\\}$ 与 $\\{b_n\\}$ 的通项公式。",
      "（2）设 $S_n$ 为 $\\{b_n\\}$ 的前 $n$ 项和，$c_n=a_nS_n$，$T_n=\\sum_{k=1}^n c_k$。求 $T_n$，并证明 $T_n<(n^2-2n+3)a_{n+1}$。",
    ],
    answer: "（1）$a_n=2^n$，$b_n=2n-1$。解析：$a_3+a_5=2q^2+2q^4=40\\Rightarrow q^4+q^2-20=0\\Rightarrow(q^2-4)(q^2+5)=0$，由 $q>1$ 得 $q=2$，故 $a_n=2^n$。设公差 $d$：等比中项条件 $(b_1+b_2)(b_4+b_5)=a_3^2=64$，即 $(2+d)(2+7d)=64\\Rightarrow7d^2+16d-60=0\\Rightarrow d=2$ 或 $d=-\\dfrac{30}7$；后者使数列从某项起为负，与正项矛盾，舍去。故 $b_n=2n-1$。（2）$T_n=(n^2-2n+3)\\cdot2^{n+1}-6$。解析：$S_n=\\dfrac{n(1+2n-1)}2=n^2$，$c_n=n^2\\cdot2^n$。错位相减：$T_n=\\sum_{k=1}^n k^2 2^k$，$2T_n=\\sum_{k=1}^n k^2 2^{k+1}=\\sum_{k=2}^{n+1}(k-1)^2 2^k$，相减得 $T_n=2T_n-T_n=n^2 2^{n+1}-2-\\sum_{k=2}^{n}(2k-1)2^k$。其中 $\\sum_{k=1}^n k\\,2^k=(n-1)2^{n+1}+2$（再做一次错位相减可得），代入化简：$T_n=n^2 2^{n+1}-2-\\left[2\\big((n-1)2^{n+1}+2-2\\big)-\\big(2^{n+1}-4\\big)\\right]=(n^2-2n+3)2^{n+1}-6$。验证：$n=1$：$2\\cdot4-6=2=c_1$；$n=2$：$3\\cdot8-6=18=2+16$；$n=3$：$6\\cdot16-6=90=2+16+72$，均吻合。不等式：$a_{n+1}=2^{n+1}$，故 $(n^2-2n+3)a_{n+1}-T_n=6>0$，即 $T_n<(n^2-2n+3)a_{n+1}$ 对一切 $n\\in\\mathbb{N}^*$ 成立。",
    sourcePage: 5,
  }),
];

// 填空题答案 key 的设计原则（配合 lib/contest-sprint.ts 的归一化规则）：
// 归一化会去掉空白和 * \ { } $ 字符、把 √ 换成 sqrt、整体转小写，再做
// 分数约分/整数列表排序，因此这里给出多种常见等价写法。自动匹配不上的
// 提交不会直接判错，而是转人工复核（见 sprint submit 路由）。
export const weekly01SprintAnswerKeys: Weekly01SprintAnswerKey[] = [
  { draftProblemId: "pa-weekly01-s01", answerType: "single_choice", answerKey: ["C"], formatNote: "输入 A/B/C/D" },
  { draftProblemId: "pa-weekly01-s02", answerType: "single_choice", answerKey: ["A"], formatNote: "输入 A/B/C/D" },
  { draftProblemId: "pa-weekly01-s03", answerType: "single_choice", answerKey: ["B"], formatNote: "输入 A/B/C/D" },
  {
    draftProblemId: "pa-weekly01-s04",
    answerType: "fill_blank",
    answerKey: ["sqrt(5)", "sqrt5", "根号5", "5^(1/2)", "5^0.5"],
    formatNote: "根式写成 sqrt(5) 或 √5；无法自动识别的等价写法会转人工复核，不会直接判错",
  },
  {
    draftProblemId: "pa-weekly01-s05",
    answerType: "fill_blank",
    answerKey: ["-5/2", "-2.5"],
    formatNote: "分数写成 -5/2（也接受 -2.5）",
  },
  {
    draftProblemId: "pa-weekly01-s06",
    answerType: "fill_blank",
    answerKey: ["2sqrt(6)", "2sqrt6", "2根号6", "根号24", "sqrt(24)", "sqrt24"],
    formatNote: "根式写成 2sqrt(6) 或 2√6；无法自动识别的等价写法会转人工复核",
  },
  {
    draftProblemId: "pa-weekly01-s07",
    answerType: "fill_blank",
    answerKey: ["2+i", "2+1i"],
    formatNote: "复数写成 a+bi，例如 2+i",
  },
  {
    draftProblemId: "pa-weekly01-s08",
    answerType: "fill_blank",
    answerKey: ["20/27"],
    formatNote: "分数写成 20/27",
  },
  { draftProblemId: "pa-weekly01-s09", answerType: "fill_blank", answerKey: ["4"], formatNote: "填一个数" },
  { draftProblemId: "pa-weekly01-s10", answerType: "fill_blank", answerKey: ["2"], formatNote: "填一个数" },
  { draftProblemId: "pa-weekly01-s11", answerType: "fill_blank", answerKey: ["60"], formatNote: "填一个数" },
  { draftProblemId: "pa-weekly01-s12", answerType: "fill_blank", answerKey: ["5"], formatNote: "填一个数" },
  {
    draftProblemId: "pa-weekly01-s13",
    answerType: "fill_blank",
    answerKey: ["1/8", "0.125"],
    formatNote: "分数写成 1/8（也接受 0.125）",
  },
  { draftProblemId: "pa-weekly01-s14", answerType: "fill_blank", answerKey: ["10"], formatNote: "填一个数" },
  { draftProblemId: "pa-weekly01-s15", answerType: "single_choice", answerKey: ["A"], formatNote: "输入 A/B/C/D" },
];
