import { Easing, interpolate, useCurrentFrame } from "remotion";

type AnimatedConnectorProps = {
  top: number;
  rotate?: number;
  delay?: number;
};

export function AnimatedConnector({
  top,
  rotate = 0,
  delay = 90,
}: AnimatedConnectorProps) {
  const frame = useCurrentFrame();
  const width = interpolate(frame - delay, [0, 44], [0, 350], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      className="connector"
      style={{
        top,
        width,
        transform: `rotate(${rotate}deg)`,
      }}
    />
  );
}
