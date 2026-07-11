import { interpolate, useCurrentFrame } from "remotion";

type CaptionProps = {
  children: string;
  delay?: number;
  className?: string;
};

export function Caption({ children, delay = 0, className = "" }: CaptionProps) {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame - delay, [0, 24], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const y = interpolate(frame - delay, [0, 24], [18, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      className={`caption ${className}`}
      style={{ opacity, transform: `translateY(${y}px)` }}
    >
      {children}
    </div>
  );
}
