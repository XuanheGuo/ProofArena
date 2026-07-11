// Input resolution and validation for capability runs. Enforces two distinct modes:
// 1. version-bound: server extracts canonical content from a specific version
// 2. ad-hoc: user provides arbitrary source, no version claim
//
// See docs/PHASE_1_1_COMPLETION_AUDIT.md for rationale.

import type { Actor, CapabilityRunInputRef } from "@/contracts/capability";
import { createServiceRoleClient } from "@/lib/supabase-server";
import { createHash } from "node:crypto";
import { canonicalize } from "@/domains/content/versioning/content-hash";

export type ObjectType = "problem" | "solution" | "problem_version" | "solution_version" | "submission" | "ad_hoc_source";

export interface ResolvedInput {
  objectType: ObjectType;
  objectId: string | null;
  versionId: string | null;
  role: string;
  inputKey: string;
  // Canonical content extracted by server
  canonicalSource: string;
  contentHash: string;
  // Complete snapshot for audit
  snapshot: {
    resolvedAt: string;
    objectType: ObjectType;
    objectId: string | null;
    versionId: string | null;
    contentHash: string;
    source: string;
  };
}

export interface InputResolutionError {
  code: string;
  message: string;
  inputKey?: string;
}

/**
 * Resolves capability inputs according to their type:
 * - version-bound: fetches version from DB, extracts canonical Lean source
 * - ad-hoc: validates user-provided source, computes hash
 */
export class CapabilityInputResolver {
  /**
   * Resolve all inputs for a capability run. Throws on validation failure.
   */
  async resolveInputs(
    actor: Actor,
    inputs: CapabilityRunInputRef[]
  ): Promise<ResolvedInput[]> {
    const resolved: ResolvedInput[] = [];

    for (const input of inputs) {
      const result = await this.resolveInput(actor, input);
      resolved.push(result);
    }

    return resolved;
  }

  private async resolveInput(
    actor: Actor,
    input: CapabilityRunInputRef
  ): Promise<ResolvedInput> {
    // Validate common fields
    if (!input.inputKey || typeof input.inputKey !== "string") {
      throw this.error("INVALID_INPUT_KEY", "inputKey is required and must be a string");
    }

    if (!input.objectType || typeof input.objectType !== "string") {
      throw this.error("INVALID_OBJECT_TYPE", "objectType is required", input.inputKey);
    }

    // Route to type-specific resolver
    switch (input.objectType) {
      case "solution_version":
        return this.resolveSolutionVersion(actor, input);
      case "problem_version":
        return this.resolveProblemVersion(actor, input);
      case "ad_hoc_source":
        return this.resolveAdHocSource(input);
      case "solution":
      case "problem":
      case "submission":
        // Legacy types: treat as ad-hoc for now (no version binding)
        // Future: migrate to explicit version-bound mode
        return this.resolveLegacyInput(input);
      default:
        throw this.error("UNSUPPORTED_OBJECT_TYPE", `Unsupported objectType: ${input.objectType}`, input.inputKey);
    }
  }

  /**
   * Version-bound mode: fetch solution_version, extract Lean source from content.
   */
  private async resolveSolutionVersion(
    actor: Actor,
    input: CapabilityRunInputRef
  ): Promise<ResolvedInput> {
    if (!input.objectId) {
      throw this.error("MISSING_OBJECT_ID", "solution_version requires objectId (solution stable ID)", input.inputKey);
    }

    if (!input.versionId) {
      throw this.error("MISSING_VERSION_ID", "solution_version requires versionId", input.inputKey);
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(input.versionId)) {
      throw this.error("INVALID_VERSION_ID", "versionId must be a valid UUID", input.inputKey);
    }

    // Fetch version using user's permissions (RLS enforced)
    const supabase = createServiceRoleClient();
    const { data: version, error } = await supabase
      .from("solution_versions")
      .select("id, solution_id, content, content_hash, published_at, created_by")
      .eq("id", input.versionId)
      .single();

    if (error || !version) {
      // Don't leak existence of private versions
      throw this.error("VERSION_NOT_FOUND", "Solution version not found or access denied", input.inputKey);
    }

    // Verify version belongs to solution
    if (version.solution_id !== input.objectId) {
      throw this.error("VERSION_MISMATCH", `Version ${input.versionId} does not belong to solution ${input.objectId}`, input.inputKey);
    }

    // Check user can read this version (RLS check)
    const canRead = await this.canReadVersion(actor, version);
    if (!canRead) {
      throw this.error("VERSION_ACCESS_DENIED", "You do not have permission to read this version", input.inputKey);
    }

    // Extract Lean source from content
    const leanSource = this.extractLeanSource(version.content);
    if (!leanSource) {
      throw this.error("VERSION_HAS_NO_LEAN_SOURCE", "This solution version does not contain Lean source code", input.inputKey);
    }

    // Validate size
    if (leanSource.length > 100000) {
      throw this.error("SOURCE_TOO_LARGE", "Lean source exceeds 100KB limit", input.inputKey);
    }

    // Compute canonical hash
    const contentHash = createHash("sha256").update(leanSource, "utf8").digest("hex");

    return {
      objectType: "solution_version",
      objectId: input.objectId,
      versionId: input.versionId,
      role: input.role || "proof_source",
      inputKey: input.inputKey,
      canonicalSource: leanSource,
      contentHash,
      snapshot: {
        resolvedAt: new Date().toISOString(),
        objectType: "solution_version",
        objectId: input.objectId,
        versionId: input.versionId,
        contentHash,
        source: leanSource,
      },
    };
  }

  /**
   * Version-bound mode: fetch problem_version, extract content.
   */
  private async resolveProblemVersion(
    actor: Actor,
    input: CapabilityRunInputRef
  ): Promise<ResolvedInput> {
    if (!input.objectId) {
      throw this.error("MISSING_OBJECT_ID", "problem_version requires objectId", input.inputKey);
    }

    if (!input.versionId) {
      throw this.error("MISSING_VERSION_ID", "problem_version requires versionId", input.inputKey);
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(input.versionId)) {
      throw this.error("INVALID_VERSION_ID", "versionId must be a valid UUID", input.inputKey);
    }

    const supabase = createServiceRoleClient();
    const { data: version, error } = await supabase
      .from("problem_versions")
      .select("id, problem_id, content, content_hash, published_at, created_by")
      .eq("id", input.versionId)
      .single();

    if (error || !version) {
      throw this.error("VERSION_NOT_FOUND", "Problem version not found or access denied", input.inputKey);
    }

    if (version.problem_id !== input.objectId) {
      throw this.error("VERSION_MISMATCH", `Version ${input.versionId} does not belong to problem ${input.objectId}`, input.inputKey);
    }

    const canRead = await this.canReadVersion(actor, version);
    if (!canRead) {
      throw this.error("VERSION_ACCESS_DENIED", "You do not have permission to read this version", input.inputKey);
    }

    // Problem versions: use full content as canonical source
    const canonical = JSON.stringify(version.content);
    const contentHash = version.content_hash;

    return {
      objectType: "problem_version",
      objectId: input.objectId,
      versionId: input.versionId,
      role: input.role || "problem_statement",
      inputKey: input.inputKey,
      canonicalSource: canonical,
      contentHash,
      snapshot: {
        resolvedAt: new Date().toISOString(),
        objectType: "problem_version",
        objectId: input.objectId,
        versionId: input.versionId,
        contentHash,
        source: canonical,
      },
    };
  }

  /**
   * Ad-hoc mode: accept arbitrary source, no version claim.
   */
  private resolveAdHocSource(input: CapabilityRunInputRef): ResolvedInput {
    if (input.objectId || input.versionId) {
      throw this.error("AD_HOC_NO_VERSION", "ad_hoc_source must not have objectId or versionId", input.inputKey);
    }

    if (!input.value || typeof input.value !== "string") {
      throw this.error("MISSING_VALUE", "ad_hoc_source requires value (Lean source code)", input.inputKey);
    }

    const source = input.value;

    // Validate size
    if (source.length === 0) {
      throw this.error("EMPTY_SOURCE", "Source code cannot be empty", input.inputKey);
    }

    if (source.length > 100000) {
      throw this.error("SOURCE_TOO_LARGE", "Source exceeds 100KB limit", input.inputKey);
    }

    // Compute hash
    const contentHash = createHash("sha256").update(source, "utf8").digest("hex");

    return {
      objectType: "ad_hoc_source",
      objectId: null,
      versionId: null,
      role: input.role || "proof_source",
      inputKey: input.inputKey,
      canonicalSource: source,
      contentHash,
      snapshot: {
        resolvedAt: new Date().toISOString(),
        objectType: "ad_hoc_source",
        objectId: null,
        versionId: null,
        contentHash,
        source,
      },
    };
  }

  /**
   * Legacy compatibility: accept value-based inputs (no version binding).
   */
  private resolveLegacyInput(input: CapabilityRunInputRef): ResolvedInput {
    if (!input.value || typeof input.value !== "string") {
      throw this.error("MISSING_VALUE", `${input.objectType} requires value`, input.inputKey);
    }

    const source = input.value;

    if (source.length > 100000) {
      throw this.error("SOURCE_TOO_LARGE", "Source exceeds 100KB limit", input.inputKey);
    }

    const contentHash = createHash("sha256").update(source, "utf8").digest("hex");

    return {
      objectType: input.objectType as ObjectType,
      objectId: input.objectId || null,
      versionId: null,
      role: input.role || "proof_source",
      inputKey: input.inputKey,
      canonicalSource: source,
      contentHash,
      snapshot: {
        resolvedAt: new Date().toISOString(),
        objectType: input.objectType as ObjectType,
        objectId: input.objectId || null,
        versionId: null,
        contentHash,
        source,
      },
    };
  }

  /**
   * Extract Lean source from solution content.
   * Supports multiple conventions:
   * - content.formalProofs.lean.source
   * - content.leanSource
   * - content.proof (if it looks like Lean)
   */
  private extractLeanSource(content: any): string | null {
    if (!content || typeof content !== "object") {
      return null;
    }

    // Convention 1: structured formal proofs
    if (content.formalProofs?.lean?.source) {
      return content.formalProofs.lean.source;
    }

    // Convention 2: direct leanSource field
    if (typeof content.leanSource === "string") {
      return content.leanSource;
    }

    // Convention 3: proof field (if it contains Lean keywords)
    if (typeof content.proof === "string" && this.looksLikeLean(content.proof)) {
      return content.proof;
    }

    return null;
  }

  /**
   * Heuristic: does this string look like Lean code?
   */
  private looksLikeLean(source: string): boolean {
    const leanKeywords = ["theorem", "lemma", "def", "inductive", "structure", "class", "instance", "import", ":=", "by"];
    return leanKeywords.some((kw) => source.includes(kw));
  }

  /**
   * Check if actor can read a version (RLS logic).
   */
  private async canReadVersion(
    actor: Actor,
    version: { published_at: string | null; created_by: string | null }
  ): Promise<boolean> {
    // Published versions: anyone can read
    if (version.published_at) {
      return true;
    }

    // Unpublished: only owner or moderator
    if (actor.userId === version.created_by) {
      return true;
    }

    // Moderator check
    if (actor.role === "moderator" || actor.role === "admin") {
      return true;
    }

    return false;
  }

  private error(code: string, message: string, inputKey?: string): InputResolutionError & Error {
    const err = new Error(message) as InputResolutionError & Error;
    err.code = code;
    err.message = message;
    if (inputKey) {
      err.inputKey = inputKey;
    }
    return err;
  }
}
