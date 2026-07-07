-- Allow university strong-foundation sources in the problem catalog.

ALTER TABLE problems
  DROP CONSTRAINT IF EXISTS problems_region_check;

UPDATE problems
SET region = CASE region
  WHEN '清华' THEN '清华强基'
  WHEN '北大' THEN '北大强基'
  ELSE region
END
WHERE region IN ('清华', '北大');

ALTER TABLE problems
  ADD CONSTRAINT problems_region_check
  CHECK (region IN ('天津卷', '天津模考题', '北京卷', '新高考 I 卷', '新高考 II 卷', '清华强基', '北大强基', '原创题', '改编题', '其他来源'));
