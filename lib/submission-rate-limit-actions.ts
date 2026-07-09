'use server';

import { createServiceClient } from '@/lib/supabase-server';
import { requireModerator } from '@/lib/require-moderator';

type ActionResult = { success: boolean; error?: string };

// Moderator-only: manually lift a user's rate-limit cooldown for one
// (contest problem / problem / draft problem) scope, e.g. after reviewing
// their precheck_failed history and deciding the escalation was unwarranted.
// scope_key must match the format enforce_submission_rate_limit /
// enforce_submission_screening compute in 023_submission_rate_limit_enforcement.sql
// ('contest_problem:<uuid>' | 'problem:<id>' | 'draft_problem:<id>' | 'general').
export async function clearSubmissionCooldown(input: {
  userId: string;
  scopeKey: string;
}): Promise<ActionResult> {
  try {
    const moderator = await requireModerator();
    if (!moderator.ok) return { success: false, error: moderator.error };

    const supabase = createServiceClient();
    const { error } = await supabase
      .from('submission_rate_limits')
      .update({ cooldown_until: null, consecutive_failures: 0 })
      .eq('user_id', input.userId)
      .eq('scope_key', input.scopeKey);

    if (error) {
      return { success: false, error: `解除冷却失败: ${error.message}` };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: '解除冷却时发生异常: ' + (error instanceof Error ? error.message : String(error)),
    };
  }
}
