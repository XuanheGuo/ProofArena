// Server-side input resolution for capability runs. This is the boundary that
// makes an Artifact's provenance honest: the client never supplies the content
// that gets executed for a version-bound input — the server loads the version,
// extracts the canonical Lean source itself, and snapshots exactly what ran.
//
// Exactly two modes exist (see docs/ARCHITECTURE_V2.md §6):
//
//   solution_version  — verify the exact stored SolutionVersion. The client
//                       sends only (objectId, versionId); any client-supplied
//                       value/contentHash/snapshot is rejected, not ignored.
//                       Artifacts from this mode may carry `verifies`.
//
//   ad_hoc_source     — verify a user-supplied Lean source with NO claim of
//                       binding to any stored entity. Artifacts from this mode
//                       never carry `verifies` (also enforced in SQL by
//                       create_artifact_bundle).
//
// The old `objectType: "solution" + value: <anything>` shape is intentionally
// NOT accepted here: that shape is precisely how a caller could make an
// artifact that *looks* like a verification of a stored solution while
// actually verifying unrelated text (audit issue P0-5).
//
// Framework-free: the version reader is injected, so tests exercise every
// branch without Supabase. The Supabase-backed reader lives in
// supabase-version-reader.ts.

import { createHash } from "node:crypto";
import type { Actor, CapabilityRunInputRef } from "@/contracts/capability";
import { isModerator } from "@/domains/identity/actor";

/** Max Lean source accepted for ad-hoc verification, in UTF-16 code units.
 * Deliberately aligned with verification/domain/policies' source-size cap so
 * this layer never admits something the VerificationService would reject. */
export const MAX_AD_HOC_SOURCE_LENGTH = 100_000;

export const INPUT_ERROR_CODES = [
  "UNSUPPORTED_OBJECT_TYPE",
  "MISSING_OBJECT_ID",
  "MISSING_VERSION_ID",
  "INVALID_VERSION_ID",
  "VERSION_NOT_FOUND",
  "VERSION_MISMATCH",
  "VERSION_HAS_NO_LEAN_SOURCE",
  "CLIENT_CONTENT_REJECTED",
  "AD_HOC_MUST_NOT_REFERENCE",
  "MISSING_SOURCE",
  "SOURCE_TOO_LARGE",
  "TOO_MANY_INPUTS",
] as const;
export type InputErrorCode = (typeof INPUT_ERROR_CODES)[number];

export class InputResolutionError extends Error {
  constructor(
    readonly code: InputErrorCode,
    message: string,
    readonly inputIndex?: number,
  ) {
    super(message);
    this.name = "InputResolutionError";
  }
}

/** One input after server-side resolution: what will actually be executed and
 * persisted. `source` is the canonical content handed to the adapter; the
 * snapshot row stores it so the run is auditable independent of later edits. */
export interface ResolvedInput {
  objectType: "solution_version" | "ad_hoc_source";
  /** Stable entity id for version-bound inputs; null for ad-hoc. */
  objectId: string | null;
  versionId: string | null;
  role: string;
  /** Canonical source the adapter executes. Private — never in public payloads. */
  source: string;
  /** sha256 hex of `source`. */
  contentHash: string;
  /** Persisted verbatim into capability_run_inputs.snapshot (private). */
  snapshot: Record<string, unknown>;
}

/** Minimal view of a solution version needed for binding + access checks. */
export interface SolutionVersionRow {
  id: string;
  solutionId: string;
  content: unknown;
  contentHash: string;
  publishedAt: string | null;
  createdBy: string | null;
}

/** Port for loading versions. Supabase impl: supabase-version-reader.ts. */
export interface VersionReader {
  getSolutionVersion(versionId: string): Promise<SolutionVersionRow | null>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_INPUTS = 8;

function sha256(source: string): string {
  return createHash("sha256").update(source, "utf8").digest("hex");
}

/**
 * The single supported location for a machine-checkable Lean proof inside a
 * SolutionVersion's content: `content.formalProofs.lean.source`. No fallback
 * heuristics — guessing that a natural-language proof "looks like Lean" would
 * silently verify the wrong thing, which is worse than a structured error.
 */
export function extractLeanSource(content: unknown): string | null {
  if (content === null || typeof content !== "object") return null;
  const formalProofs = (content as Record<string, unknown>).formalProofs;
  if (formalProofs === null || typeof formalProofs !== "object" || formalProofs === undefined) return null;
  const lean = (formalProofs as Record<string, unknown>).lean;
  if (lean === null || typeof lean !== "object" || lean === undefined) return null;
  const source = (lean as Record<string, unknown>).source;
  return typeof source === "string" && source.trim().length > 0 ? source : null;
}

export class CapabilityInputResolver {
  constructor(private readonly versions: VersionReader) {}

  async resolve(actor: Actor, inputs: CapabilityRunInputRef[]): Promise<ResolvedInput[]> {
    if (inputs.length > MAX_INPUTS) {
      throw new InputResolutionError("TOO_MANY_INPUTS", `at most ${MAX_INPUTS} inputs per run`);
    }
    const resolved: ResolvedInput[] = [];
    for (const [index, input] of inputs.entries()) {
      resolved.push(await this.resolveOne(actor, input, index));
    }
    return resolved;
  }

  private async resolveOne(actor: Actor, input: CapabilityRunInputRef, index: number): Promise<ResolvedInput> {
    switch (input.objectType) {
      case "solution_version":
        return this.resolveVersionBound(actor, input, index);
      case "ad_hoc_source":
        return this.resolveAdHoc(input, index);
      default:
        throw new InputResolutionError(
          "UNSUPPORTED_OBJECT_TYPE",
          `objectType "${input.objectType}" is not accepted by verify.lean — use "solution_version" (version-bound) or "ad_hoc_source"`,
          index,
        );
    }
  }

  private async resolveVersionBound(actor: Actor, input: CapabilityRunInputRef, index: number): Promise<ResolvedInput> {
    if (!input.objectId) {
      throw new InputResolutionError("MISSING_OBJECT_ID", "solution_version input requires objectId (the solution's stable id)", index);
    }
    if (!input.versionId) {
      throw new InputResolutionError("MISSING_VERSION_ID", "solution_version input requires versionId", index);
    }
    if (!UUID_RE.test(input.versionId)) {
      throw new InputResolutionError("INVALID_VERSION_ID", "versionId must be a UUID", index);
    }
    // Reject — don't silently ignore — client-supplied content on a
    // version-bound input. Ignoring it would let a caller believe their text
    // was verified when the stored version's text was.
    if (input.value !== undefined || input.contentHash !== undefined || input.snapshot !== undefined) {
      throw new InputResolutionError(
        "CLIENT_CONTENT_REJECTED",
        "version-bound inputs must not include value/contentHash/snapshot — the server resolves content from the version itself",
        index,
      );
    }

    const version = await this.versions.getSolutionVersion(input.versionId);
    // One error for not-found, wrong-solution-but-unreadable, and no-access:
    // distinguishing them would leak whether a private version exists.
    if (!version || !this.canRead(actor, version)) {
      throw new InputResolutionError("VERSION_NOT_FOUND", "solution version not found", index);
    }
    if (version.solutionId !== input.objectId) {
      throw new InputResolutionError(
        "VERSION_MISMATCH",
        `version ${input.versionId} does not belong to solution ${input.objectId}`,
        index,
      );
    }

    const source = extractLeanSource(version.content);
    if (!source) {
      throw new InputResolutionError(
        "VERSION_HAS_NO_LEAN_SOURCE",
        "this solution version has no formalProofs.lean.source to verify",
        index,
      );
    }

    return {
      objectType: "solution_version",
      objectId: input.objectId,
      versionId: version.id,
      role: input.role || "proof_source",
      source,
      contentHash: sha256(source),
      snapshot: {
        mode: "version_bound",
        versionId: version.id,
        solutionId: version.solutionId,
        versionContentHash: version.contentHash,
        source,
      },
    };
  }

  private resolveAdHoc(input: CapabilityRunInputRef, index: number): ResolvedInput {
    // An ad-hoc input claiming an objectId/versionId is exactly the forgery
    // this resolver exists to prevent — reject rather than strip.
    if (input.objectId || input.versionId) {
      throw new InputResolutionError(
        "AD_HOC_MUST_NOT_REFERENCE",
        "ad_hoc_source inputs must not carry objectId or versionId",
        index,
      );
    }
    if (typeof input.value !== "string" || input.value.trim().length === 0) {
      throw new InputResolutionError("MISSING_SOURCE", "ad_hoc_source input requires value (the Lean source string)", index);
    }
    if (input.value.length > MAX_AD_HOC_SOURCE_LENGTH) {
      throw new InputResolutionError("SOURCE_TOO_LARGE", `source exceeds ${MAX_AD_HOC_SOURCE_LENGTH} characters`, index);
    }

    const source = input.value;
    return {
      objectType: "ad_hoc_source",
      objectId: null,
      versionId: null,
      role: input.role || "proof_source",
      source,
      contentHash: sha256(source),
      snapshot: { mode: "ad_hoc", source },
    };
  }

  /** Mirrors the version RLS from migration 029: published readable by all,
   * unpublished only by creator or moderator/admin. */
  private canRead(actor: Actor, version: SolutionVersionRow): boolean {
    if (version.publishedAt !== null) return true;
    if (version.createdBy !== null && version.createdBy === actor.userId) return true;
    return isModerator({ role: actor.role, email: actor.email });
  }
}
