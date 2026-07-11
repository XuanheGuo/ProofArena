import { Easing, interpolate, useCurrentFrame } from "remotion";

export function ArenaRings() {
  const frame = useCurrentFrame();
  const reveal = interpolate(frame, [36, 120], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      className="arena-rings"
      style={{ opacity: reveal, transform: `scale(${0.78 + reveal * 0.22})` }}
    >
      <div className="ring ring-outer" />
      <div className="ring ring-mid" />
      <div className="ring ring-inner" />
      <div className="arena-axis arena-axis-x" />
      <div className="arena-axis arena-axis-y" />
    </div>
  );
}
