import { interpolate, useCurrentFrame } from "remotion";

export function Spotlight() {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 80], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return <div className="spotlight" style={{ opacity }} />;
}
