import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { Caption } from "../components/Caption";
import { SubtleGrid } from "../components/SubtleGrid";
import { captions, metrics, routeCards } from "../data/promoCopy";
import { theme } from "../styles/theme";

const values = [
  [92, 78, 86, 70, 94],
  [88, 74, 96, 82, 80],
  [95, 90, 78, 88, 72],
];

export function SceneScoreMatrix() {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill className="scene">
      <SubtleGrid />
      <div className="matrix-shell">
        <div className="matrix-heading">
          <span>ProofArena Score Matrix</span>
          <h2>解法不只分对错</h2>
          <p>
            比较不是为了选出唯一胜者，而是看清每条路线的适用场景、代价和边界。
          </p>
        </div>
        <div className="matrix">
          <div className="matrix-row matrix-label-row">
            <span />
            {metrics.map((metric) => (
              <strong key={metric}>{metric}</strong>
            ))}
          </div>
          {routeCards.map((route, row) => (
            <div key={route.label} className="matrix-row">
              <span className={`matrix-route accent-${route.accent}`}>
                {route.label}
              </span>
              {metrics.map((metric, col) => {
                const width = interpolate(
                  frame - row * 14 - col * 5,
                  [20, 62],
                  [0, values[row][col]],
                  {
                    easing: Easing.out(Easing.cubic),
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  },
                );
                const color =
                  col === row + 1 ? theme.colors.amber : theme.colors.cyan;
                return (
                  <div key={metric} className="score-cell">
                    <div className="score-track">
                      <div
                        className="score-fill"
                        style={{ width: `${width}%`, background: color }}
                      />
                    </div>
                    <em>{Math.round(width)}</em>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <div className="boundary-insight">
          <div>
            <span>Connection</span>
            <strong>在联系中建立理解</strong>
            <p>同一个观察可以通向不同方法，方法之间不是孤岛。</p>
          </div>
          <div>
            <span>Boundary</span>
            <strong>在对比中看清边界</strong>
            <p>一个方法何时优雅，何时绕远，何时失效，必须被说清。</p>
          </div>
        </div>
      </div>
      <Caption delay={36}>{captions.matrix}</Caption>
    </AbsoluteFill>
  );
}
