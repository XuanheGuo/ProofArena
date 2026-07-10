import assert from "node:assert/strict";
import test from "node:test";
import { getVerificationDisplay } from "./ui-meta";
import { isStrictlyLeanVerified } from "./domain/policies";

test("UI distinguishes running, rejection, timeout, provider failure and rate limit", () => {
  assert.equal(getVerificationDisplay({ status: "running", verdict: "provider_error" }).label, "正在验证");
  assert.equal(getVerificationDisplay({ status: "completed", verdict: "rejected" }).label, "证明未通过");
  assert.equal(getVerificationDisplay({ status: "failed", verdict: "timeout" }).label, "验证超时");
  assert.equal(getVerificationDisplay({ status: "failed", verdict: "provider_error" }).label, "验证服务暂时不可用");
  assert.equal(getVerificationDisplay({ status: "failed", verdict: "rate_limited" }).label, "请求过于频繁");
});

test("Lean Verified requires completed accepted valid and no failed declarations", () => {
  assert.equal(isStrictlyLeanVerified({ status: "completed", verdict: "accepted", valid: true, failedDeclarations: [] }), true);
  assert.equal(isStrictlyLeanVerified({ status: "completed", verdict: "accepted", valid: true, failedDeclarations: ["x"] }), false);
  assert.equal(isStrictlyLeanVerified({ status: "completed", verdict: "rejected", valid: true, failedDeclarations: [] }), false);
});
