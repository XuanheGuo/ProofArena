import { interpolate, useCurrentFrame } from "remotion";

type GraphNodeProps = {
  label: string;
  x: number;
  y: number;
  delay: number;
};

export function GraphNode({ label, x, y, delay }: GraphNodeProps) {
  const frame = useCurrentFrame();
  const active = interpolate(frame - delay, [0, 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      className="graph-node"
      style={{
        left: x,
        top: y,
        opacity: 0.24 + active * 0.76,
        boxShadow: `0 0 ${active * 40}px rgba(103,232,249,${active * 0.32})`,
      }}
    >
      {label}
    </div>
  );
}
