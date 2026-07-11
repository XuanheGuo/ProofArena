import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { Caption } from "../components/Caption";
import { FormulaParticleField } from "../components/FormulaParticleField";
import { SubtleGrid } from "../components/SubtleGrid";
import { captions } from "../data/promoCopy";

const pageTexts = [
  {
    heading: "原始题面",
    body: "题目被写在纸上，答案被写在纸尾。",
    marks: ["条件", "目标", "取等"],
  },
  {
    heading: "解法分叉",
    body: "同一个条件，可以触发不同的路线。",
    marks: ["教学解", "几何解", "代数解"],
  },
  {
    heading: "可比较结构",
    body: "真正重要的是每条路线的代价、边界和可验证位置。",
    marks: ["正确性", "考场性", "结构美感"],
  },
];

export function SceneProofUnfolds() {
  const frame = useCurrentFrame();
  const bookOpacity = interpolate(frame, [0, 70, 240], [1, 0.8, 0.18], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const pageLift = interpolate(frame, [0, 260], [0, -120], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill className="scene">
      <SubtleGrid />
      <div
        className="proof-book-table"
        style={{
          opacity: bookOpacity,
          transform: `translate(-50%, ${pageLift}px) rotateX(58deg) rotateZ(-4deg)`,
        }}
      >
        <div className="proof-book-spread">
          <div className="proof-page proof-page-left">
            <span>ProofArena Notes</span>
            <h2>从答案到推理</h2>
            <p>一个结果只是结尾。真正需要被保存的，是抵达它的路径。</p>
            <div className="proof-page-lines">
              <i />
              <i />
              <i />
              <i />
            </div>
          </div>
          <div className="proof-page proof-page-right">
            <span>Structured Reasoning</span>
            <h2>观察 / 转化 / 验证</h2>
            <p>每个步骤都可以被比较、挑战、复核、迁移。</p>
            <div className="proof-step-chain">
              <b>观察</b>
              <b>转化</b>
              <b>验证</b>
            </div>
          </div>
          {pageTexts.map((page, index) => {
            const turn = interpolate(frame - 28 - index * 42, [0, 56], [0, 1], {
              easing: Easing.inOut(Easing.cubic),
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const visible = interpolate(
              frame - 20 - index * 42,
              [0, 20, 76, 102],
              [0, 1, 1, 0],
              {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              },
            );
            return (
              <div
                key={page.heading}
                className="proof-turn-page"
                style={{
                  opacity: visible,
                  transform: `translateZ(${42 + index * 5}px) rotateY(${-turn * 172}deg)`,
                }}
              >
                <span>Page 0{index + 1}</span>
                <h3>{page.heading}</h3>
                <p>{page.body}</p>
                <div>
                  {page.marks.map((mark) => (
                    <em key={mark}>{mark}</em>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <FormulaParticleField />
      <div className="proof-words proof-words-rich">
        {[
          "关键观察",
          "解法分支",
          "方法边界",
          "挑战关系",
          "评分维度",
          "可验证步骤",
        ].map((word, index) => (
          <span
            key={word}
            style={{
              opacity: interpolate(frame - index * 14, [20, 50], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              transform: `translateY(${interpolate(
                frame - index * 14,
                [20, 70],
                [28, 0],
                {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                },
              )}px)`,
            }}
          >
            {word}
          </span>
        ))}
      </div>
      <div className="unfold-thesis">
        <strong>数学理解不是一个点。</strong>
        <p>它是一组可以被组织、比较和沉淀的推理关系。</p>
      </div>
      <Caption delay={52}>{captions.unfold}</Caption>
    </AbsoluteFill>
  );
}
