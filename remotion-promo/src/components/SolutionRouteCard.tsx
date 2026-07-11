import { Easing, interpolate, useCurrentFrame } from "remotion";
import { routeCards } from "../data/promoCopy";

type SolutionRouteCardProps = {
  index: number;
  x: number;
  y: number;
};

export function SolutionRouteCard({ index, x, y }: SolutionRouteCardProps) {
  const frame = useCurrentFrame();
  const item = routeCards[index];
  const delay = 94 + index * 14;
  const opacity = interpolate(frame - delay, [0, 24], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const offset = interpolate(frame - delay, [0, 36], [48, 0], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      className={`route-card accent-${item.accent}`}
      style={{
        opacity,
        transform: `translate(${x + offset}px, ${y}px)`,
      }}
    >
      <span>{item.label}</span>
      <strong>{item.title}</strong>
      <p>{item.detail}</p>
    </div>
  );
}
