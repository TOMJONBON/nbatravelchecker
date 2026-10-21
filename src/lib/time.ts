/**
 * Date helpers. The app uses "league dates" (YYYY-MM-DD, America/New_York) for
 * schedules and UTC instants for tipoffs so the timeline scrubber is stable
 * regardless of the viewer's time zone.
 */

export const LEAGUE_TZ = "America/New_York";

const pad = (n: number) => String(n).padStart(2, "0");

export function isoDateIn(date: Date, timeZone = LEAGUE_TZ): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "01";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function todayISO(now = new Date()): string {
  return isoDateIn(now);
}

/** Parse YYYY-MM-DD as a UTC noon instant (date arithmetic without DST drift). */
export function parseDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0));
}

export function addDays(iso: string, days: number): string {
  const d = parseDate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function diffDays(a: string, b: string): number {
  return Math.round((parseDate(a).getTime() - parseDate(b).getTime()) / 86_400_000);
}

export function rangeDates(start: string, end: string): string[] {
  const out: string[] = [];
  let cur = start;
  let guard = 0;
  while (cur <= end && guard < 800) {
    out.push(cur);
    cur = addDays(cur, 1);
    guard += 1;
  }
  return out;
}

export function weekdayLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" }).format(parseDate(iso));
}

export function monthDayLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(
    parseDate(iso),
  );
}

export function longDateLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(parseDate(iso));
}

/** UTC offset in minutes for a zone at a given instant (DST-aware). */
export function tzOffsetMinutes(instant: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(instant);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const asUTC = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second"),
  );
  return Math.round((asUTC - instant.getTime()) / 60000);
}

/** Build a UTC instant from a league-local date + wall clock time. */
export function leagueInstant(dateISO: string, hour: number, minute = 0): Date {
  const naive = Date.parse(`${dateISO}T${pad(hour)}:${pad(minute)}:00Z`);
  let instant = new Date(naive);
  for (let i = 0; i < 2; i += 1) {
    const offset = tzOffsetMinutes(instant, LEAGUE_TZ);
    instant = new Date(naive - offset * 60000);
  }
  return instant;
}

export function formatTipoff(iso: string, timeZone?: string): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timeZone ?? LEAGUE_TZ,
    timeZoneName: "short",
  }).format(new Date(iso));
}

export function relativeTime(iso: string, now = new Date()): string {
  const delta = Math.round((now.getTime() - new Date(iso).getTime()) / 1000);
  if (Math.abs(delta) < 30) return "just now";
  if (delta < 0) {
    const mins = Math.round(-delta / 60);
    if (mins < 60) return `in ${mins}m`;
    return `in ${Math.round(mins / 60)}h`;
  }
  if (delta < 60) return `${delta}s ago`;
  if (delta < 3600) return `${Math.round(delta / 60)}m ago`;
  if (delta < 86_400) return `${Math.round(delta / 3600)}h ago`;
  return `${Math.round(delta / 86_400)}d ago`;
}
