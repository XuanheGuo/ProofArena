'use server';

import { createServiceClient } from '@/lib/supabase-server';
import { requireProofGraphEditor } from '@/lib/proof-graph-admin-auth';
import type { ProofGraphV1 } from '@/lib/types';

type SaveResult = { success: true } | { success: false; error: string };

const REQUIRED_KEYS: Array<keyof ProofGraphV1> = [
  'observations',
  'branches',
  'transformations',
  'verificationSteps',
  'methodBoundaries',
  'challengeEdges',
];

function validateProofGraphPayload(proofGraph: ProofGraphV1 | null): string | null {
  if (proofGraph === null) return null;
  if (!proofGraph || typeof proofGraph !== 'object' || Array.isArray(proofGraph)) {
    return 'proof_graph 必须是对象或 null。';
  }

  const obj = proofGraph as unknown as Record<string, unknown>;
  const missing = REQUIRED_KEYS.filter((key) => !Array.isArray(obj[key]));
  if (missing.length) {
    return `proof_graph 缺少必需数组字段：${missing.join(', ')}。`;
  }

  return null;
}

export async function saveProofGraph(
  problemId: string,
  proofGraph: ProofGraphV1 | null,
): Promise<SaveResult> {
  const auth = await requireProofGraphEditor();
  if (!auth.ok) return { success: false, error: auth.error };

  if (!problemId.trim()) {
    return { success: false, error: '题目 ID 不能为空。' };
  }

  const validationError = validateProofGraphPayload(proofGraph);
  if (validationError) {
    return { success: false, error: validationError };
  }

  // Use service client only after authorization passes.
  const supabase = createServiceClient();

  const { data, error: updateError } = await supabase
    .from('problems')
    .update({ proof_graph: proofGraph })
    .eq('id', problemId)
    .select('id')
    .maybeSingle();

  if (updateError) {
    console.error('[saveProofGraph] Update error:', updateError);
    return { success: false, error: `保存失败：${updateError.message}` };
  }

  if (!data) {
    return { success: false, error: '保存失败：没有找到对应题目。' };
  }

  return { success: true };
}
