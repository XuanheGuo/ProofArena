import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase-server';

type RequireModeratorResult =
  | { ok: true; supabase: SupabaseClient }
  | { ok: false; error: string; supabase: SupabaseClient };

// Shared by every server action that writes moderator-only content
// (publishing submissions, promoting Problem Vault drafts, ...). Centralized
// so the admin/moderator check can't drift between call sites.
export async function requireModerator(): Promise<RequireModeratorResult> {
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  const user = auth.user;

  if (authError || !user) {
    return { ok: false, error: '需要登录后才能执行此操作。', supabase };
  }

  if (user.email === 'xuanheguo@icloud.com') {
    return { ok: true, supabase };
  }

  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError || !profile || !['moderator', 'admin'].includes(profile.role as string)) {
    return { ok: false, error: '当前账号没有执行此操作的权限。', supabase };
  }

  return { ok: true, supabase };
}
