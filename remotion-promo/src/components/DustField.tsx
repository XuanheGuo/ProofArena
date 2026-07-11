import { interpolate, useCurrentFrame } from "remotion";

const dots = Array.from({ length: 42 }, (_, index) => ({
  id: index,
  left: 8 + ((index * 19) % 84),
  top: 10 + ((index * 31) % 78),
  size: 1 + (index % 3),
  drift: 8 + (index % 9),
}));

export function DustField() {
  const frame = useCurrentFrame();
  return (
    <div className="dust-field">
      {dots.map((dot) => {
        const y = Math.sin((frame + dot.id * 11) / 38) * dot.drift;
        const opacity = interpolate(frame, [0, 90], [0, 0.58], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        return (
          <span
            key={dot.id}
            className="dust"
            style={{
              left: `${dot.left}%`,
              top: `${dot.top}%`,
              width: dot.size,
              height: dot.size,
              opacity,
              transform: `translateY(${y}px)`,
            }}
          />
        );
      })}
    </div>
  );
}
