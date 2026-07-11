import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Caption } from "../components/Caption";
import { CinematicBrowserFrame } from "../components/CinematicBrowserFrame";
import { SubtleGrid } from "../components/SubtleGrid";
import { captions, metrics } from "../data/promoCopy";

export function SceneProductDemo() {
  const frame = useCurrentFrame();
  const highlightY = interpolate(frame, [80, 160], [340, 598], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill className="scene">
      <SubtleGrid />
      <CinematicBrowserFrame>
        <div className="demo-page">
          <header>
            <strong>ProofArena</strong>
            <span>题目 / 解法 / 讨论 / Studio</span>
          </header>
          <main>
            <section className="demo-problem">
              <span>2026 新高考 · 函数与不等式</span>
              <h2>同一道题，多种解法，正面交锋。</h2>
              <p>先读关键观察，再比较路线、代价和验证位置。</p>
            </section>
            <section className="demo-solutions">
              {["教学解", "几何解", "代数解"].map((item, index) => (
                <article key={item}>
                  <span>Solution {index + 1}</span>
                  <h3>{item}</h3>
                  <p>
                    {index === 0
                      ? "从单调性切入，适合讲解。"
                      : index === 1
                        ? "将条件转化为图形关系。"
                        : "代数路线完整，可复算。"}
                  </p>
                </article>
              ))}
            </section>
            <section className="demo-metrics">
              {metrics.map((metric, index) => (
                <div key={metric}>
                  <span>{metric}</span>
                  <b style={{ width: `${72 + (index % 3) * 8}%` }} />
                </div>
              ))}
            </section>
          </main>
          <div className="demo-highlight" style={{ top: highlightY }} />
        </div>
      </CinematicBrowserFrame>
      <Caption delay={30}>{captions.product}</Caption>
    </AbsoluteFill>
  );
}
