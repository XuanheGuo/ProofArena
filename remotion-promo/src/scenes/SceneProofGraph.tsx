import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Caption } from "../components/Caption";
import { GraphNode } from "../components/GraphNode";
import { SubtleGrid } from "../components/SubtleGrid";
import { captions, graphNodes } from "../data/promoCopy";

const positions = [
  [365, 520],
  [680, 360],
  [980, 540],
  [1260, 310],
  [1510, 610],
] as const;

export function SceneProofGraph() {
  const frame = useCurrentFrame();
  const lineOpacity = interpolate(frame, [20, 90], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill className="scene">
      <SubtleGrid />
      <svg
        className="graph-lines"
        viewBox="0 0 1920 1080"
        style={{ opacity: lineOpacity }}
      >
        <path d="M455 560 C560 520 585 405 680 390" />
        <path d="M790 400 C850 430 900 510 980 560" />
        <path d="M1088 548 C1135 470 1195 340 1260 348" />
        <path d="M1378 360 C1425 440 1460 555 1510 628" />
        <path d="M680 390 C760 640 1230 700 1510 628" className="muted-line" />
      </svg>
      {graphNodes.map((node, index) => (
        <GraphNode
          key={node}
          label={node}
          x={positions[index][0]}
          y={positions[index][1]}
          delay={42 + index * 20}
        />
      ))}
      <div className="graph-title">
        <span>Proof Graph</span>
        <h2>观察、转化、验证、边界、挑战</h2>
        <p>
          ProofArena
          要沉淀的不是“答案文本”，而是可以继续被引用、比较和改进的推理资产。
        </p>
      </div>
      <div className="review-pipeline">
        {["提交解法", "结构化拆解", "审核验证", "进入图谱"].map(
          (item, index) => (
            <div
              key={item}
              style={{
                opacity: interpolate(frame - 82 - index * 16, [0, 18], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                }),
                transform: `translateY(${interpolate(
                  frame - 82 - index * 16,
                  [0, 18],
                  [18, 0],
                  {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  },
                )}px)`,
              }}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{item}</strong>
            </div>
          ),
        )}
      </div>
      <Caption delay={40}>{captions.graph}</Caption>
    </AbsoluteFill>
  );
}
