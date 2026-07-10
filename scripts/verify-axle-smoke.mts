#!/usr/bin/env npx tsx
/**
 * Optional, opt-in smoke test against the REAL AXLE service.
 *
 * This consumes real AXLE API quota and makes real network calls. It is
 * SKIPPED BY DEFAULT and is not part of `npm test` or CI. It only runs when
 * you explicitly set RUN_AXLE_SMOKE_TEST=true, on top of the normal AXLE_*
 * configuration already required for the app itself.
 *
 * It sends only tiny, non-sensitive, hardcoded Lean snippets — never any
 * real user/problem/solution source — and never writes to
 * verification_tasks or any other table (it calls AxleProvider directly,
 * bypassing VerificationService/Supabase entirely).
 *
 * Usage:
 *   RUN_AXLE_SMOKE_TEST=true npx tsx scripts/verify-axle-smoke.mts
 *
 * Requires (same as the app): AXLE_API_KEY, AXLE_BASE_URL, AXLE_ENVIRONMENT.
 * Never prints the API key or the Authorization header.
 */

import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

const C = {
  reset: "\x1b[0m", bold: "\x1b[1m", green: "\x1b[32m",
  yellow: "\x1b[33m", red: "\x1b[31m", cyan: "\x1b[36m", dim: "\x1b[2m",
};

type CheckStatus = "PASS" | "FAIL" | "SKIP";
interface CheckResult { name: string; status: CheckStatus; detail: string; }
const results: CheckResult[] = [];
function pass(name: string, detail = "") { results.push({ name, status: "PASS", detail }); }
function fail(name: string, detail = "") { results.push({ name, status: "FAIL", detail }); }
function skip(name: string, detail = "") { results.push({ name, status: "SKIP", detail }); }

function printResults() {
  console.log();
  console.log(`${C.bold}${C.cyan}ProofArena AXLE Smoke Test${C.reset}`);
  console.log();
  const maxLen = Math.max(...results.map((r) => r.name.length), 1);
  for (const r of results) {
    const pad = " ".repeat(maxLen - r.name.length);
    const color = r.status === "PASS" ? C.green : r.status === "FAIL" ? C.red : C.dim;
    console.log(`  ${color}${r.status.padEnd(4)}${C.reset}  ${r.name}${pad}${r.detail ? `  ${C.dim}${r.detail}${C.reset}` : ""}`);
  }
  const counts = { PASS: 0, FAIL: 0, SKIP: 0 };
  for (const r of results) counts[r.status]++;
  console.log();
  console.log(`${C.bold}Summary:${C.reset} ${C.green}${counts.PASS} PASS${C.reset}  ${C.red}${counts.FAIL} FAIL${C.reset}  ${C.dim}${counts.SKIP} SKIP${C.reset}`);
  console.log();
}

async function main() {
  if (process.env.RUN_AXLE_SMOKE_TEST !== "true") {
    skip("smoke test", "set RUN_AXLE_SMOKE_TEST=true to run this against the real AXLE service (consumes API quota)");
    printResults();
    process.exit(0);
  }

  const { getVerificationConfig } = await import("../verification/service/config");
  const { AxleProvider } = await import("../verification/providers/axle/axle-provider");

  const config_ = getVerificationConfig();
  if (!config_.axleApiKey) { fail("env: AXLE_API_KEY", "not set"); printResults(); process.exit(1); }
  if (!config_.defaultEnvironment) { fail("env: AXLE_ENVIRONMENT", "not set"); printResults(); process.exit(1); }
  pass("env: AXLE_API_KEY", "(value not printed)");
  pass("env: AXLE_ENVIRONMENT", config_.defaultEnvironment);
  pass("env: AXLE_BASE_URL", config_.axleBaseUrl);

  const provider = new AxleProvider({
    apiKey: config_.axleApiKey, baseUrl: config_.axleBaseUrl,
    timeoutSeconds: Math.min(60, config_.timeoutSeconds), defaultEnvironment: config_.defaultEnvironment,
  });

  const baseRequest = {
    engine: "lean" as const, environment: config_.defaultEnvironment,
    options: { ignoreImports: true, mathlibOptions: false, timeoutSeconds: Math.min(60, config_.timeoutSeconds) },
  };

  // ── 1. accepted: a trivial, genuinely valid theorem ────────────────────────
  try {
    const result = await provider.verify({ ...baseRequest, source: "theorem axle_smoke_accepted : 1 + 1 = 2 := by norm_num" });
    console.log(`  ${C.dim}normalized: verdict=${result.verdict} valid=${result.valid} failedDeclarations=${JSON.stringify(result.failedDeclarations)}${C.reset}`);
    if (result.verdict === "accepted" && result.valid) pass("accepted: trivial true theorem is accepted");
    else fail("accepted: trivial true theorem is accepted", `got verdict=${result.verdict} valid=${result.valid}`);
  } catch (error) {
    fail("accepted: trivial true theorem is accepted", error instanceof Error ? error.message : "unknown error");
  }

  // ── 2. rejected: a genuinely false statement (real compile/tactic failure) ─
  try {
    const result = await provider.verify({ ...baseRequest, source: "theorem axle_smoke_false : (1 : Nat) = 2 := by norm_num" });
    console.log(`  ${C.dim}normalized: verdict=${result.verdict} valid=${result.valid} messages=${result.messages.length}${C.reset}`);
    if (result.verdict === "rejected" && !result.valid) pass("rejected: a genuinely false statement is rejected");
    else fail("rejected: a genuinely false statement is rejected", `got verdict=${result.verdict} valid=${result.valid}`);
  } catch (error) {
    fail("rejected: a genuinely false statement is rejected", error instanceof Error ? error.message : "unknown error");
  }

  // ── 3. sorry: AXLE's failed_declarations is the real backstop, not the ─────
  //    local static precheck (see verification/service/normalization.ts).
  try {
    const result = await provider.verify({ ...baseRequest, source: "theorem axle_smoke_sorry : 1 + 1 = 2 := by sorry" });
    console.log(`  ${C.dim}normalized: verdict=${result.verdict} valid=${result.valid} failedDeclarations=${JSON.stringify(result.failedDeclarations)}${C.reset}`);
    if (result.verdict !== "accepted" && !result.valid) pass("sorry: a sorry-containing proof is never accepted");
    else fail("sorry: a sorry-containing proof is never accepted", `got verdict=${result.verdict} valid=${result.valid} -- if this ever fires, AXLE's contract changed and the fail-safe assumption in docs/VERIFICATION.md needs re-verifying immediately`);
  } catch (error) {
    fail("sorry: a sorry-containing proof is never accepted", error instanceof Error ? error.message : "unknown error");
  }

  printResults();
  process.exit(results.some((r) => r.status === "FAIL") ? 1 : 0);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
