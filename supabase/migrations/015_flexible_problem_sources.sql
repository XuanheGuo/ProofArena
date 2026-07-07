-- Let contest/vault problems represent original or adapted problems without
-- pretending they came from a fixed public exam source.

ALTER TABLE problems
  DROP CONSTRAINT IF EXISTS problems_region_check;

ALTER TABLE problems
  ADD CONSTRAINT problems_region_check
  CHECK (region IN ('天津卷', '天津模考题', '北京卷', '新高考 I 卷', '新高考 II 卷', '清华强基', '北大强基', '原创题', '改编题', '其他来源'));

ALTER TABLE problem_drafts
  DROP CONSTRAINT IF EXISTS problem_drafts_region_check;

ALTER TABLE problem_drafts
  ADD CONSTRAINT problem_drafts_region_check
  CHECK (region IN ('天津卷', '天津模考题', '北京卷', '新高考 I 卷', '新高考 II 卷', '清华强基', '北大强基', '原创题', '改编题', '其他来源'));

NOTIFY pgrst, 'reload schema';
