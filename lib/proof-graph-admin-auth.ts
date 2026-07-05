import { createClient } from '@/lib/supabase-server';

export type ProofGraphEditorAuth =
  | { ok: true; userId: string }
  | { ok: false; reason: 'unauthenticated' | 'forbidden'; error: string };

export async function requireProofGraphEditor(): Promise<ProofGraphEditorAuth> {
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  const user = auth.user;

  if (authError || !user) {
    return { ok: false, reason: 'unauthenticated', error: '需要登录后才能编辑推理图谱。' };
  }

  if (user.email === 'xuanheguo@icloud.com') {
    return { ok: true, userId: user.id };
  }

  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError || !profile || !['admin', 'moderator'].includes(profile.role as string)) {
    return { ok: false, reason: 'forbidden', error: '当前账号没有编辑推理图谱的权限。' };
  }

  return { ok: true, userId: user.id };
}
