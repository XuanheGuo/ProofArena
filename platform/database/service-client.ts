// Stable import seam for the service-role Supabase client, so domains/*
// depend on `@/platform/database/service-client` rather than reaching into
// `lib/supabase-server` directly. This is a 3-line re-export, not a new
// db.ts -- see docs/ARCHITECTURE_V2.md §3 (rule: no new giant db.ts) and §10
// (rule: Client Components must never use the service role; only
// server-only repository code imports this module).
import { createServiceClient } from "@/lib/supabase-server";

export function getServiceClient() {
  return createServiceClient();
}
