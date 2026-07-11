import { Easing, interpolate, useCurrentFrame } from "remotion";

const proofLines = [
  "关键观察：条件指向单调性",
  "构造函数 F(x)",
  "比较边界与取等位置",
  "验证：代入 / 极值 / 图形",
];

export function FloatingBook() {
  const frame = useCurrentFrame();
  const reveal = interpolate(frame, [12, 72], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const open = interpolate(frame, [115, 185], [0, 1], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const content = interpolate(frame, [174, 218], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const floatY = Math.sin(frame / 32) * 10;
  const coverRotate = -6 - open * 154;
  const pageGlow = interpolate(frame, [150, 210], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const rightPageLift = interpolate(frame, [180, 238], [0, 1], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      className="book-stage"
      style={{
        opacity: reveal,
        transform: `translateY(${floatY + (1 - reveal) * 36}px) scale(${0.9 + reveal * 0.1}) rotateX(58deg) rotateZ(-5deg)`,
      }}
    >
      <div className="book-shadow" />
      <div className="book-base">
        <div className="book-spine" />
        <div className="book-cover back-cover left-cover" />
        <div className="book-cover back-cover right-cover" />
        <div className="book-paper-stack left-stack">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="stack-page"
              style={{ transform: `translateZ(${index * 1.8}px)` }}
            />
          ))}
        </div>
        <div className="book-paper-stack right-stack">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="stack-page"
              style={{ transform: `translateZ(${index * 1.8}px)` }}
            />
          ))}
        </div>
        <div className="inner-page left-inner" style={{ opacity: open }}>
          <span className="page-kicker">Problem</span>
          <strong>一道题不只是答案</strong>
          <p>它包含观察、选择、转化、验证和边界。</p>
          <div className="mini-proof-map">
            <i />
            <i />
            <i />
          </div>
        </div>
        <div className="inner-page right-inner" style={{ opacity: open }}>
          <span className="page-kicker">Proof Notes</span>
          {proofLines.map((line, index) => (
            <p
              key={line}
              style={{
                opacity: content,
                transform: `translateX(${(1 - content) * (18 + index * 4)}px)`,
              }}
            >
              {line}
            </p>
          ))}
        </div>
        <div
          className="turning-page"
          style={{
            opacity: rightPageLift,
            transform: `translateZ(34px) rotateY(${-rightPageLift * 168}deg)`,
          }}
        >
          <span>解法 A</span>
          <span>解法 B</span>
          <span>解法 C</span>
        </div>
        <div
          className="book-cover front-cover"
          style={{ transform: `translateZ(24px) rotateY(${coverRotate}deg)` }}
        >
          <span>ProofArena</span>
          <small>Mathematical Reasoning</small>
        </div>
        <div className="page-light" style={{ opacity: pageGlow }} />
      </div>
    </div>
  );
}
