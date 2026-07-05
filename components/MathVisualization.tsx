"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Crosshair, Expand, MousePointer2, RotateCcw } from "lucide-react";
import { MathBlock } from "@/components/MathBlock";

type VisualizationKind = "tianjin-tangent-ellipse" | "trajectory-classifier" | "derivative-proof";
type JXGApi = typeof import("jsxgraph");

interface VisualizationSpec {
  kind: VisualizationKind;
  title: string;
  description: string;
  insight: string;
  boundingBox: [number, number, number, number];
  keepAspectRatio?: boolean;
}

const visualizationSpecs: Record<string, VisualizationSpec> = {
  "tj-2026-18": {
    kind: "tianjin-tangent-ellipse",
    title: "切线与斜率比实验台",
    description: "拖动截距滑块，观察斜率为 -√3 的直线何时与圆相切、何时切出椭圆上的 P,Q，并比较 AP 与 AQ 的斜率。",
    insight: "这题的图像核心不是椭圆焦半径，而是“圆的切线确定直线，直线截椭圆确定两个斜率”。有效切线落在截距 2√3。",
    boundingBox: [-3.2, 4.4, 4.2, -2.6],
    keepAspectRatio: true,
  },
  "ng2-2026-18": {
    kind: "trajectory-classifier",
    title: "动点轨迹分类实验台",
    description: "拖动 θ 让 A 在椭圆上运动，拖动 t₀ 改变点 G。绿色点 P 的轨迹会随 t₀ 从双曲线型过渡到抛物线型，再到椭圆型。",
    insight: "轨迹方程里的 x² 系数 1/2-1/t₀² 决定曲线类型；临界值 t₀=√2 时，二次项消失，图像变成抛物线型。",
    boundingBox: [-6, 4.8, 6, -4.8],
    keepAspectRatio: true,
  },
  "tj-2026-20": {
    kind: "derivative-proof",
    title: "差函数与临界指数实验台",
    description: "拖动 x₀ 查看差函数 g(x)=f(x)-1-x/3 的高度；再拖动 n，观察乘积归一化 Pₙ/(n+1)^(1/3) 是否低于 1。",
    insight: "切线图只能看到下界；差函数图说明为什么下界成立，离散乘积条则说明为什么 1/3 是自然出现的临界指数。",
    boundingBox: [-0.55, 2.8, 2.4, -0.35],
  },
};

const darkGraphColors = {
  cyan: "#22d3ee",
  amber: "#fbbf24",
  red: "#f87171",
  green: "#a3e635",
  violet: "#c084fc",
  zinc: "#a1a1aa",
};

const lightGraphColors = {
  cyan: "#0e7490",
  amber: "#a16207",
  red: "#be123c",
  green: "#047857",
  violet: "#7e22ce",
  zinc: "#52525b",
};

let colors = darkGraphColors;

export function MathVisualization({ problemId }: { problemId: string }) {
  const reactId = useId();
  const boardId = `math-viz-${reactId.replace(/:/g, "")}`;
  const boardRef = useRef<JXG.Board | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const spec = visualizationSpecs[problemId];

  useEffect(() => {
    if (!spec) return;
    let disposed = false;
    let localBoard: JXG.Board | null = null;
    let localJXGApi: JXGApi | null = null;

    async function initialize() {
      setReady(false);
      setFailed(false);
      try {
        await waitForBoardElement(boardId);
        if (disposed) return;
        const JXGModule = await withTimeout(import("jsxgraph"), 8000);
        if (disposed) return;
        const JXGApi = JXGModule;
        localJXGApi = JXGApi;
        if (boardRef.current) {
          JXGApi.JSXGraph.freeBoard(boardRef.current);
        }

        const dark = document.documentElement.dataset.theme !== "light";
        colors = dark ? darkGraphColors : lightGraphColors;
        const board = JXGApi.JSXGraph.initBoard(boardId, {
          boundingBox: spec.boundingBox,
          axis: true,
          keepAspectRatio: spec.keepAspectRatio ?? false,
          showCopyright: false,
          showNavigation: true,
          pan: { enabled: true },
          zoom: { wheel: true },
          defaultAxes: {
            x: axisStyle(dark),
            y: axisStyle(dark),
          },
        });
        localBoard = board;
        boardRef.current = board;

        if (spec.kind === "tianjin-tangent-ellipse") drawTianjinTangentEllipse(board);
        if (spec.kind === "trajectory-classifier") drawTrajectoryClassifier(board);
        if (spec.kind === "derivative-proof") drawDerivativeProof(board);
        setReady(true);
      } catch (error) {
        console.error("Failed to initialize math visualization", error);
        setFailed(true);
        setReady(true);
      }
    }

    void initialize();
    const observer = new MutationObserver(() => void initialize());
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    return () => {
      disposed = true;
      observer.disconnect();
      if (localBoard && localJXGApi) {
        localJXGApi.JSXGraph.freeBoard(localBoard);
      }
      if (boardRef.current === localBoard) {
        boardRef.current = null;
      }
    };
  }, [boardId, spec]);

  if (!spec) return null;

  function resetView() {
    const board = boardRef.current;
    if (!board) return;
    board.setBoundingBox(spec.boundingBox, true);
  }

  return (
    <section id="visualization" className="mt-5 scroll-mt-32 border border-cyan-400/25 bg-zinc-950">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center bg-cyan-400 text-zinc-950">
            <Crosshair className="size-5" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-white">{spec.title}</h2>
            <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">交互图像</span>
          </div>
        </div>
        <button
          type="button"
          onClick={resetView}
          className="inline-flex h-9 items-center gap-2 border border-white/10 px-3 text-xs text-zinc-400 hover:text-white"
        >
          <RotateCcw className="size-3.5" />
          重置视图
        </button>
      </div>

      <div className="grid lg:grid-cols-[1fr_19rem]">
        <div className="relative min-h-96 border-b border-white/10 bg-black/20 lg:min-h-[34rem] lg:border-r lg:border-b-0">
          <div id={boardId} className="jxgbox absolute inset-0 size-full border-0 bg-transparent" />
          {!ready && <div className="absolute inset-0 grid place-items-center text-sm text-zinc-500">正在绘制...</div>}
          {failed && (
            <div className="absolute inset-0 grid place-items-center bg-white px-8 text-center text-sm leading-7 text-zinc-500">
              图像初始化失败，请刷新页面或稍后重试。
            </div>
          )}
        </div>
        <aside className="p-5">
          <div className="flex items-center gap-2 text-xs font-bold text-cyan-300">
            <MousePointer2 className="size-4" />
            怎么操作
          </div>
          <p className="mt-3 text-sm leading-7 text-zinc-400">
            <MathBlock>{spec.description}</MathBlock>
          </p>
          <div className="mt-6 border-l-2 border-amber-400 bg-amber-400/5 p-4">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
              <Expand className="size-4" />
              看懂什么
            </div>
            <p className="mt-3 text-sm leading-7 text-zinc-300">
              <MathBlock>{spec.insight}</MathBlock>
            </p>
          </div>
          <p className="mt-5 font-mono text-[10px] uppercase leading-5 text-zinc-600">
            拖动点 · 拖动滑块 · 滚轮缩放
          </p>
        </aside>
      </div>
    </section>
  );
}

function axisStyle(dark: boolean) {
  return {
    strokeColor: dark ? "#71717a" : "#52525b",
    ticks: {
      strokeColor: dark ? "#52525b" : "#a1a1aa",
      label: { color: dark ? "#a1a1aa" : "#52525b" },
    },
  };
}

async function waitForBoardElement(boardId: string) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const element = document.getElementById(boardId);
    const rect = element?.getBoundingClientRect();
    if (rect && rect.width > 0 && rect.height > 0) return;
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
  throw new Error("Math visualization container is not ready");
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("Timed out loading JSXGraph")), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function basePointStyle(name: string, color: string) {
  return {
    name,
    size: 4,
    strokeColor: color,
    fillColor: color,
    label: { color, offset: [8, 8] },
  };
}

function sliderStyle(color = colors.cyan) {
  return {
    strokeColor: color,
    fillColor: color,
    highline: { strokeColor: color },
    baseline: { strokeColor: "#3f3f46" },
    label: { color },
  };
}

function textStyle(color = colors.zinc) {
  return {
    color,
    fontSize: 14,
    fixed: true,
    highlight: false,
  };
}

function drawEllipse(board: JXG.Board, a: number, b: number, color = colors.cyan) {
  return board.create("curve", [
    (t: number) => a * Math.cos(t),
    (t: number) => b * Math.sin(t),
    0,
    2 * Math.PI,
  ], { strokeColor: color, strokeWidth: 3, highlight: false });
}

function drawTianjinTangentEllipse(board: JXG.Board) {
  const a = 2;
  const b = Math.sqrt(3);
  const tangentIntercept = 2 * Math.sqrt(3);
  const movingIntercept = board.create("slider", [[-2.7, 3.75], [1.5, 3.75], [-tangentIntercept, tangentIntercept, tangentIntercept]], {
    name: "s",
    snapWidth: 0.02,
    ...sliderStyle(colors.amber),
  }) as JXG.Slider;

  drawEllipse(board, a, b);
  board.create("circle", [[0, 0], b], { strokeColor: colors.violet, strokeWidth: 2, dash: 2, highlight: false });
  board.create("point", [0, b], { ...basePointStyle("A", colors.green), fixed: true });
  board.create("point", [2, 0], { ...basePointStyle("P", colors.amber), fixed: true });
  board.create("point", [6 / 5, (4 * Math.sqrt(3)) / 5], { ...basePointStyle("Q", colors.amber), fixed: true });

  board.create("functiongraph", [(x: number) => -Math.sqrt(3) * x + movingIntercept.Value(), -3.2, 4.2], {
    strokeColor: colors.amber,
    strokeWidth: 2,
    highlight: false,
  });
  board.create("functiongraph", [(x: number) => -Math.sqrt(3) * x + tangentIntercept, -3.2, 4.2], {
    strokeColor: colors.green,
    strokeWidth: 3,
    dash: 1,
    highlight: false,
  });
  board.create("functiongraph", [(x: number) => -Math.sqrt(3) * x - tangentIntercept, -3.2, 4.2], {
    strokeColor: colors.red,
    strokeWidth: 1.5,
    dash: 3,
    highlight: false,
  });

  board.create("line", [[0, b], [2, 0]], { straightFirst: false, straightLast: false, strokeColor: colors.green, strokeWidth: 2 });
  board.create("line", [[0, b], [6 / 5, (4 * Math.sqrt(3)) / 5]], { straightFirst: false, straightLast: false, strokeColor: colors.cyan, strokeWidth: 2 });

  const foot = board.create("point", [
    () => (Math.sqrt(3) * movingIntercept.Value()) / 4,
    () => movingIntercept.Value() / 4,
  ], { ...basePointStyle("H", colors.violet), fixed: true }) as JXG.Point;
  board.create("segment", [[0, 0], foot], { strokeColor: colors.violet, strokeWidth: 2, dash: 2 });

  board.create("text", [-2.8, -1.75, () => `圆心到动直线距离 = ${Math.abs(movingIntercept.Value() / 2).toFixed(2)}；半径 = √3 ≈ ${b.toFixed(2)}`], textStyle(colors.violet));
  board.create("text", [-2.8, -2.12, "有效切线：y = -√3x + 2√3"], textStyle(colors.green));
  board.create("text", [0.8, -2.12, "k_AP / k_AQ = 3"], textStyle(colors.amber));
}

function drawTrajectoryClassifier(board: JXG.Board) {
  const root2 = Math.sqrt(2);
  const theta = board.create("slider", [[-5.2, 4.15], [-1.1, 4.15], [0.08, 1.12, 2 * Math.PI - 0.08]], {
    name: "θ",
    snapWidth: 0.01,
    ...sliderStyle(colors.cyan),
  }) as JXG.Slider;
  const tSlider = board.create("slider", [[1.1, 4.15], [5.1, 4.15], [0.55, 1.8, 3.2]], {
    name: "t₀",
    snapWidth: 0.01,
    ...sliderStyle(colors.amber),
  }) as JXG.Slider;
  const t0 = () => tSlider.Value();
  const denom = (u: number) => t0() + root2 * Math.cos(u);
  const px = (u: number) => (root2 * t0() * Math.cos(u)) / denom(u);
  const py = (u: number) => (t0() * Math.sin(u)) / denom(u);
  const safePx = (u: number) => (Math.abs(denom(u)) < 0.05 ? Number.NaN : px(u));
  const safePy = (u: number) => (Math.abs(denom(u)) < 0.05 ? Number.NaN : py(u));

  drawEllipse(board, root2, 1, colors.cyan);
  const a = board.create("point", [() => root2 * Math.cos(theta.Value()), () => Math.sin(theta.Value())], basePointStyle("A", colors.cyan)) as JXG.Point;
  const b = board.create("point", [0, () => Math.sin(theta.Value())], basePointStyle("B", colors.zinc)) as JXG.Point;
  const g = board.create("point", [() => t0(), 0], basePointStyle("G", colors.amber)) as JXG.Point;
  const p = board.create("point", [() => safePx(theta.Value()), () => safePy(theta.Value())], basePointStyle("P", colors.green)) as JXG.Point;

  board.create("line", [[0, 0], a], { straightFirst: false, straightLast: true, strokeColor: colors.cyan, strokeWidth: 2, dash: 2 });
  board.create("line", [g, b], { straightFirst: false, straightLast: true, strokeColor: colors.amber, strokeWidth: 2, dash: 2 });
  board.create("curve", [safePx, safePy, 0.001, 2 * Math.PI - 0.001], {
    strokeColor: colors.green,
    strokeWidth: 3,
    highlight: false,
  });
  board.create("line", [[root2, 0], [root2, 1]], {
    straightFirst: true,
    straightLast: true,
    strokeColor: colors.red,
    strokeWidth: 1.5,
    dash: 3,
  });

  board.create("text", [-5.4, -3.65, () => `1/2 - 1/t₀² = ${(0.5 - 1 / (t0() * t0())).toFixed(3)}`], textStyle(colors.amber));
  board.create("text", [-5.4, -4.05, () => `当前类型：${classifyTrajectory(t0())}`], textStyle(colors.green));
  board.create("text", [0.85, -4.05, `临界：t₀ = √2 ≈ ${root2.toFixed(3)}`], textStyle(colors.red));
}

function classifyTrajectory(t0: number) {
  const boundary = Math.sqrt(2);
  if (Math.abs(t0 - boundary) < 0.03) return "抛物线型";
  if (t0 > boundary) return "椭圆型";
  return "双曲线型";
}

function drawDerivativeProof(board: JXG.Board) {
  const f = (x: number) => Math.exp(x) - (2 / 3) * Math.sin(x);
  const lower = (x: number) => 1 + x / 3;
  const g = (x: number) => f(x) - lower(x);
  const gp = (x: number) => Math.exp(x) - (2 / 3) * Math.cos(x) - 1 / 3;
  const xSlider = board.create("slider", [[-0.38, 2.45], [1.35, 2.45], [-1 / 3, 0.75, 2.1]], {
    name: "x₀",
    snapWidth: 0.01,
    ...sliderStyle(colors.cyan),
  }) as JXG.Slider;
  const nSlider = board.create("slider", [[-0.38, 2.12], [1.35, 2.12], [1, 12, 80]], {
    name: "n",
    snapWidth: 1,
    ...sliderStyle(colors.amber),
  }) as JXG.Slider;

  board.create("functiongraph", [g, -1 / 3, 2.15], { strokeColor: colors.green, strokeWidth: 3, name: "g(x)", highlight: false });
  board.create("functiongraph", [gp, -1 / 3, 2.15], { strokeColor: colors.violet, strokeWidth: 2, dash: 2, name: "g'(x)", highlight: false });
  board.create("line", [[-0.5, 0], [2.35, 0]], { straightFirst: false, straightLast: false, strokeColor: colors.zinc, strokeWidth: 1.5, dash: 2 });
  const point = board.create("point", [() => xSlider.Value(), () => g(xSlider.Value())], basePointStyle("g(x₀)", colors.green)) as JXG.Point;
  const shadow = board.create("point", [() => xSlider.Value(), 0], { ...basePointStyle("", colors.zinc), visible: false }) as JXG.Point;
  board.create("segment", [point, shadow], { strokeColor: colors.amber, strokeWidth: 4 });

  board.create("text", [-0.42, -0.18, () => `g(x₀) = ${g(xSlider.Value()).toFixed(4)}，g'(x₀) = ${gp(xSlider.Value()).toFixed(4)}`], textStyle(colors.green));
  board.create("text", [-0.42, -0.29, () => `Pₙ/(n+1)^(1/3) = ${normalizedProduct(Math.round(nSlider.Value())).toFixed(4)} ；n = ${Math.round(nSlider.Value())}`], textStyle(colors.amber));
  board.create("text", [1.02, 0.28, "绿色：差函数 g(x)"], textStyle(colors.green));
  board.create("text", [1.02, 0.13, "紫色：导数 g'(x)"], textStyle(colors.violet));
}

function normalizedProduct(n: number) {
  let product = 1;
  for (let k = 1; k <= n; k += 1) {
    product *= Math.exp(1 / k) - (2 / 3) * Math.sin(1 / k);
  }
  return product / Math.pow(n + 1, 1 / 3);
}
