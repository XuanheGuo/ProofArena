#!/usr/bin/env npx tsx
/**
 * Reset a Supabase Auth user's password with the Admin API.
 *
 * Usage:
 *   npx tsx scripts/reset-user-password.mts <user-id> <new-password>
 *
 * Or:
 *   RESET_USER_ID=... RESET_USER_PASSWORD=... npx tsx scripts/reset-user-password.mts
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env
 * or in .env.local. Never expose the service role key in browser code.
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const userId = process.argv[2] ?? process.env.RESET_USER_ID;
const newPassword = process.argv[3] ?? process.env.RESET_USER_PASSWORD;

function fail(message: string): never {
  console.error(`Error: ${message}`);
  process.exit(1);
}

if (!SUPABASE_URL) fail("NEXT_PUBLIC_SUPABASE_URL is not set.");
if (!SERVICE_ROLE_KEY) fail("SUPABASE_SERVICE_ROLE_KEY is not set.");
if (!userId) fail("Missing user id. Pass it as the first argument or RESET_USER_ID.");
if (!newPassword) fail("Missing new password. Pass it as the second argument or RESET_USER_PASSWORD.");
if (newPassword.length < 6) fail("Supabase requires passwords to be at least 6 characters.");

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data, error } = await supabase.auth.admin.updateUserById(userId, {
  password: newPassword,
});

if (error) fail(error.message);

console.log(`Password reset for ${data.user.email ?? data.user.id}`);
