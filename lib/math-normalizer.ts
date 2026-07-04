export const mathTokenPattern = /(\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\$\$[\s\S]+?\$\$|\$[^$]+\$)/g;
export const exactMathTokenPattern = /^(\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\$\$[\s\S]+?\$\$|\$[^$]+\$)$/;

// Matches bare LaTeX command sequences not yet wrapped in math delimiters.
// Handles one level of nested braces: \frac{a}{b}, \sqrt{n}, \sum_{i=1}^n etc.
const latexCmdPattern = /\\[a-zA-Z]+(?:\{(?:[^{}]|\{[^{}]*\})*\}|\[[^\]]*\]|[_^](?:\{[^{}]*\}|[A-Za-z0-9]))*/g;

/**
 * Wraps bare LaTeX command sequences (those not already inside $, $$, \[, or \() in $…$.
 * This handles user-submitted content that uses \frac, \sqrt, etc. without delimiters.
 */
export function wrapBareLatexCommands(text: string): string {
  if (!/\\[a-zA-Z]/.test(text)) return text;
  // Split on existing delimiters; only touch the plain-text segments (even indices)
  const segments = text.split(mathTokenPattern);
  return segments
    .map((seg, i) => (i % 2 === 0 ? seg.replace(latexCmdPattern, (m) => `$${m}$`) : seg))
    .join("");
}

const greekWords: Record<string, string> = {
  alpha: "\\alpha",
  beta: "\\beta",
  gamma: "\\gamma",
  delta: "\\delta",
  theta: "\\theta",
  lambda: "\\lambda",
  mu: "\\mu",
  pi: "\\pi",
  sigma: "\\sigma",
  phi: "\\phi",
  omega: "\\omega",
};

const greekSymbols: Record<string, string> = {
  α: "\\alpha",
  β: "\\beta",
  γ: "\\gamma",
  δ: "\\delta",
  θ: "\\theta",
  λ: "\\lambda",
  μ: "\\mu",
  π: "\\pi",
  σ: "\\sigma",
  φ: "\\phi",
  ω: "\\omega",
};

const candidatePattern = /[A-Za-z0-9α-ωΑ-Ω√πΠ+\-*/=<>≤≥≠^_().]+(?:\s*[+\-*/=<>≤≥≠]\s*[A-Za-z0-9α-ωΑ-Ω√πΠ+\-*/=<>≤≥≠^_().]+)*/g;

export function unwrapMath(token: string) {
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

export function normalizeBlockMath(content: string) {
  const trimmed = content.trim();
  if (trimmed.startsWith("\\[") && trimmed.endsWith("\\]")) return normalizeLatexShorthand(trimmed.slice(2, -2));
  if (trimmed.startsWith("$$") && trimmed.endsWith("$$")) return normalizeLatexShorthand(trimmed.slice(2, -2));
  if (trimmed.startsWith("$") && trimmed.endsWith("$")) return normalizeLatexShorthand(trimmed.slice(1, -1));
  return normalizeLatexShorthand(trimmed);
}

export function normalizeLatexShorthand(value: string) {
  return value
    .replace(/≤/g, "\\le ")
    .replace(/≥/g, "\\ge ")
    .replace(/≠/g, "\\ne ")
    .replace(/<=/g, "\\le ")
    .replace(/>=/g, "\\ge ")
    .replace(/!=/g, "\\ne ")
    .replace(/×/g, "\\times ")
    .replace(/÷/g, "\\div ")
    .replace(/√\(([^()]+)\)/g, "\\sqrt{$1}")
    .replace(/sqrt\(([^()]+)\)/gi, "\\sqrt{$1}")
    .replace(/√([A-Za-z0-9πΠα-ωΑ-Ω]+(?:\^\d+)?)/g, "\\sqrt{$1}")
    .replace(/[α-ωπ]/g, (symbol) => greekSymbols[symbol] ?? symbol)
    .replace(/\b(alpha|beta|gamma|delta|theta|lambda|mu|pi|sigma|phi|omega)\b/g, (word) => greekWords[word] ?? word);
}

export function isPlainMathCandidate(value: string) {
  const trimmed = value.trim();
  if (!trimmed || /^[0-9.]+$/.test(trimmed)) return false;
  if (/[√π≤≥≠^_=<>*/]|<=|>=|!=/.test(trimmed)) return true;
  if (/[α-ω]/.test(trimmed)) return true;
  if (/\b(sin|cos|tan|ln|log|sqrt|alpha|beta|gamma|delta|theta|lambda|pi)\b/i.test(trimmed)) return true;
  if (/[0-9][A-Za-z]|[A-Za-z][0-9]/.test(trimmed)) return true;
  return false;
}

export function convertPlainMathTextToLatex(value: string) {
  return value
    .split(mathTokenPattern)
    .map((part) => {
      if (!part || exactMathTokenPattern.test(part)) return part;
      return part.replace(candidatePattern, (candidate) => {
        if (!isPlainMathCandidate(candidate)) return candidate;
        return `$${normalizeLatexShorthand(candidate)}$`;
      });
    })
    .join("");
}

export function splitPlainMathCandidates(value: string) {
  const parts: Array<{ type: "text" | "math"; value: string }> = [];
  let lastIndex = 0;

  for (const match of value.matchAll(candidatePattern)) {
    const candidate = match[0];
    const index = match.index ?? 0;
    if (index > lastIndex) {
      parts.push({ type: "text", value: value.slice(lastIndex, index) });
    }
    if (isPlainMathCandidate(candidate)) {
      parts.push({ type: "math", value: normalizeLatexShorthand(candidate) });
    } else {
      parts.push({ type: "text", value: candidate });
    }
    lastIndex = index + candidate.length;
  }

  if (lastIndex < value.length) {
    parts.push({ type: "text", value: value.slice(lastIndex) });
  }

  return parts;
}
