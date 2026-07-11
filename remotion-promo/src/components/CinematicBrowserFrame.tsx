import { ReactNode } from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";

export function CinematicBrowserFrame({ children }: { children: ReactNode }) {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 24], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const y = interpolate(frame, [0, 42], [64, 0], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const scale = interpolate(frame, [0, 180], [0.94, 1.01], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      className="browser-frame-wrap"
      style={{
        opacity,
        transform: `translateY(${y}px) scale(${scale}) rotateX(4deg) rotateY(-5deg)`,
      }}
    >
      <div className="browser-frame">{children}</div>
    </div>
  );
}
