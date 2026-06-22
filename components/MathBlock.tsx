"use client";

import { BlockMath, InlineMath } from "react-katex";

interface MathBlockProps {
  children: string;
  block?: boolean;
  className?: string;
}

function renderMixedMath(content: string) {
  return content.split(/(\$[^$]+\$)/g).map((part, index) => {
    if (part.startsWith("$") && part.endsWith("$")) {
      return <InlineMath key={`${part}-${index}`} math={part.slice(1, -1)} />;
    }
    return <span key={`${part}-${index}`}>{part}</span>;
  });
}

export function MathBlock({ children, block = false, className = "" }: MathBlockProps) {
  if (block) {
    return (
      <div className={`math-scroll ${className}`}>
        <BlockMath math={children.replace(/^\$|\$$/g, "")} />
      </div>
    );
  }

  return <span className={className}>{renderMixedMath(children)}</span>;
}
