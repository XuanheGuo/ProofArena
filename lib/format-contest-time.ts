// Contest schedules are always communicated in Beijing time, regardless of the
// server's or the visitor's local timezone. Every contest-facing date display
// should go through this module instead of an un-zoned Intl.DateTimeFormat.

const CONTEST_TIME_ZONE = "Asia/Shanghai";

const contestDateTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: CONTEST_TIME_ZONE,
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatContestDateTime(value: string) {
  return contestDateTimeFormatter.format(new Date(value));
}

export function formatContestDateTimeRange(startValue: string, endValue: string) {
  return `${formatContestDateTime(startValue)} – ${formatContestDateTime(endValue)}`;
}

export const CONTEST_TIME_ZONE_LABEL = "北京时间";
