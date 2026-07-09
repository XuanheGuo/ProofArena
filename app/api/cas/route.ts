import { NextRequest, NextResponse } from "next/server";

const CAS_URL = process.env.CAS_SERVICE_URL ?? "http://localhost:8000";

const MAX_BODY_BYTES = 20_000;
const MAX_EXPR_CHARS = 2000;
const MAX_STEPS = 30;
const MAX_STEP_CHARS = 2000;
const MAX_TOTAL_STEPS_CHARS = 12_000;

// Lightweight in-memory sliding-window limiter. Per-instance only (no shared
// store across serverless instances/regions) — good enough to blunt casual
// abuse of a single warm instance; not a substitute for an edge/CDN-level
// limiter if this route ever needs to withstand a real attack.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 20;
const requestLog = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const timestamps = (requestLog.get(ip) ?? []).filter((t) => t > windowStart);

  if (timestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    requestLog.set(ip, timestamps);
    return true;
  }

  timestamps.push(now);
  requestLog.set(ip, timestamps);

  // Bound memory: drop stale IPs occasionally instead of growing forever.
  if (requestLog.size > 5000) {
    for (const [key, times] of requestLog) {
      if (times.every((t) => t <= windowStart)) requestLog.delete(key);
    }
  }

  return false;
}

function clientIp(req: NextRequest): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

function vercelCasUrl() {
  if (process.env.CAS_SERVICE_URL) return null;
  if (!process.env.VERCEL_URL) return null;
  return `https://${process.env.VERCEL_URL}/api/cas_service`;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string";
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many requests, please slow down." },
      { status: 429 },
    );
  }

  // Cheap precheck before buffering the body — a declared oversized
  // Content-Length can be rejected without reading it at all. This is best
  // effort: a missing or malformed header falls through to the real check
  // below against the body we actually read.
  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return NextResponse.json(
      { error: "Request body too large" },
      { status: 413 },
    );
  }

  const rawBody = await req.text();
  if (rawBody.length > MAX_BODY_BYTES) {
    return NextResponse.json(
      { error: "Request body too large" },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json(
      { error: "Request body must be a JSON object" },
      { status: 400 },
    );
  }

  const { action, ...params } = body as {
    action: unknown;
    [k: string]: unknown;
  };

  if (action !== "equivalence" && action !== "steps") {
    return NextResponse.json(
      { error: 'action must be "equivalence" or "steps"' },
      { status: 400 },
    );
  }

  if (action === "equivalence") {
    const { expr_a, expr_b } = params as { expr_a?: unknown; expr_b?: unknown };
    if (!isNonEmptyString(expr_a) || !isNonEmptyString(expr_b)) {
      return NextResponse.json(
        { error: "expr_a and expr_b must be strings" },
        { status: 400 },
      );
    }
    if (expr_a.length > MAX_EXPR_CHARS || expr_b.length > MAX_EXPR_CHARS) {
      return NextResponse.json(
        {
          error: `expr_a/expr_b must each be at most ${MAX_EXPR_CHARS} characters`,
        },
        { status: 400 },
      );
    }
  } else {
    const { steps } = params as { steps?: unknown };
    if (!Array.isArray(steps)) {
      return NextResponse.json(
        { error: "steps must be an array" },
        { status: 400 },
      );
    }
    if (steps.length > MAX_STEPS) {
      return NextResponse.json(
        { error: `steps must contain at most ${MAX_STEPS} entries` },
        { status: 400 },
      );
    }
    if (!steps.every(isNonEmptyString)) {
      return NextResponse.json(
        { error: "every step must be a string" },
        { status: 400 },
      );
    }
    if (steps.some((step) => step.length > MAX_STEP_CHARS)) {
      return NextResponse.json(
        { error: `each step must be at most ${MAX_STEP_CHARS} characters` },
        { status: 400 },
      );
    }
    const totalChars = steps.reduce((sum, step) => sum + step.length, 0);
    if (totalChars > MAX_TOTAL_STEPS_CHARS) {
      return NextResponse.json(
        {
          error: `combined steps must be at most ${MAX_TOTAL_STEPS_CHARS} characters`,
        },
        { status: 400 },
      );
    }
  }

  try {
    const internalUrl = vercelCasUrl();
    const upstream = await fetch(
      internalUrl ??
        `${CAS_URL}${action === "equivalence" ? "/verify/equivalence" : "/verify/steps"}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(internalUrl ? { action, ...params } : params),
        signal: AbortSignal.timeout(15_000),
      },
    );

    if (!upstream.ok) {
      console.error(`CAS upstream error: status=${upstream.status}`);
      return NextResponse.json(
        { error: "CAS service returned an error" },
        { status: 502 },
      );
    }

    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    console.error("CAS service unreachable:", err);
    return NextResponse.json(
      { error: "CAS service unreachable" },
      { status: 502 },
    );
  }
}
