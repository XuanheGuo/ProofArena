// POST /api/capabilities/runs — create a new capability run
// GET  /api/capabilities/runs — list runs for the current actor
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { buildCapabilityService } from "@/domains/capabilities/build-capability-service";
import { IdempotencyConflictError } from "@/domains/capabilities/capability-service";
import { InputResolutionError } from "@/domains/capabilities/input-resolver";
import { OBJECT_TYPES } from "@/contracts/references";
import type { CapabilityRunInputRef, CapabilityRunRequest } from "@/contracts/capability";

const MAX_BODY_BYTES = 512 * 1024;
const MAX_INPUTS = 8;
const MAX_IDEMPOTENCY_KEY_LENGTH = 128;
const MAX_CONFIGURATION_BYTES = 16 * 1024;

function parseCreateBody(body: unknown): CapabilityRunRequest | { errors: string[] } {
  const errors: string[] = [];
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { errors: ["Request body must be an object"] };
  }
  const obj = body as Record<string, unknown>;

  if (typeof obj.capabilityKey !== "string" || obj.capabilityKey.length === 0 || obj.capabilityKey.length > 100) {
    errors.push("capabilityKey is required and must be a non-empty string");
  }
  if (obj.configuration !== undefined) {
    if (typeof obj.configuration !== "object" || obj.configuration === null || Array.isArray(obj.configuration)) {
      errors.push("configuration must be an object");
    } else if (JSON.stringify(obj.configuration).length > MAX_CONFIGURATION_BYTES) {
      errors.push(`configuration exceeds ${MAX_CONFIGURATION_BYTES} bytes`);
    }
  }
  if (obj.idempotencyKey !== undefined) {
    if (typeof obj.idempotencyKey !== "string" || obj.idempotencyKey.length === 0 || obj.idempotencyKey.length > MAX_IDEMPOTENCY_KEY_LENGTH) {
      errors.push(`idempotencyKey must be a string of at most ${MAX_IDEMPOTENCY_KEY_LENGTH} characters`);
    }
  }

  if (!Array.isArray(obj.inputs) || obj.inputs.length === 0) {
    errors.push("inputs must be a non-empty array");
  } else if (obj.inputs.length > MAX_INPUTS) {
    errors.push(`at most ${MAX_INPUTS} inputs per run`);
  } else {
    for (const [idx, inp] of obj.inputs.entries()) {
      if (!inp || typeof inp !== "object" || Array.isArray(inp)) {
        errors.push(`inputs[${idx}] must be an object`);
        continue;
      }
      const ref = inp as Record<string, unknown>;
      if (typeof ref.objectType !== "string" || !(OBJECT_TYPES as readonly string[]).includes(ref.objectType)) {
        errors.push(`inputs[${idx}].objectType must be one of: ${OBJECT_TYPES.join(", ")}`);
      }
      if (ref.objectId !== undefined && typeof ref.objectId !== "string") {
        errors.push(`inputs[${idx}].objectId must be a string`);
      }
      if (ref.versionId !== undefined && typeof ref.versionId !== "string") {
        errors.push(`inputs[${idx}].versionId must be a string`);
      }
      if (ref.role !== undefined && (typeof ref.role !== "string" || ref.role.length > 64)) {
        errors.push(`inputs[${idx}].role must be a string of at most 64 characters`);
      }
      if (ref.value !== undefined && typeof ref.value !== "string") {
        errors.push(`inputs[${idx}].value must be a string`);
      }
    }
  }

  if (errors.length > 0) return { errors };
  return {
    capabilityKey: obj.capabilityKey as string,
    configuration: (obj.configuration as Record<string, unknown>) ?? {},
    inputs: (obj.inputs as Record<string, unknown>[]).map((ref) => ({
      objectType: ref.objectType,
      objectId: ref.objectId,
      versionId: ref.versionId,
      role: (ref.role as string) ?? "proof_source",
      value: ref.value,
      // contentHash/snapshot are deliberately dropped: the resolver rejects
      // them on version-bound inputs and computes them itself everywhere.
      contentHash: ref.contentHash,
      snapshot: ref.snapshot,
    })) as CapabilityRunInputRef[],
    idempotencyKey: obj.idempotencyKey as string | undefined,
  };
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Request body too large", code: "BODY_TOO_LARGE" }, { status: 413 });
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = parseCreateBody(body);
  if ("errors" in parsed) {
    return NextResponse.json({ error: "Validation failed", code: "VALIDATION_FAILED", details: parsed.errors }, { status: 400 });
  }

  const service = buildCapabilityService(supabase);
  try {
    const run = await service.execute({ userId: user.id, email: user.email, role: user.role }, parsed);
    return NextResponse.json({ run }, { status: 201 });
  } catch (error) {
    if (error instanceof InputResolutionError) {
      const status = error.code === "VERSION_NOT_FOUND" ? 404 : 400;
      return NextResponse.json({ error: error.message, code: error.code, inputIndex: error.inputIndex }, { status });
    }
    if (error instanceof IdempotencyConflictError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 409 });
    }
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("Permission denied") || message.includes("Unknown capability")) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    if (message.includes("Invalid")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error("capability run failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const capabilityKey = searchParams.get("capabilityKey") ?? undefined;

  const service = buildCapabilityService(supabase);
  try {
    const runs = await service.listRuns({ userId: user.id, email: user.email, role: user.role }, { capabilityKey });
    return NextResponse.json({ runs });
  } catch (error) {
    console.error("capability run list failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
