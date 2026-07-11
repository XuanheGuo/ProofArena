// POST /api/capabilities/runs — create a new capability run
// GET /api/capabilities/runs — list runs for the current actor
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getServiceClient } from "@/platform/database/service-client";
import { CapabilityService } from "@/domains/capabilities/capability-service";
import { getDefaultCapabilityRegistry } from "@/domains/capabilities/registry";
import { buildDefaultRegistry } from "@/domains/capabilities/default-registry";
import { SupabaseCapabilityRunRepository } from "@/domains/capabilities/supabase-capability-run-repository";
import { SupabaseArtifactRepository } from "@/domains/artifacts/supabase-artifact-repository";
import type { CapabilityRunRequest } from "@/contracts/capability";
import type { CapabilityRunInputRef } from "@/contracts/capability";

function parseCreateBody(body: unknown): CapabilityRunRequest | { errors: string[] } {
  const errors: string[] = [];

  if (!body || typeof body !== "object") {
    return { errors: ["Request body must be an object"] };
  }

  const obj = body as Record<string, unknown>;

  if (typeof obj.capabilityKey !== "string" || obj.capabilityKey.length === 0) {
    errors.push("capabilityKey is required and must be a non-empty string");
  }

  if (obj.configuration !== undefined && (typeof obj.configuration !== "object" || obj.configuration === null || Array.isArray(obj.configuration))) {
    errors.push("configuration must be an object");
  }

  if (!Array.isArray(obj.inputs)) {
    errors.push("inputs must be an array");
  } else {
    for (const [idx, inp] of obj.inputs.entries()) {
      if (!inp || typeof inp !== "object" || Array.isArray(inp)) {
        errors.push(`inputs[${idx}] must be an object`);
        continue;
      }
      const ref = inp as Record<string, unknown>;
      if (typeof ref.objectType !== "string") errors.push(`inputs[${idx}].objectType is required`);
      if (typeof ref.objectId !== "string") errors.push(`inputs[${idx}].objectId is required`);
      if (typeof ref.role !== "string") errors.push(`inputs[${idx}].role is required`);
    }
  }

  if (obj.idempotencyKey !== undefined && typeof obj.idempotencyKey !== "string") {
    errors.push("idempotencyKey must be a string");
  }

  if (errors.length > 0) return { errors };

  return {
    capabilityKey: obj.capabilityKey as string,
    configuration: (obj.configuration as Record<string, unknown>) ?? {},
    inputs: obj.inputs as CapabilityRunInputRef[],
    idempotencyKey: obj.idempotencyKey as string | undefined,
  };
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = parseCreateBody(body);
  if ("errors" in parsed) {
    return NextResponse.json({ error: "Validation failed", details: parsed.errors }, { status: 400 });
  }

  const serviceClient = getServiceClient();
  const registry = getDefaultCapabilityRegistry(buildDefaultRegistry);
  const service = new CapabilityService({
    registry,
    runRepository: new SupabaseCapabilityRunRepository(serviceClient),
    artifactRepository: new SupabaseArtifactRepository(serviceClient),
  });

  try {
    const run = await service.execute(
      { userId: user.id, email: user.email, role: user.role },
      parsed
    );

    return NextResponse.json({ run }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("Permission denied") || message.includes("Unknown capability")) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    if (message.includes("Invalid")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error", details: message }, { status: 500 });
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

  const serviceClient = getServiceClient();
  const registry = getDefaultCapabilityRegistry(buildDefaultRegistry);
  const service = new CapabilityService({
    registry,
    runRepository: new SupabaseCapabilityRunRepository(serviceClient),
    artifactRepository: new SupabaseArtifactRepository(serviceClient),
  });

  try {
    const runs = await service.listRuns(
      { userId: user.id, email: user.email, role: user.role },
      { capabilityKey }
    );

    return NextResponse.json({ runs });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Internal server error", details: message }, { status: 500 });
  }
}
