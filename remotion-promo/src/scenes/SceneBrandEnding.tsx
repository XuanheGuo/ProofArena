import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { SubtleGrid } from "../components/SubtleGrid";
import { captions } from "../data/promoCopy";

export function SceneBrandEnding() {
  const frame = useCurrentFrame();
  const logo = interpolate(frame, [10, 55], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const line = interpolate(frame, [56, 95], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill className="scene ending-scene">
      <SubtleGrid />
      <div
        className="logo-mark"
        style={{ opacity: logo, transform: `scale(${0.9 + logo * 0.1})` }}
      >
        <div className="logo-ring" />
        <div className="logo-axis" />
        <strong>ProofArena</strong>
      </div>
      <p
        className="final-tagline"
        style={{ opacity: line, transform: `translateY(${(1 - line) * 18}px)` }}
      >
        {captions.ending}
      </p>
      <div className="final-subline" style={{ opacity: line * 0.72 }}>
        在解法中交锋，在证明中生长。
      </div>
    </AbsoluteFill>
  );
}
