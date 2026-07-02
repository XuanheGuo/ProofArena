"use client";

import { BlockMath, InlineMath } from "react-katex";

interface MathBlockProps {
  children: string;
  block?: boolean;
  className?: string;
}

const mathTokenPattern = /(\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\$\$[\s\S]+?\$\$|\$[^$\n]+\$)/g;
const exactMathTokenPattern = /^(\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\$\$[\s\S]+?\$\$|\$[^$\n]+\$)$/;

function unwrapMath(token: string) {
  if (token.startsWith("\\[") && token.endsWith("\\]")) {
    return { math: token.slice(2, -2), display: true };
  }
  if (token.startsWith("\\(") && token.endsWith("\\)")) {
    return { math: token.slice(2, -2), display: false };
  }
  if (token.startsWith("$$") && token.endsWith("$$")) {
    return { math: token.slice(2, -2), display: true };
  }
  return { math: token.slice(1, -1), display: false };
}

function normalizeBlockMath(content: string) {
  const trimmed = content.trim();
  if (trimmed.startsWith("\\[") && trimmed.endsWith("\\]")) return trimmed.slice(2, -2);
  if (trimmed.startsWith("$$") && trimmed.endsWith("$$")) return trimmed.slice(2, -2);
  if (trimmed.startsWith("$") && trimmed.endsWith("$")) return trimmed.slice(1, -1);
  return trimmed;
}

function renderMixedMath(content: string) {
  const parts = content.split(mathTokenPattern).filter((part) => part.length > 0);

  return parts.map((part, index) => {
    if (exactMathTokenPattern.test(part)) {
      const { math, display } = unwrapMath(part);
      const key = `${part}-${index}`;
      return display ? (
        <span key={key} className="my-2 block">
          <BlockMath math={math.trim()} />
        </span>
      ) : (
        <InlineMath key={key} math={math.trim()} />
      );
    }
    return <span key={`${part}-${index}`}>{part}</span>;
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
