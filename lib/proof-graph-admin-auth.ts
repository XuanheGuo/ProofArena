import { requireModerator } from '@/lib/require-moderator';

export type ProofGraphEditorAuth =
  | { ok: true; userId: string }
  | { ok: false; reason: 'unauthenticated' | 'forbidden'; error: string };

// Proof Graph editing is moderator-only; this composes the shared
// Authorization predicate rather than re-declaring the email bypass and
// role check (see docs/architecture/principle-violations.md AUTHZ-004).
export async function requireProofGraphEditor(): Promise<ProofGraphEditorAuth> {
  const result = await requireModerator();
  if (!result.ok) {
    return {
      ok: false,
      reason: result.reason,
      error:
        result.reason === 'unauthenticated'
          ? '需要登录后才能编辑推理图谱。'
          : '当前账号没有编辑推理图谱的权限。',
    };
  }
  return { ok: true, userId: result.userId };
}
