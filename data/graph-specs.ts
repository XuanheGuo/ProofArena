import type { FunctionGraphSpec, GraphColor } from "@/lib/types";

type Colors = Record<GraphColor, string>;

function drawHyperbola(
  board: JXG.Board,
  a: number,
  b: () => number,
  color: string,
) {
  const N = 120;
  const tMax = 2.5;
  board.create(
    "curve",
    [
      (t: number) => a * Math.cosh(t),
      (t: number) => b() * Math.sinh(t),
      -tMax,
      tMax,
    ],
    { strokeColor: color, strokeWidth: 2.5, highlight: false },
  );
  board.create(
    "curve",
    [
      (t: number) => -a * Math.cosh(t),
      (t: number) => b() * Math.sinh(t),
      -tMax,
      tMax,
    ],
    { strokeColor: color, strokeWidth: 2.5, highlight: false },
  );
  void N;
}

function ptStyle(name: string, color: string) {
  return {
    name,
    size: 4,
    strokeColor: color,
    fillColor: color,
    label: { color, offset: [8, 8] },
    fixed: true,
  };
}

// ── tj-2026-09: 双曲线焦点三角形与离心率 ─────────────────────────────────────
function drawHyperbolaFocalTriangle(
  board: JXG.Board,
  sliders: Map<string, JXG.Slider>,
  c: Colors,
) {
  const eSlider = sliders.get("e")!;

  // a = 1 (normalized), c = e, b² = e² - 1
  const getE = () => Math.max(eSlider.Value(), 1.01);
  const getB = () => Math.sqrt(getE() * getE() - 1);

  // Draw hyperbola
  drawHyperbola(board, 1, getB, c.cyan);

  // Asymptotes
  board.create(
    "functiongraph",
    [(x: number) => getB() * x, -5.5, 5.5],
    { strokeColor: c.zinc, strokeWidth: 1, dash: 3, highlight: false },
  );
  board.create(
    "functiongraph",
    [(x: number) => -getB() * x, -5.5, 5.5],
    { strokeColor: c.zinc, strokeWidth: 1, dash: 3, highlight: false },
  );

  // Key points: F = (-e, 0), A = (1, 0)
  const F = board.create("point", [() => -getE(), 0], ptStyle("F", c.amber));
  const A = board.create("point", [1, 0], ptStyle("A", c.green));

  // P coordinates derived from |FA|=|FP|, ∠FAP=30°:
  //   |FA| = 1 + e,  |AP| = √3(1+e),  AP dir = (-√3/2, 1/2)
  //   P = A + |AP|·(-√3/2, 1/2) = (1 - 3(1+e)/2, √3(1+e)/2)
  //     = (-(1+3e)/2, √3(1+e)/2)
  const Px = () => -(1 + 3 * getE()) / 2;
  const Py = () => (Math.sqrt(3) * (1 + getE())) / 2;
  const P = board.create("point", [Px, Py], ptStyle("P", c.red));

  // Triangle edges
  const segStyle = (color: string) => ({
    strokeColor: color,
    strokeWidth: 2,
    straightFirst: false,
    straightLast: false,
    highlight: false,
  });
  board.create("line", [F, A], segStyle(c.amber));
  board.create("line", [F, P], segStyle(c.red));
  board.create("line", [A, P], segStyle(c.green));

  // Dynamic labels (kept clear of the slider's own name/value readout above y≈3)
  board.create(
    "text",
    [
      -5,
      2.55,
      () => `e = ${getE().toFixed(3)}   |FA| = ${(1 + getE()).toFixed(3)}`,
    ],
    { color: c.amber, fontSize: 13, fixed: true, highlight: false },
  );
  board.create(
    "text",
    [
      -5,
      1.95,
      () => {
        const px = Px();
        const py = Py();
        const e = getE();
        const lhs = px * px - py * py / (e * e - 1);
        return `P 在双曲线上验证：x²/1 - y²/b² = ${lhs.toFixed(3)}`;
      },
    ],
    { color: c.zinc, fontSize: 12, fixed: true, highlight: false },
  );

  void F; void A; void P;
}

// ── ng1-2026-18: 椭圆焦点弦、面积比与夹角最小值 ──────────────────────────────
function drawEllipseFocalChord(
  board: JXG.Board,
  sliders: Map<string, JXG.Slider>,
  c: Colors,
) {
  const mSlider = sliders.get("m")!;

  // Fixed ellipse: a=2, b=√3, c=1, F=(-1,0)
  const a2 = 4; // a²
  const b2 = 3; // b²
  const fc = 1;  // focal distance c

  // Draw ellipse
  board.create(
    "curve",
    [
      (t: number) => 2 * Math.cos(t),
      (t: number) => Math.sqrt(3) * Math.sin(t),
      0,
      2 * Math.PI,
    ],
    { strokeColor: c.cyan, strokeWidth: 2.5, highlight: false },
  );

  // Fixed points
  board.create("point", [-fc, 0], ptStyle("F", c.amber));
  board.create("point", [0, 0], ptStyle("O", c.zinc));

  // Intersection of y = m(x + c) with ellipse x²/4 + y²/3 = 1
  // (3 + 4m²)x² + 8m²x + 4m² - 12 = 0
  // discriminant = 144(m²+1), so x = (-4m² ± 6√(m²+1)) / (3+4m²)
  const xP = () => {
    const m = mSlider.Value();
    const d = 3 + 4 * m * m;
    return (-4 * m * m + 6 * Math.sqrt(m * m + 1)) / d;
  };
  const xQ = () => {
    const m = mSlider.Value();
    const d = 3 + 4 * m * m;
    return (-4 * m * m - 6 * Math.sqrt(m * m + 1)) / d;
  };
  const yP = () => mSlider.Value() * (xP() + fc);
  const yQ = () => mSlider.Value() * (xQ() + fc);

  // R = -P (center symmetry through O)
  const xR = () => -xP();
  const yR = () => -yP();

  // Dynamic points
  const P = board.create("point", [xP, yP], ptStyle("P", c.green));
  const Q = board.create("point", [xQ, yQ], ptStyle("Q", c.red));
  const R = board.create("point", [xR, yR], ptStyle("R", c.violet));

  // Chord PQ (line l)
  board.create("line", [P, Q], {
    strokeColor: c.amber,
    strokeWidth: 2,
    straightFirst: true,
    straightLast: true,
    highlight: false,
  });

  // Line PO extended to R
  board.create("line", [P, R], {
    strokeColor: c.zinc,
    strokeWidth: 1.5,
    dash: 2,
    straightFirst: false,
    straightLast: false,
    highlight: false,
  });

  // Triangle PQR (shaded polygon)
  board.create("polygon", [P, Q, R], {
    fillColor: c.violet,
    fillOpacity: 0.08,
    strokeColor: c.violet,
    strokeWidth: 1.5,
    highlight: false,
  });

  // Angle ∠PQR
  const tanAngle = () => {
    const m = mSlider.Value();
    // k_PQ = m, k_QR = (yR()-yQ())/(xR()-xQ())
    const kqr = (yR() - yQ()) / (xR() - xQ());
    const tanVal = Math.abs((m - kqr) / (1 + m * kqr));
    return tanVal;
  };

  board.create(
    "text",
    [
      -3.8,
      2.5,
      () => `斜率 m = ${mSlider.Value().toFixed(3)}`,
    ],
    { color: c.amber, fontSize: 13, fixed: true, highlight: false },
  );
  board.create(
    "text",
    [
      -3.8,
      2.1,
      () => `tan∠PQR = ${tanAngle().toFixed(4)}（最小值 ≈ 6.928 ≈ 4√3）`,
    ],
    { color: c.violet, fontSize: 12, fixed: true, highlight: false },
  );

  void a2; void b2;
}

// ── thu-2023-02: 含参对数方程的最坏参数 ───────────────────────────────────────
function drawLogParameterTrap(
  board: JXG.Board,
  sliders: Map<string, JXG.Slider>,
  c: Colors,
) {
  const kSlider = sliders.get("k")!;
  const tSlider = sliders.get("t")!;

  const getK = () => Math.min(kSlider.Value(), -0.05);
  const getT = () => Math.max(tSlider.Value(), 0.05);
  const phi = (y: number) => Math.log(y) - getT() * y + (getT() * getT()) / getK();
  const yStar = () => 1 / getT();
  const maxValue = () => -Math.log(getT()) - 1 + (getT() * getT()) / getK();

  board.create("functiongraph", [phi, 0.05, 6], {
    strokeColor: c.cyan,
    strokeWidth: 3,
    highlight: false,
    name: "phi(y)",
  });
  board.create("line", [[0, 0], [1, 0]], {
    strokeColor: c.zinc,
    strokeWidth: 1.5,
    dash: 2,
    highlight: false,
  });
  board.create("point", [yStar, maxValue], ptStyle("max", c.red));
  board.create(
    "text",
    [
      0.35,
      2.6,
      () => `k=${getK().toFixed(2)},  t=ka=${getT().toFixed(2)},  a=${(getT() / getK()).toFixed(2)}`,
    ],
    { color: c.amber, fontSize: 13, fixed: true, highlight: false },
  );
  board.create(
    "text",
    [
      0.35,
      2.15,
      () => `最大值 = ${maxValue().toFixed(3)}${maxValue() < 0 ? "，整条曲线低于 0，无解" : "，仍可能有零点"}`,
    ],
    { color: c.red, fontSize: 12, fixed: true, highlight: false },
  );
}

// ── thu-2023-05: 椭圆焦半径条件与斜率范围 ─────────────────────────────────────
function drawQiangjiEllipseFocalRadius(
  board: JXG.Board,
  sliders: Map<string, JXG.Slider>,
  c: Colors,
) {
  const sSlider = sliders.get("s")!;
  const getS = () => sSlider.Value();
  const ellipseX = (t: number) => 2 * getS() * Math.cos(t);
  const ellipseY = (t: number) => Math.sqrt(3) * getS() * Math.sin(t);
  const xA = () => 10 - 4 * getS();
  const xB = () => 16 - 4 * getS();
  const yOnEllipse = (x: number) => {
    const s = getS();
    return Math.sqrt(Math.max(0, 3 * s * s * (1 - (x * x) / (4 * s * s))));
  };
  const yA = () => yOnEllipse(xA());
  const yB = () => -yOnEllipse(xB());
  const slope = () => (yB() - yA()) / (xB() - xA());

  board.create("curve", [ellipseX, ellipseY, 0, 2 * Math.PI], {
    strokeColor: c.cyan,
    strokeWidth: 2.5,
    highlight: false,
  });
  const F = board.create("point", [() => -getS(), 0], ptStyle("F", c.amber));
  const A = board.create("point", [xA, yA], ptStyle("A", c.green));
  const B = board.create("point", [xB, yB], ptStyle("B", c.red));
  board.create("line", [A, B], {
    strokeColor: c.violet,
    strokeWidth: 2,
    straightFirst: false,
    straightLast: false,
    highlight: false,
  });
  board.create("line", [F, A], {
    strokeColor: c.green,
    strokeWidth: 1.5,
    dash: 2,
    straightFirst: false,
    straightLast: false,
    highlight: false,
  });
  board.create("line", [F, B], {
    strokeColor: c.red,
    strokeWidth: 1.5,
    dash: 2,
    straightFirst: false,
    straightLast: false,
    highlight: false,
  });
  board.create(
    "text",
    [
      -10.5,
      7.5,
      () => `√λ=${getS().toFixed(3)}，x_A=${xA().toFixed(2)}，x_B=${xB().toFixed(2)}`,
    ],
    { color: c.amber, fontSize: 13, fixed: true, highlight: false },
  );
  board.create(
    "text",
    [
      -10.5,
      6.55,
      () => `当前取上下对称构型时 k≈${slope().toFixed(3)}，端点绝对值 √7/2≈${(Math.sqrt(7) / 2).toFixed(3)}`,
    ],
    { color: c.violet, fontSize: 12, fixed: true, highlight: false },
  );
}

export const graphSpecRegistry: Record<string, FunctionGraphSpec> = {
  "thu-2023-02": {
    title: "含参对数方程的最坏参数实验台",
    description: "固定 $k<0$，用 $t=ka>0$ 表示最坏参数方向。拖动 $t$ 可看到辅助函数最大值如何从可能有零点变为整条曲线低于 $0$。",
    insight: "反例不是让 $a\\to0^-$，而是让 $t=ka$ 足够大。此时最大值 $-\\ln t-1+t^2/k$ 因为 $k<0$ 会趋向 $-\\infty$。",
    boundingBox: [0, 3.2, 6.2, -8],
    keepAspectRatio: false,
    sliders: [
      { name: "k", label: "k（负值）", min: -4, max: -0.2, step: 0.05, initial: -1 },
      { name: "t", label: "t=ka", min: 0.3, max: 8, step: 0.05, initial: 2.6 },
    ],
    draw: drawLogParameterTrap,
  },

  "thu-2023-05": {
    title: "椭圆焦半径与弦斜率实验台",
    description: "拖动 $\\sqrt\\lambda$，观察焦半径条件 $FA=5,FB=8$ 如何把 $A,B$ 的横坐标固定成 $x_A=10-4\\sqrt\\lambda$、$x_B=16-4\\sqrt\\lambda$。",
    insight: "可行区间为 $8/3\\le\\sqrt\\lambda\\le5$。两端分别对应 $B$ 到右端点、$A$ 到左端点，给出同一个斜率端点 $\\sqrt7/2$。",
    boundingBox: [-11, 8.5, 11, -8.5],
    keepAspectRatio: true,
    sliders: [
      { name: "s", label: "√λ", min: 8 / 3, max: 5, step: 0.01, initial: 3.6 },
    ],
    draw: drawQiangjiEllipseFocalRadius,
  },

  "tj-2026-09": {
    title: "双曲线焦点三角形实验台",
    description: "拖动 $e$ 滑块改变离心率，观察双曲线形态、渐近线斜率和焦点三角形 $FAP$ 的变化。本题答案是 $e=4/3$，此时 $P$ 恰好落在左支。",
    insight: "核心关系：$|FA|=|FP|=a+c$，$\\angle FAP=30°$，从而 $P$ 的坐标完全由 $e$ 确定。最后用 $P$ 回代双曲线方程解出 $e$。",
    boundingBox: [-6, 4.2, 6, -4.2],
    keepAspectRatio: true,
    sliders: [
      { name: "e", label: "e（离心率）", min: 1.05, max: 2.8, step: 0.01, initial: 4 / 3 },
    ],
    draw: drawHyperbolaFocalTriangle,
  },

  "ng1-2026-18": {
    title: "椭圆焦点弦与夹角实验台",
    description: "拖动 $m$ 滑块改变过焦点 $F$ 直线的斜率，观察焦点弦 $PQ$、对称点 $R=-P$ 和三角形 $PQR$ 的动态变化。",
    insight: "由于 $R=-P$（中心对称），直线 $PO$ 的另一端自动给出 $R$。夹角 $\\angle PQR$ 的最小值为 $4\\sqrt3$，在 $m=\\sqrt5/2$ 时取到。",
    boundingBox: [-3.5, 3, 3.5, -3],
    keepAspectRatio: false,
    sliders: [
      { name: "m", label: "m（斜率）", min: 0.2, max: 4, step: 0.02, initial: 1 },
    ],
    draw: drawEllipseFocalChord,
  },
};
