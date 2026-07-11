import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { Caption } from "../components/Caption";
import { DustField } from "../components/DustField";
import { FloatingBook } from "../components/FloatingBook";
import { Spotlight } from "../components/Spotlight";
import { SubtleGrid } from "../components/SubtleGrid";
import { captions } from "../data/promoCopy";

export function SceneBookOpening() {
  const frame = useCurrentFrame();
  const camera = interpolate(frame, [0, 220], [1, 1.08], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      className="scene scene-book"
      style={{ transform: `scale(${camera})` }}
    >
      <SubtleGrid />
      <Spotlight />
      <DustField />
      <FloatingBook />
      <Caption delay={150}>{captions.book}</Caption>
    </AbsoluteFill>
  );
}
