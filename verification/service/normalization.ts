import { createHash } from "node:crypto";
import { VERIFICATION_POLICY_VERSION } from "../domain/policies";
import type { VerificationEngine, VerificationMessage, VerificationProvider } from "../domain/types";

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
}

export function createSourceHash(input: {
  source: string;
  engine: VerificationEngine;
  provider: VerificationProvider;
  environment: string;
  options?: Record<string, unknown>;
}): string {
  return createHash("sha256").update(stableStringify({
    source: input.source.replace(/\r\n/g, "\n"),
    engine: input.engine,
    provider: input.provider,
    environment: input.environment,
    policyVersion: VERIFICATION_POLICY_VERSION,
    options: input.options ?? {},
  })).digest("hex");
}

// Lightweight lexer: removes comments and string/character literals before token checks.
// This is fast feedback, not a Lean parser or security boundary.
export function leanStaticPrecheck(source: string): VerificationMessage[] {
  let code = "";
  let index = 0;
  let blockDepth = 0;
  let inLine = false;
  let quote: '"' | "'" | null = null;
  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1];
    if (inLine) {
      if (char === "\n") { inLine = false; code += "\n"; } else code += " ";
    } else if (blockDepth > 0) {
      if (char === "/" && next === "-") { blockDepth += 1; code += "  "; index += 1; }
      else if (char === "-" && next === "/") { blockDepth -= 1; code += "  "; index += 1; }
      else code += char === "\n" ? "\n" : " ";
    } else if (quote) {
      if (char === "\\") { code += "  "; index += 1; }
      else if (char === quote) { quote = null; code += " "; }
      else code += char === "\n" ? "\n" : " ";
    } else if (char === "-" && next === "-") { inLine = true; code += "  "; index += 1; }
    else if (char === "/" && next === "-") { blockDepth = 1; code += "  "; index += 1; }
    else if (char === '"' || char === "'") { quote = char; code += " "; }
    else code += char;
    index += 1;
  }

  const forbidden = ["sorry", "admit", "axiom", "unsafe"] as const;
  const messages: VerificationMessage[] = [];
  const lines = code.split("\n");
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    for (const token of forbidden) {
      const match = new RegExp(`\\b${token}\\b`).exec(lines[lineIndex]);
      if (match) messages.push({
        severity: "error",
        code: `LEAN_POLICY_${token.toUpperCase()}`,
        message: `ProofArena 验证策略不允许使用 ${token}。`,
        line: lineIndex + 1,
        column: match.index + 1,
        source: "proofarena",
      });
    }
  }
  return messages;
}
