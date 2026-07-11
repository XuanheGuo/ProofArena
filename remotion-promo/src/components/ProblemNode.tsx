import {
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { mockProblem } from "../data/mockArena";

export function ProblemNode() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scale = spring({
    frame: frame - 60,
    fps,
    config: { damping: 18, stiffness: 90 },
  });
  const opacity = interpolate(frame, [40, 72], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      className="problem-node"
      style={{ opacity, transform: `translate(-50%, -50%) scale(${scale})` }}
    >
      <div className="eyebrow">
        {mockProblem.id} / {mockProblem.subtitle}
      </div>
      <h2>{mockProblem.title}</h2>
      <p>{mockProblem.statement}</p>
      <div className="problem-stats">
        <span>难度 {mockProblem.difficulty}</span>
        <span>{mockProblem.solutions} 条解法</span>
        <span>{mockProblem.discussions} 条讨论</span>
      </div>
    </div>
  );
}
