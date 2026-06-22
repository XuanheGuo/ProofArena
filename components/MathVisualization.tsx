"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Crosshair, Expand, MousePointer2, RotateCcw } from "lucide-react";

type VisualizationKind = "ellipse-tianjin" | "derivative-bound";

interface VisualizationSpec {
  kind: VisualizationKind;
  title: string;
  description: string;
  insight: string;
}

const visualizationSpecs: Record<string, VisualizationSpec> = {
  "tj-2026-18": {
    kind: "ellipse-tianjin",
    title: "椭圆结构实验台",
    description: "拖动参数 t，观察椭圆 x²/4+y²/3=1 上的点、两焦点和焦半径如何同步变化。",
    insight: "离心率为 1/2 时焦点为 (±1,0)；点在椭圆上移动时，两条焦半径之和始终为 2a=4。",
  },
  "tj-2026-20": {
    kind: "derivative-bound",
    title: "函数与下界实验台",
    description: "拖动 x₀，比较函数 f(x)=eˣ-(2/3)sin x 与直线 y=1+x/3 的高度差。",
    insight: "证明不等式，本质是在观察差函数始终位于 x 轴上方。",
  },
};

export function MathVisualization({ problemId }: { problemId: string }) {
  const reactId = useId();
  const boardId = `math-viz-${reactId.replace(/:/g, "")}`;
  const boardRef = useRef<JXG.Board | null>(null);
  const [ready, setReady] = useState(false);
  const spec = visualizationSpecs[problemId];

  useEffect(() => {
    if (!spec) return;
    let disposed = false;

    async function initialize() {
      const JXGModule = await import("jsxgraph");
      if (disposed) return;
      const JXGApi = JXGModule.default ?? JXGModule;
      if (boardRef.current) {
        JXGApi.JSXGraph.freeBoard(boardRef.current);
      }

      const dark = document.documentElement.dataset.theme !== "light";
      const board = JXGApi.JSXGraph.initBoard(boardId, {
        boundingBox: spec.kind.startsWith("ellipse") ? [-5, 4.5, 5, -4.5] : [-4, 6, 5, -5],
        axis: true,
        keepAspectRatio: spec.kind.startsWith("ellipse"),
        showCopyright: false,
        showNavigation: true,
        pan: { enabled: true },
        zoom: { wheel: true },
        defaultAxes: {
          x: {
            strokeColor: dark ? "#71717a" : "#52525b",
            ticks: { strokeColor: dark ? "#52525b" : "#a1a1aa", label: { color: dark ? "#a1a1aa" : "#52525b" } },
          },
          y: {
            strokeColor: dark ? "#71717a" : "#52525b",
            ticks: { strokeColor: dark ? "#52525b" : "#a1a1aa", label: { color: dark ? "#a1a1aa" : "#52525b" } },
          },
        },
      });
      boardRef.current = board;

      if (spec.kind === "ellipse-tianjin") drawTianjinEllipse(board);
      if (spec.kind === "derivative-bound") drawDerivativeBound(board);
      setReady(true);
    }

    void initialize();
    const observer = new MutationObserver(() => void initialize());
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    return () => {
      disposed = true;
      observer.disconnect();
      void import("jsxgraph").then((module) => {
        const JXGApi = module.default ?? module;
        if (boardRef.current) JXGApi.JSXGraph.freeBoard(boardRef.current);
        boardRef.current = null;
      });
    };
  }, [boardId, spec]);

  if (!spec) return null;

  function resetView() {
    const board = boardRef.current;
    if (!board) return;
    board.setBoundingBox(spec.kind.startsWith("ellipse") ? [-5, 4.5, 5, -4.5] : [-4, 6, 5, -5], true);
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
            <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">Interactive graph</span>
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

      <div className="grid lg:grid-cols-[1fr_18rem]">
        <div className="relative min-h-80 border-b border-white/10 bg-black/20 lg:min-h-[30rem] lg:border-r lg:border-b-0">
          <div id={boardId} className="jxgbox absolute inset-0 size-full border-0 bg-transparent" />
          {!ready && <div className="absolute inset-0 grid place-items-center text-sm text-zinc-500">正在绘制...</div>}
        </div>
        <aside className="p-5">
          <div className="flex items-center gap-2 text-xs font-bold text-cyan-300">
            <MousePointer2 className="size-4" />
            怎么操作
          </div>
          <p className="mt-3 text-sm leading-7 text-zinc-400">{spec.description}</p>
          <div className="mt-6 border-l-2 border-amber-400 bg-amber-400/5 p-4">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
              <Expand className="size-4" />
              看懂什么
            </div>
            <p className="mt-3 text-sm leading-7 text-zinc-300">{spec.insight}</p>
          </div>
          <p className="mt-5 font-mono text-[10px] uppercase leading-5 text-zinc-600">
            Drag points / move sliders / wheel to zoom
          </p>
        </aside>
      </div>
    </section>
  );
}

function basePointStyle(name: string, color: string) {
  return { name, size: 4, strokeColor: color, fillColor: color, label: { color, offset: [8, 8] } };
}

function drawTianjinEllipse(board: JXG.Board) {
  const a = 2;
  const b = Math.sqrt(3);
  const c = 1;
  const slider = board.create("slider", [[-4, 3.7], [0, 3.7], [0, 0.7, 2 * Math.PI]], {
    name: "t",
    strokeColor: "#22d3ee",
    fillColor: "#22d3ee",
    highline: { strokeColor: "#22d3ee" },
    label: { color: "#22d3ee" },
  }) as JXG.Slider;
  const f1 = board.create("point", [-c, 0], { ...basePointStyle("F₁", "#f87171"), fixed: true }) as JXG.Point;
  const f2 = board.create("point", [c, 0], { ...basePointStyle("F₂", "#f87171"), fixed: true }) as JXG.Point;
  const point = board.create("point", [
    () => a * Math.cos(slider.Value()),
    () => b * Math.sin(slider.Value()),
  ], basePointStyle("P", "#22d3ee")) as JXG.Point;

  board.create("curve", [
    (t: number) => a * Math.cos(t),
    (t: number) => b * Math.sin(t),
    0,
    2 * Math.PI,
  ], { strokeColor: "#22d3ee", strokeWidth: 3 });
  board.create("segment", [point, f1], { strokeColor: "#fbbf24", dash: 2, strokeWidth: 2 });
  board.create("segment", [point, f2], { strokeColor: "#fbbf24", dash: 2, strokeWidth: 2 });
  board.create("point", [0, b], { ...basePointStyle("A", "#a3e635"), fixed: true });
  board.create("text", [-4, -3.7, () => `PF₁ + PF₂ = ${(point.Dist(f1) + point.Dist(f2)).toFixed(3)} = 4`], {
    color: "#a3e635",
    fontSize: 14,
    fixed: true,
  });
}

function drawDerivativeBound(board: JXG.Board) {
  const f = (x: number) => Math.exp(x) - (2 / 3) * Math.sin(x);
  const lower = (x: number) => 1 + x / 3;
  const slider = board.create("slider", [[-3.4, 5.1], [1.2, 5.1], [-1 / 3, 0.8, 2.2]], {
    name: "x₀",
    strokeColor: "#22d3ee",
    fillColor: "#22d3ee",
    highline: { strokeColor: "#22d3ee" },
    label: { color: "#22d3ee" },
  }) as JXG.Slider;
  board.create("functiongraph", [f, -1 / 3, 2.3], { strokeColor: "#22d3ee", strokeWidth: 3, name: "f(x)" });
  board.create("functiongraph", [lower, -1 / 3, 2.3], { strokeColor: "#f87171", strokeWidth: 2, dash: 2, name: "1+x/3" });
  const p = board.create("point", [() => slider.Value(), () => f(slider.Value())], basePointStyle("f(x₀)", "#22d3ee")) as JXG.Point;
  const q = board.create("point", [() => slider.Value(), () => lower(slider.Value())], basePointStyle("L(x₀)", "#f87171")) as JXG.Point;
  board.create("segment", [p, q], { strokeColor: "#fbbf24", strokeWidth: 4 });
  board.create("text", [-3.4, -4.2, () => `差值 = ${(f(slider.Value()) - lower(slider.Value())).toFixed(3)}`], {
    color: "#fbbf24",
    fontSize: 14,
    fixed: true,
  });
}
