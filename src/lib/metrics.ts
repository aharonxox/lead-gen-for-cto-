// Caller's scoreboard — computed server-side from call_log + leads only
// (Feasibility verdict item 7: no external analytics service).
//
// "Today"/"this week" follow the CALLER's calendar, not the server's: the
// client passes its UTC offset (Date#getTimezoneOffset, minutes — positive
// west of UTC). All comparisons happen in "shifted time": wall-clock-as-UTC,
// so day boundaries land where the caller actually is.
import { type CallEntry, type Lead, type PipelineMetrics } from "./types";

const MS_MIN = 60_000;
const MS_DAY = 86_400_000;

export function computeMetrics(
  leads: Lead[],
  calls: CallEntry[],
  tzOffsetMinutes = 0,
): PipelineMetrics {
  const tz = tzOffsetMinutes * MS_MIN;
  const nowShifted = new Date(Date.now() - tz); // its UTC fields = caller wall clock

  const todayStartMs = Date.UTC(
    nowShifted.getUTCFullYear(),
    nowShifted.getUTCMonth(),
    nowShifted.getUTCDate(),
  );
  // Monday 00:00 of the caller's current week (getUTCDay: 0=Sun…6=Sat).
  const weekStartMs = todayStartMs - ((nowShifted.getUTCDay() + 6) % 7) * MS_DAY;
  const todayKey = new Date(todayStartMs).toISOString().slice(0, 10); // YYYY-MM-DD

  let dialsToday = 0;
  let dialsWeek = 0;
  let connectsToday = 0;
  let connectsWeek = 0;
  for (const c of calls) {
    const shiftedMs = new Date(c.at).getTime() - tz;
    if (shiftedMs >= todayStartMs) {
      dialsToday++;
      if (c.outcome === "connected") connectsToday++;
    }
    if (shiftedMs >= weekStartMs) {
      dialsWeek++;
      if (c.outcome === "connected") connectsWeek++;
    }
  }

  const counts = { new: 0, green: 0, yellow: 0, red: 0 };
  let worked = 0;
  let followUpsDue = 0;
  let followUpsOverdue = 0;
  for (const l of leads) {
    counts[l.status]++;
    if (l.status !== "new" || l.callCount > 0) worked++;
    if (l.status === "yellow" && l.followUpOn) {
      if (l.followUpOn <= todayKey) followUpsDue++;
      if (l.followUpOn < todayKey) followUpsOverdue++;
    }
  }

  return {
    dialsToday,
    dialsWeek,
    connectsToday,
    connectsWeek,
    connectRateToday: dialsToday > 0 ? connectsToday / dialsToday : null,
    connectRateWeek: dialsWeek > 0 ? connectsWeek / dialsWeek : null,
    counts,
    worked,
    conversion: worked > 0 ? counts.green / worked : null,
    followUpsDue,
    followUpsOverdue,
  };
}
