import { createHash } from "crypto";

/**
 * Deterministic JSON serialization: object keys sorted recursively so
 * `{a:1,b:2}` and `{b:2,a:1}` hash identically. Arrays keep their order
 * (order is semantically meaningful for arrays in this codebase's content
 * shapes -- e.g. `Problem.statement`).
 */
export function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return Object.fromEntries(entries.map(([k, v]) => [k, canonicalize(v)]));
  }
  return value;
}

/**
 * Content hash for a version snapshot. Used both to detect a no-op version
 * (identical content -> identical hash -> no new row) and, in a future phase,
 * to flag a stale Artifact whose referenced version's hash no longer matches
 * the entity's current content. Always computed here in TypeScript, never in
 * SQL, so a hash computed at version-creation time and one computed later for
 * comparison are guaranteed to use the same algorithm -- see
 * docs/ARCHITECTURE_V2.md §4.
 */
export function computeContentHash(content: unknown): string {
  const canonical = JSON.stringify(canonicalize(content));
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}
