import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Anon-key client for public, read-only data (problems, solutions, contests, ...).
// Deliberately does not call cookies() so pages using it stay eligible for
// static rendering / ISR. Never use for authenticated or write paths.
export function createPublicClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}
