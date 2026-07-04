export function hasSupabasePublicEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function hasSupabaseServiceEnv() {
  return hasSupabasePublicEnv() && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}
