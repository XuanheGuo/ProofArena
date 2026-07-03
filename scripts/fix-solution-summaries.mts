import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

function splitProcessSteps(value: string): string[] {
  if (!value.trim()) return [];

  const chineseStepRe = /第[一二三四五六七八九十百]+步[:：]?/;
  if (chineseStepRe.test(value)) {
    return value
      .split(/(?=第[一二三四五六七八九十百]+步)/)
      .map((chunk) => chunk.replace(/^第[一二三四五六七八九十百]+步[:：]?\s*/, '').trim())
      .filter(Boolean);
  }

  const numericStepRe = /^\s*\d+[.)、]/m;
  if (numericStepRe.test(value)) {
    return value
      .split(/(?=^\s*\d+[.)、])/m)
      .map((chunk) => chunk.replace(/^\s*\d+[.)、]\s*/, '').trim())
      .filter(Boolean);
  }

  return value
    .split(/(?<=[。！？；])/)
    .map((line) => line.trim())
    .filter(Boolean);
}

async function main() {
  const { data: solutions, error } = await supabase
    .from('solutions')
    .select('id, summary');

  if (error) {
    console.error('读取失败:', error.message);
    process.exit(1);
  }

  const toFix = (solutions ?? []).filter(
    (s) =>
      Array.isArray(s.summary) &&
      s.summary.length === 1 &&
      typeof s.summary[0] === 'string' &&
      (s.summary[0].includes('\n') || /第[一二三四五六七八九十百]+步/.test(s.summary[0])),
  );

  console.log(`共 ${solutions?.length ?? 0} 条解法，其中 ${toFix.length} 条需要修复`);

  let fixed = 0;
  for (const sol of toFix) {
    const newSummary = splitProcessSteps(sol.summary[0]);
    if (newSummary.length <= 1) continue;

    const { error: updateError } = await supabase
      .from('solutions')
      .update({ summary: newSummary })
      .eq('id', sol.id);

    if (updateError) {
      console.error(`[${sol.id}] 更新失败:`, updateError.message);
    } else {
      console.log(`[${sol.id}] 修复: 1 步 → ${newSummary.length} 步`);
      fixed++;
    }
  }

  console.log(`\n完成，修复了 ${fixed} / ${toFix.length} 条`);
}

main();
