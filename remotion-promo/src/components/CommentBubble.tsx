import { interpolate, useCurrentFrame } from "remotion";
import { mockComments } from "../data/mockArena";

export function CommentBubble({
  index,
  left,
  top,
}: {
  index: number;
  left: number;
  top: number;
}) {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame - 115 - index * 10, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      className="comment-bubble"
      style={{
        left,
        top,
        opacity,
        transform: `translateY(${Math.sin((frame + index * 17) / 34) * 8}px)`,
      }}
    >
      {mockComments[index % mockComments.length]}
    </div>
  );
}
