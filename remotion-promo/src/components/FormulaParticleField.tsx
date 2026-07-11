import { Easing, interpolate, useCurrentFrame } from "remotion";
import { formulas } from "../data/formulas";

type FormulaParticleFieldProps = {
  mode?: "scatter" | "gather";
};

export function FormulaParticleField({
  mode = "scatter",
}: FormulaParticleFieldProps) {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [0, 240], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div className="formula-layer">
      {formulas.map((formula, index) => {
        const angle = index * 0.72;
        const radius =
          mode === "gather"
            ? 520 * (1 - progress) + 160
            : 80 + progress * (210 + index * 12);
        const x = Math.cos(angle + frame / 130) * radius;
        const y = Math.sin(angle + frame / 150) * radius * 0.55;
        const opacity = interpolate(frame - index * 5, [0, 28], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const scale = 0.72 + (index % 4) * 0.08;
        return (
          <span
            key={formula}
            className="formula-particle"
            style={{
              opacity,
              transform: `translate(${x}px, ${y}px) scale(${scale})`,
            }}
          >
            {formula}
          </span>
        );
      })}
    </div>
  );
}
