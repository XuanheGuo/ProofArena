import { Easing, interpolate, useCurrentFrame } from "remotion";

const transitionCenters = [240, 540, 900, 1170, 1440, 1650];

export function TransitionVeil() {
  const frame = useCurrentFrame();
  const intensity = Math.max(
    ...transitionCenters.map((center) =>
      interpolate(Math.abs(frame - center), [0, 32, 70], [1, 0.32, 0], {
        easing: Easing.out(Easing.cubic),
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      }),
    ),
  );
  const sweepX = interpolate(frame % 300, [0, 300], [-28, 128]);

  return (
    <div className="transition-veil" style={{ opacity: intensity }}>
      <div className="transition-sweep" style={{ left: `${sweepX}%` }} />
      <div className="transition-line transition-line-a" />
      <div className="transition-line transition-line-b" />
    </div>
  );
}
