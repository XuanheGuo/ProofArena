import assert from "node:assert/strict";
import test from "node:test";
import { isModerator } from "./is-moderator";

test("role admin or moderator is sufficient regardless of email", () => {
  assert.equal(isModerator({ role: "admin" }), true);
  assert.equal(isModerator({ role: "moderator" }), true);
  assert.equal(isModerator({ role: "admin", email: "someone@example.com" }), true);
});

test("plain user role without the owner email is rejected", () => {
  assert.equal(isModerator({ role: "user" }), false);
  assert.equal(isModerator({}), false);
  assert.equal(isModerator({ role: null, email: null }), false);
});

test("the hardcoded owner email bypasses the role check", () => {
  assert.equal(isModerator({ email: "xuanheguo@icloud.com" }), true);
  assert.equal(isModerator({ role: "user", email: "xuanheguo@icloud.com" }), true);
});

test("a similar but different email does not bypass", () => {
  assert.equal(isModerator({ email: "xuanheguo@icloud.co" }), false);
  assert.equal(isModerator({ email: "notxuanheguo@icloud.com" }), false);
});
