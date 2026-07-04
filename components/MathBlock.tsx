"use client";

import { BlockMath, InlineMath } from "react-katex";
import {
  exactMathTokenPattern,
  mathTokenPattern,
  normalizeBlockMath,
  normalizeLatexShorthand,
  splitPlainMathCandidates,
  unwrapMath,
  wrapBareLatexCommands,
} from "@/lib/math-normalizer";

interface MathBlockProps {
  children: string;
  block?: boolean;
  className?: string;
}

function renderMixedMath(content: string) {
  const parts = wrapBareLatexCommands(content).split(mathTokenPattern).filter((part) => part.length > 0);

  return parts.map((part, index) => {
    if (exactMathTokenPattern.test(part)) {
      const { math, display } = unwrapMath(part);
      const key = `${part}-${index}`;
      return display ? (
        <span key={key} className="my-2 block">
          <BlockMath math={normalizeLatexShorthand(math.trim())} />
        </span>
      ) : (
        <InlineMath key={key} math={normalizeLatexShorthand(math.trim())} />
      );
    }
    return splitPlainMathCandidates(part).map((candidate, candidateIndex) => {
      const key = `${part}-${index}-${candidateIndex}`;
      if (candidate.type === "math") {
        return <InlineMath key={key} math={candidate.value} />;
      }
      return <span key={key}>{candidate.value}</span>;
    });
  });
}

export function MathBlock({ children, block = false, className = "" }: MathBlockProps) {
  if (block) {
    return (
      <div className={`math-scroll ${className}`}>
        <BlockMath math={normalizeBlockMath(children)} />
      </div>
    );
  }

  return <span className={className}>{renderMixedMath(children)}</span>;
}
