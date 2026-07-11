import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase-server';
import { isModerator } from '@/lib/is-moderator';

type RequireModeratorResult =
  | { ok: true; supabase: SupabaseClient; userId: string; email: string | undefined }
  | { ok: false; reason: 'unauthenticated' | 'forbidden'; error: string; supabase: SupabaseClient };

// Shared by every server action and page gate that requires a moderator/admin
// actor (publishing submissions, promoting Problem Vault drafts, the /admin
// pages, ...). Centralized so the admin/moderator check can't drift between
// call sites. See lib/is-moderator.ts for the underlying predicate, which is
// also reused by client components and the verification/ domain module.
export async function requireModerator(): Promise<RequireModeratorResult> {
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  const user = auth.user;

  if (authError || !user) {
    return { ok: false, reason: 'unauthenticated', error: '需要登录后才能执行此操作。', supabase };
  }

  if (isModerator({ email: user.email })) {
    return { ok: true, supabase, userId: user.id, email: user.email };
  }

  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError || !profile || !isModerator({ role: profile.role as string })) {
    return { ok: false, reason: 'forbidden', error: '当前账号没有执行此操作的权限。', supabase };
  }

  return { ok: true, supabase, userId: user.id, email: user.email };
}
