const OWNER_EMAIL = 'xuanheguo@icloud.com';

// Single source of truth for "is this actor a moderator/admin" across the
// whole app (admin page gates, server actions, verification/, proof graph
// editor, client-side nav). No framework/Supabase imports on purpose, so
// this is safe to import from both server code and "use client" components.
// Do not reimplement this check elsewhere.
export function isModerator(actor: { role?: string | null; email?: string | null }): boolean {
  return actor.email === OWNER_EMAIL || actor.role === 'moderator' || actor.role === 'admin';
}
