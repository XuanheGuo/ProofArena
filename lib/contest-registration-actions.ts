'use server';

import { createClient, createServiceClient } from '@/lib/supabase-server';
import { requireModerator } from '@/lib/require-moderator';
import { revalidateContestSlug } from '@/lib/revalidate-public';
import type { ContestRegistrationStatus } from '@/lib/types';

type ActionResult = { success: boolean; error?: string };

// Self-serve: a logged-in user requesting to join an approval-mode contest.
// The RLS "Users can request contest registration" policy (020) is the real
// gate — this only turns its rejection into a readable error message.
export async function requestContestRegistration(contestId: string): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const { data: auth, error: authError } = await supabase.auth.getUser();
    const user = auth.user;
    if (authError || !user) {
      return { success: false, error: '需要登录后才能申请参赛。' };
    }

    const { error } = await supabase.from('contest_registrations').insert({
      contest_id: contestId,
      user_id: user.id,
    });

    if (error) {
      // Unique violation: a row already exists (pending/approved/rejected/...)
      // from an earlier request — a duplicate click isn't a real failure.
      if (error.code === '23505') {
        return { success: true };
      }
      return { success: false, error: `申请参赛失败: ${error.message}` };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: '申请参赛时发生异常: ' + (error instanceof Error ? error.message : String(error)),
    };
  }
}

// Moderator-only: approve / reject / remove / suspend / reinstate an
// existing registration row. One action covers all of these — they only
// differ in nextStatus.
export async function reviewContestRegistration(input: {
  registrationId: string;
  nextStatus: ContestRegistrationStatus;
  note?: string;
}): Promise<ActionResult> {
  try {
    const moderator = await requireModerator();
    if (!moderator.ok) return { success: false, error: moderator.error };

    const { data: auth } = await moderator.supabase.auth.getUser();
    const supabase = createServiceClient();

    const patch: Record<string, unknown> = { status: input.nextStatus };
    if (input.note !== undefined) patch.note = input.note;
    if (input.nextStatus === 'approved') {
      patch.approved_by = auth.user?.id ?? null;
    }

    const { data: registration, error } = await supabase
      .from('contest_registrations')
      .update(patch)
      .eq('id', input.registrationId)
      .select('contest_id')
      .single();

    if (error) {
      return { success: false, error: `更新报名状态失败: ${error.message}` };
    }

    if (registration?.contest_id) {
      const { data: contest } = await supabase
        .from('contests')
        .select('slug')
        .eq('id', registration.contest_id)
        .single();
      revalidateContestSlug(contest?.slug ?? null, null);
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: '更新报名状态时发生异常: ' + (error instanceof Error ? error.message : String(error)),
    };
  }
}

// Moderator-only: invite a user who may not have a registration row yet
// (creates one) or re-invite/reinstate one who does (overwrites status back
// to 'invited').
export async function inviteContestParticipant(input: {
  contestId: string;
  userId: string;
}): Promise<ActionResult> {
  try {
    const moderator = await requireModerator();
    if (!moderator.ok) return { success: false, error: moderator.error };

    const { data: auth } = await moderator.supabase.auth.getUser();
    const supabase = createServiceClient();

    const { error } = await supabase
      .from('contest_registrations')
      .upsert(
        {
          contest_id: input.contestId,
          user_id: input.userId,
          status: 'invited',
          role: 'participant',
          invited_by: auth.user?.id ?? null,
        },
        { onConflict: 'contest_id,user_id' },
      );

    if (error) {
      return { success: false, error: `邀请用户失败: ${error.message}` };
    }

    const { data: contest } = await supabase
      .from('contests')
      .select('slug')
      .eq('id', input.contestId)
      .single();
    revalidateContestSlug(contest?.slug ?? null, null);

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: '邀请用户时发生异常: ' + (error instanceof Error ? error.message : String(error)),
    };
  }
}
