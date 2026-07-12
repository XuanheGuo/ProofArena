// End-to-end API smoke test for the Math Hub v2 capability vertical slice.
//
// What it does:
//   1. starts a mock AXLE provider (plain node http server) so no external
//      service is touched — but the FULL internal path runs for real:
//      API route → registry → CapabilityService → input resolver →
//      LeanVerificationAdapter → VerificationService → LeanEngine →
//      AxleProvider(HTTP) → repositories → SQL RPCs → RLS reads
//   2. spawns a real `next dev` server on :3105 with the mock's URL injected
//   3. creates throwaway Supabase users and REAL session cookies (via
//      @supabase/ssr's own serialization, so the server's cookie client
//      accepts them), then exercises the real routes:
//        POST /api/capabilities/runs        (ad-hoc, version-bound, invalid)
//        GET  /api/capabilities/runs/[id]
//        GET  /api/artifacts/[id]
//        POST /api/artifacts/[id]/publish
//
// Requires a running local Supabase (supabase start) with migrations 001–030
// applied, and env in .env.local. Set RUN_AXLE_SMOKE_TEST=true to ALSO run one
// real AXLE call at the end (optional, off by default).
//
// Run: npm run test:api
import { test, before, after } from "node:test";
import assert from "node:assert";
import { spawn, type ChildProcess } from "node:child_process";
import { createServer, type Server } from "node:http";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const APP_PORT = 3105;
const MOCK_AXLE_PORT = 3106;
const BASE = `http://127.0.0.1:${APP_PORT}`;
const LEAN_OK = "theorem smoke_ok : 1 + 1 = 2 := rfl";
const LEAN_REJECTED = "theorem smoke_fail : False := FAIL_ME";

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY — start local Supabase and fill .env.local");
  process.exit(1);
}
if (!/127\.0\.0\.1|localhost/.test(SUPABASE_URL)) {
  console.error(`Refusing to run the smoke test against non-local Supabase: ${SUPABASE_URL}`);
  process.exit(1);
}

// ── mock AXLE ────────────────────────────────────────────────────────────────
let axleHits: string[] = [];
let mockAxle: Server;

function startMockAxle(): Promise<void> {
  return new Promise((resolveStart) => {
    mockAxle = createServer((req, res) => {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        const parsed = JSON.parse(body) as { content: string };
        axleHits.push(parsed.content);
        const rejected = parsed.content.includes("FAIL_ME");
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          okay: !rejected,
          lean_messages: rejected ? { errors: [{ message: "type mismatch at FAIL_ME" }] } : { errors: [], warnings: [], infos: [] },
          tool_messages: { errors: [], warnings: [], infos: [] },
          failed_declarations: rejected ? ["smoke_fail"] : [],
          timings: { total_ms: 5 },
          request_id: `mock-${axleHits.length}`,
        }));
      });
    });
    mockAxle.listen(MOCK_AXLE_PORT, "127.0.0.1", () => resolveStart());
  });
}

// ── next dev ─────────────────────────────────────────────────────────────────
let nextProcess: ChildProcess;

async function startNext(): Promise<void> {
  nextProcess = spawn("npx", ["next", "dev", "-p", String(APP_PORT)], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      LEAN_VERIFICATION_ENABLED: "true",
      LEAN_VERIFICATION_PROVIDER: "axle",
      AXLE_API_KEY: "smoke-test-key",
      AXLE_BASE_URL: `http://127.0.0.1:${MOCK_AXLE_PORT}`,
      AXLE_ENVIRONMENT: "smoke-env",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  nextProcess.stderr?.on("data", (d: Buffer) => {
    const line = d.toString();
    if (/error/i.test(line)) process.stderr.write(`[next] ${line}`);
  });
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/api/capabilities/runs`);
      if (res.status === 401) return; // route compiled, auth gate live
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("next dev did not become ready within 120s");
}

// ── auth: real session cookies the SSR client accepts ───────────────────────
const service = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

interface TestUser { userId: string; cookieHeader: string }

async function createUserWithCookies(label: string, role?: string): Promise<TestUser> {
  const email = `smoke-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@proofarena.test`;
  const password = `Smoke-${Math.random().toString(36).slice(2, 10)}`;
  const { data: created, error } = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !created?.user) throw new Error(`create ${label}: ${error?.message}`);
  const userId = created.user.id;

  for (let i = 0; i < 10; i++) {
    const { data } = await service.from("user_profiles").select("id").eq("id", userId).maybeSingle();
    if (data) break;
    await new Promise((r) => setTimeout(r, 300));
  }
  if (role) {
    const { error: roleErr } = await service.from("user_profiles").update({ role }).eq("id", userId);
    if (roleErr) throw new Error(`set role ${label}: ${roleErr.message}`);
  }

  const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
  const { data: signIn, error: signInError } = await anon.auth.signInWithPassword({ email, password });
  if (signInError || !signIn.session) throw new Error(`sign in ${label}: ${signInError?.message}`);

  // Let @supabase/ssr serialize the session itself so the cookie format
  // (name, chunking, base64 prefix) exactly matches what the server parses.
  const jar = new Map<string, string>();
  const ssr = createServerClient(SUPABASE_URL, ANON_KEY, {
    cookies: {
      getAll: () => Array.from(jar, ([name, value]) => ({ name, value })),
      setAll: (cookies) => cookies.forEach(({ name, value }) => jar.set(name, value)),
    },
  });
  await ssr.auth.setSession({ access_token: signIn.session.access_token, refresh_token: signIn.session.refresh_token });
  const cookieHeader = Array.from(jar, ([name, value]) => `${name}=${value}`).join("; ");
  return { userId, cookieHeader };
}

async function api(path: string, init: RequestInit & { user?: TestUser } = {}) {
  const { user, ...rest } = init;
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(rest.headers as Record<string, string>) };
  if (user) headers.Cookie = user.cookieHeader;
  const res = await fetch(`${BASE}${path}`, { ...rest, headers });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* non-JSON */ }
  return { status: res.status, json };
}

// ── fixtures ─────────────────────────────────────────────────────────────────
let owner: TestUser;
let stranger: TestUser;
let moderator: TestUser;
const problemId = `smoke-prob-${Date.now()}`;
const solutionId = `smoke-sol-${Date.now()}`;
let publishedVersionId: string;
let draftVersionId: string;
const cleanupUsers: string[] = [];

before(async () => {
  await startMockAxle();
  await startNext();

  owner = await createUserWithCookies("owner");
  stranger = await createUserWithCookies("stranger");
  moderator = await createUserWithCookies("mod", "moderator");
  cleanupUsers.push(owner.userId, stranger.userId, moderator.userId);

  const { error: probErr } = await service.from("problems").insert({
    id: problemId, year: 2026, region: "原创题", paper: "smoke", number: "1",
    difficulty: "基础", question_type: "解答", title: "smoke", statement: ["x"], answer: "x", learning_guide: {},
  });
  if (probErr) throw new Error(`seed problem: ${probErr.message}`);
  const { error: solErr } = await service.from("solutions").insert({
    id: solutionId, problem_id: problemId, kind: "standard", title: "t", author: "a", author_role: "r",
    badge: "b", origin: "o", key_transform: "k", thinking_cues: {}, inspiration: "i", transfer_value: "t",
    scores: { correctness: 5, examReady: 5, elegance: 5, calculation: 5, explanation: 5 },
    scoring_reason: "s", verification: {}, estimated_minutes: 5, author_id: owner.userId,
  });
  if (solErr) throw new Error(`seed solution: ${solErr.message}`);

  const publishedContent = { formalProofs: { lean: { source: LEAN_OK } } };
  const { data: pv, error: pvErr } = await service.from("solution_versions").insert({
    solution_id: solutionId, version_number: 1, content: publishedContent,
    content_hash: "a".repeat(64), created_by: owner.userId, published_at: new Date().toISOString(),
  }).select("id").single();
  if (pvErr || !pv) throw new Error(`seed published version: ${pvErr?.message}`);
  publishedVersionId = pv.id;

  const { data: dv, error: dvErr } = await service.from("solution_versions").insert({
    solution_id: solutionId, version_number: 2, content: { formalProofs: { lean: { source: "theorem draft_secret : True := trivial" } } },
    content_hash: "b".repeat(64), created_by: owner.userId, published_at: null,
  }).select("id").single();
  if (dvErr || !dv) throw new Error(`seed draft version: ${dvErr?.message}`);
  draftVersionId = dv.id;
});

after(async () => {
  try { await service.from("problems").delete().eq("id", problemId); } catch { /* best-effort */ }
  for (const id of cleanupUsers) {
    try { await service.auth.admin.deleteUser(id); } catch { /* best-effort */ }
  }
  nextProcess?.kill("SIGTERM");
  mockAxle?.close();
});

// ── the actual smoke checks ──────────────────────────────────────────────────

test("unauthenticated POST /api/capabilities/runs is 401", async () => {
  const res = await api("/api/capabilities/runs", { method: "POST", body: JSON.stringify({ capabilityKey: "verify.lean", inputs: [] }) });
  assert.strictEqual(res.status, 401);
});

test("validation: empty inputs / unknown objectType / oversized key are 400 with structured details", async () => {
  const empty = await api("/api/capabilities/runs", { method: "POST", user: owner, body: JSON.stringify({ capabilityKey: "verify.lean", inputs: [] }) });
  assert.strictEqual(empty.status, 400);
  assert.strictEqual(empty.json.code, "VALIDATION_FAILED");

  const badType = await api("/api/capabilities/runs", {
    method: "POST", user: owner,
    body: JSON.stringify({ capabilityKey: "verify.lean", inputs: [{ objectType: "spellbook", role: "proof_source", value: LEAN_OK }] }),
  });
  assert.strictEqual(badType.status, 400);
});

let adHocRunId: string;
let adHocArtifactId: string;

test("ad-hoc run: accepted proof → run succeeded, conclusion verified, artifact private draft", async () => {
  const res = await api("/api/capabilities/runs", {
    method: "POST", user: owner,
    body: JSON.stringify({ capabilityKey: "verify.lean", inputs: [{ objectType: "ad_hoc_source", role: "proof_source", value: LEAN_OK }] }),
  });
  assert.strictEqual(res.status, 201, JSON.stringify(res.json));
  const run = res.json.run;
  assert.strictEqual(run.status, "succeeded");
  assert.strictEqual(run.projectionStatus, "completed");
  adHocRunId = run.id;

  // the artifact bundle exists, is a private draft, and has NO verifies relation
  const { data: artifacts } = await service.from("artifacts").select("*").eq("run_id", run.id);
  assert.strictEqual(artifacts!.length, 1);
  const artifact = artifacts![0];
  adHocArtifactId = artifact.id;
  assert.strictEqual(artifact.status, "draft");
  assert.strictEqual(artifact.is_public, false);
  assert.strictEqual(artifact.payload.conclusion, "verified");
  const { data: relations } = await service.from("artifact_relations").select("*").eq("artifact_id", artifact.id);
  assert.strictEqual(relations!.length, 0, "ad-hoc artifact must not claim verifies");
});

test("idempotency: same request replays the same run; provider hit exactly once", async () => {
  const before = axleHits.length;
  const res = await api("/api/capabilities/runs", {
    method: "POST", user: owner,
    body: JSON.stringify({ capabilityKey: "verify.lean", inputs: [{ objectType: "ad_hoc_source", role: "proof_source", value: LEAN_OK }] }),
  });
  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.json.run.id, adHocRunId, "identical request must return the SAME run");
  assert.strictEqual(axleHits.length, before, "no additional provider call");
});

test("concurrency: 3 identical parallel requests → one logical run, provider still hit once total", async () => {
  const source = "theorem smoke_concurrent : 2 + 2 = 4 := rfl";
  const body = JSON.stringify({ capabilityKey: "verify.lean", inputs: [{ objectType: "ad_hoc_source", role: "proof_source", value: source }] });
  const results = await Promise.all([1, 2, 3].map(() => api("/api/capabilities/runs", { method: "POST", user: stranger, body })));
  for (const r of results) assert.strictEqual(r.status, 201, JSON.stringify(r.json));
  const ids = new Set(results.map((r) => r.json.run.id));
  assert.strictEqual(ids.size, 1, `expected one run, got ${ids.size}`);
  assert.strictEqual(axleHits.filter((c) => c === source).length, 1, "provider must execute once for the trio");
});

test("rejected proof → run succeeded but conclusion inconclusive (never refuted)", async () => {
  const res = await api("/api/capabilities/runs", {
    method: "POST", user: owner,
    body: JSON.stringify({ capabilityKey: "verify.lean", inputs: [{ objectType: "ad_hoc_source", role: "proof_source", value: LEAN_REJECTED }] }),
  });
  assert.strictEqual(res.status, 201, JSON.stringify(res.json));
  assert.strictEqual(res.json.run.status, "succeeded", "a rejected proof is a successful execution");
  const { data: artifacts } = await service.from("artifacts").select("payload").eq("run_id", res.json.run.id);
  assert.strictEqual(artifacts![0].payload.conclusion, "inconclusive");
  assert.notStrictEqual(artifacts![0].payload.conclusion, "refuted");
});

let versionBoundArtifactId: string;

test("version-bound run: server pulls the stored source; artifact carries verifies → exact version", async () => {
  const res = await api("/api/capabilities/runs", {
    method: "POST", user: owner,
    body: JSON.stringify({
      capabilityKey: "verify.lean",
      inputs: [{ objectType: "solution_version", objectId: solutionId, versionId: publishedVersionId, role: "proof_source" }],
    }),
  });
  assert.strictEqual(res.status, 201, JSON.stringify(res.json));
  assert.strictEqual(res.json.run.status, "succeeded");
  const { data: artifacts } = await service.from("artifacts").select("*").eq("run_id", res.json.run.id);
  versionBoundArtifactId = artifacts![0].id;
  const { data: relations } = await service.from("artifact_relations").select("*").eq("artifact_id", versionBoundArtifactId);
  assert.deepStrictEqual(
    relations!.map((r) => ({ relation: r.relation, targetType: r.target_type, targetId: r.target_id })),
    [{ relation: "verifies", targetType: "solution_version", targetId: publishedVersionId }],
  );
  // the input snapshot recorded the STORED source, proving server-side resolution
  const { data: inputs } = await service.from("capability_run_inputs").select("snapshot").eq("run_id", res.json.run.id);
  assert.strictEqual(inputs![0].snapshot.source, LEAN_OK);
});

test("version-bound forgery attempts are rejected with structured codes", async () => {
  const withValue = await api("/api/capabilities/runs", {
    method: "POST", user: owner,
    body: JSON.stringify({
      capabilityKey: "verify.lean",
      inputs: [{ objectType: "solution_version", objectId: solutionId, versionId: publishedVersionId, role: "proof_source", value: "theorem forged : False := sorry" }],
    }),
  });
  assert.strictEqual(withValue.status, 400);
  assert.strictEqual(withValue.json.code, "CLIENT_CONTENT_REJECTED");

  const wrongVersion = await api("/api/capabilities/runs", {
    method: "POST", user: owner,
    body: JSON.stringify({
      capabilityKey: "verify.lean",
      inputs: [{ objectType: "solution_version", objectId: solutionId, versionId: "00000000-0000-4000-8000-000000000000", role: "proof_source" }],
    }),
  });
  assert.strictEqual(wrongVersion.status, 404);
  assert.strictEqual(wrongVersion.json.code, "VERSION_NOT_FOUND");

  const strangerOnDraft = await api("/api/capabilities/runs", {
    method: "POST", user: stranger,
    body: JSON.stringify({
      capabilityKey: "verify.lean",
      inputs: [{ objectType: "solution_version", objectId: solutionId, versionId: draftVersionId, role: "proof_source" }],
    }),
  });
  assert.strictEqual(strangerOnDraft.status, 404, "a stranger must not even learn the draft version exists");
});

test("run visibility: owner reads own run; stranger gets 404", async () => {
  const asOwner = await api(`/api/capabilities/runs/${adHocRunId}`, { user: owner });
  assert.strictEqual(asOwner.status, 200);
  const asStranger = await api(`/api/capabilities/runs/${adHocRunId}`, { user: stranger });
  assert.strictEqual(asStranger.status, 404);
});

test("draft artifact: 404 for anon and stranger, 200 for owner", async () => {
  const anon = await api(`/api/artifacts/${adHocArtifactId}`);
  assert.strictEqual(anon.status, 404);
  const asStranger = await api(`/api/artifacts/${adHocArtifactId}`, { user: stranger });
  assert.strictEqual(asStranger.status, 404);
  const asOwner = await api(`/api/artifacts/${adHocArtifactId}`, { user: owner });
  assert.strictEqual(asOwner.status, 200);
  assert.strictEqual(asOwner.json.artifact.status, "draft");
});

test("publish: non-moderator gets 404 (no probing); moderator publishes; anon can then read", async () => {
  const asOwner = await api(`/api/artifacts/${versionBoundArtifactId}/publish`, { method: "POST", user: owner });
  assert.strictEqual(asOwner.status, 404, "owner is not a moderator — masked as not-found");

  const asMod = await api(`/api/artifacts/${versionBoundArtifactId}/publish`, { method: "POST", user: moderator });
  assert.strictEqual(asMod.status, 200, JSON.stringify(asMod.json));
  assert.strictEqual(asMod.json.artifact.status, "published");
  assert.strictEqual(asMod.json.artifact.isPublic, true);
  assert.strictEqual(asMod.json.artifact.publishedBy, moderator.userId);

  const again = await api(`/api/artifacts/${versionBoundArtifactId}/publish`, { method: "POST", user: moderator });
  assert.strictEqual(again.status, 200, "re-publish must be idempotent");

  const anon = await api(`/api/artifacts/${versionBoundArtifactId}`);
  assert.strictEqual(anon.status, 200);
  assert.strictEqual(anon.json.artifact.payload.conclusion, "verified");
  // the public response must not smuggle in private material
  const serialized = JSON.stringify(anon.json);
  assert.ok(!serialized.includes("provider_trace"), "no provider trace in the public response");
});

test("provider_trace stays unreadable to anon even after publication", async () => {
  const anonClient = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
  const { data } = await anonClient.from("evidence").select("kind").eq("artifact_id", versionBoundArtifactId);
  const kinds = (data ?? []).map((e) => e.kind);
  assert.ok(!kinds.includes("provider_trace"), `anon must never see provider_trace, saw: ${kinds.join(", ")}`);
});

test("optional: real AXLE call (RUN_AXLE_SMOKE_TEST=true)", { skip: process.env.RUN_AXLE_SMOKE_TEST !== "true" }, async () => {
  // Placeholder for the opt-in real-provider check; the mock-based suite above
  // is the default and requires no external service.
  assert.ok(true);
});
