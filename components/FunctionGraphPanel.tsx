"use client";

import { useEffect, useId, useRef, useState } from "react";
import { BarChart2, Crosshair, Expand, MousePointer2, RotateCcw } from "lucide-react";
import { MathBlock } from "@/components/MathBlock";
import type { FunctionGraphSpec, GraphColor } from "@/lib/types";

type JXGApi = typeof import("jsxgraph");

const darkColors: Record<GraphColor, string> = {
  cyan: "#22d3ee",
  amber: "#fbbf24",
  red: "#f87171",
  green: "#a3e635",
  violet: "#c084fc",
  zinc: "#a1a1aa",
};

const lightColors: Record<GraphColor, string> = {
  cyan: "#0e7490",
  amber: "#a16207",
  red: "#be123c",
  green: "#047857",
  violet: "#7e22ce",
  zinc: "#52525b",
};

const dashMap = { solid: 0, dashed: 2 } as const;

export function FunctionGraphPanel({ spec }: { spec: FunctionGraphSpec }) {
  const reactId = useId();
  const boardId = `fg-${reactId.replace(/:/g, "")}`;
  const boardRef = useRef<JXG.Board | null>(null);
  const slidersRef = useRef<Map<string, JXG.Slider>>(new Map());
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let disposed = false;
    let localBoard: JXG.Board | null = null;
    let localApi: JXGApi | null = null;

    async function initialize() {
      setReady(false);
      setFailed(false);
      try {
        await waitForElement(boardId);
        if (disposed) return;

        const JXG = await withTimeout(import("jsxgraph"), 8000);
        if (disposed) return;
        localApi = JXG;

        if (boardRef.current) JXG.JSXGraph.freeBoard(boardRef.current);

        const dark = document.documentElement.dataset.theme !== "light";
        const c = dark ? darkColors : lightColors;
        const axisColor = dark ? "#71717a" : "#52525b";
        const tickColor = dark ? "#52525b" : "#a1a1aa";

        const board = JXG.JSXGraph.initBoard(boardId, {
          boundingBox: spec.boundingBox,
          axis: true,
          keepAspectRatio: spec.keepAspectRatio ?? false,
          showCopyright: false,
          showNavigation: true,
          pan: { enabled: true },
          zoom: { wheel: true },
          defaultAxes: {
            x: { strokeColor: axisColor, ticks: { strokeColor: tickColor, label: { color: dark ? "#a1a1aa" : "#52525b" } } },
            y: { strokeColor: axisColor, ticks: { strokeColor: tickColor, label: { color: dark ? "#a1a1aa" : "#52525b" } } },
          },
        });
        localBoard = board;
        boardRef.current = board;

        // Compute slider layout from bounding box
        const [xMin, yMax, xMax, yMin] = spec.boundingBox;
        const w = xMax - xMin;
        const h = yMax - yMin;
        const sliderX1 = xMin + 0.04 * w;
        const sliderX2 = xMin + 0.40 * w;
        const sliderStartY = yMax - 0.07 * h;
        const sliderStep = 0.11 * h;

        // Create sliders
        const sliderMap = new Map<string, JXG.Slider>();
        for (let i = 0; i < spec.sliders.length; i++) {
          const s = spec.sliders[i];
          const y = sliderStartY - i * sliderStep;
          const color = c.cyan;
          const slider = board.create(
            "slider",
            [[sliderX1, y], [sliderX2, y], [s.min, s.initial, s.max]],
            {
              name: s.label,
              snapWidth: s.step,
              strokeColor: color,
              fillColor: color,
              highline: { strokeColor: color },
              baseline: { strokeColor: dark ? "#3f3f46" : "#d4d4d8" },
              label: { color },
            },
          ) as JXG.Slider;
          sliderMap.set(s.name, slider);
        }

        slidersRef.current = sliderMap;

        function getParams(): Record<string, number> {
          const result: Record<string, number> = {};
          for (const [name, slider] of sliderMap) result[name] = slider.Value();
          return result;
        }

        // Draw traces (standard function graphs)
        for (const trace of spec.traces ?? []) {
          const color = c[trace.color ?? "cyan"];
          const [domMin, domMax] = trace.domain ?? [xMin, xMax];
          board.create(
            "functiongraph",
            [(x: number) => trace.fn(x, getParams()), domMin, domMax],
            {
              strokeColor: color,
              strokeWidth: trace.width ?? 2.5,
              dash: dashMap[trace.style ?? "solid"],
              highlight: false,
            },
          );
        }

        // Draw optional fixed/dynamic points
        for (const pt of spec.points ?? []) {
          const px = typeof pt.x === "function" ? () => (pt.x as (p: Record<string, number>) => number)(getParams()) : pt.x;
          const py = typeof pt.y === "function" ? () => (pt.y as (p: Record<string, number>) => number)(getParams()) : pt.y;
          const color = c[pt.color ?? "amber"];
          board.create("point", [px, py], {
            name: pt.label ?? "",
            size: 4,
            strokeColor: color,
            fillColor: color,
            label: { color, offset: [8, 8] },
            fixed: typeof pt.x !== "function" && typeof pt.y !== "function",
          });
        }

        // Custom draw function for complex visualizations
        spec.draw?.(board, sliderMap, c, dark);

        setReady(true);
      } catch (err) {
        console.error("FunctionGraphPanel init failed", err);
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
      if (localBoard && localApi) localApi.JSXGraph.freeBoard(localBoard);
      if (boardRef.current === localBoard) boardRef.current = null;
    };
  }, [boardId, spec]);

  function resetView() {
    boardRef.current?.setBoundingBox(spec.boundingBox, true);
  }

  function resetParams() {
    const board = boardRef.current;
    if (!board) return;
    for (const s of spec.sliders) {
      const slider = slidersRef.current.get(s.name);
      if (slider) slider.setValue(s.initial);
    }
    board.update();
  }

  return (
    <section className="border border-cyan-400/25 bg-zinc-950">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center bg-cyan-400 text-zinc-950">
            <BarChart2 className="size-5" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-white">{spec.title}</h2>
            <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">动态图像</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={resetParams}
            className="inline-flex h-9 items-center gap-2 border border-white/10 px-3 text-xs text-zinc-400 hover:text-white"
          >
            <RotateCcw className="size-3.5" />
            重置参数
          </button>
          <button
            type="button"
            onClick={resetView}
            className="inline-flex h-9 items-center gap-2 border border-white/10 px-3 text-xs text-zinc-400 hover:text-white"
          >
            重置视图
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_19rem]">
        <div className="relative min-h-96 border-b border-white/10 bg-black/20 lg:min-h-[34rem] lg:border-r lg:border-b-0">
          <div id={boardId} className="jxgbox absolute inset-0 size-full border-0 bg-transparent" />
          {!ready && (
            <div className="absolute inset-0 grid place-items-center text-sm text-zinc-500">
              正在绘制...
            </div>
          )}
          {failed && (
            <div className="absolute inset-0 grid place-items-center bg-black/60 px-8 text-center text-sm leading-7 text-zinc-400">
              图像初始化失败，请刷新页面。
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
          {spec.insight && (
            <div className="mt-6 border-l-2 border-amber-400 bg-amber-400/5 p-4">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                <Expand className="size-4" />
                看懂什么
              </div>
              <p className="mt-3 text-sm leading-7 text-zinc-300">
                <MathBlock>{spec.insight}</MathBlock>
              </p>
            </div>
          )}
          <div className="mt-5 space-y-2">
            {spec.sliders.map((s) => (
              <div key={s.name} className="flex items-center justify-between text-xs text-zinc-500">
                <span className="font-mono text-cyan-400">{s.label}</span>
                <span>[{s.min}, {s.max}]，步长 {s.step}</span>
              </div>
            ))}
          </div>
          <p className="mt-5 font-mono text-[10px] uppercase leading-5 text-zinc-600">
            拖动滑块 · 滚轮缩放 · 拖拽平移
          </p>
        </aside>
      </div>
    </section>
  );
}

async function waitForElement(id: string) {
  for (let i = 0; i < 30; i++) {
    const el = document.getElementById(id);
    const rect = el?.getBoundingClientRect();
    if (rect && rect.width > 0 && rect.height > 0) return;
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
  throw new Error("FunctionGraphPanel container not ready");
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let id: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    id = setTimeout(() => reject(new Error("JSXGraph load timeout")), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (id) clearTimeout(id);
  }
}
