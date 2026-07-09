// failure_reason values set by enforce_submission_screening()
// (023_submission_rate_limit_enforcement.sql). Not contest-specific, so kept
// separate from lib/contest-meta.ts.
export type SubmissionFailureReason = 'empty_or_too_short' | 'duplicate';

export const SUBMISSION_FAILURE_REASON_LABELS: Record<SubmissionFailureReason, string> = {
  empty_or_too_short: '内容过短或为空',
  duplicate: '与你近期的投稿内容重复',
};

export function getSubmissionFailureReasonLabel(reason: string | null | undefined): string {
  if (!reason) return '未通过自动预筛';
  return SUBMISSION_FAILURE_REASON_LABELS[reason as SubmissionFailureReason] ?? '未通过自动预筛';
}
