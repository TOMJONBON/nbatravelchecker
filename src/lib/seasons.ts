/**
 * Season arithmetic.
 *
 * The NBA labels a season by the year it starts and the year it ends
 * ("2026-27"), while ESPN keys it by the ending year (2027). Everything is
 * derived from the current date so the app rolls into a new season without a
 * code change.
 */

export interface SeasonConfig {
  /** e.g. "2026-27" */
  current: string;
  /** e.g. "2025-26" */
  previous: string;
  /** Season used to fit model coefficients, e.g. "2024-25" */
  fit: string;
  /** ESPN season year, e.g. 2027 */
  currentYear: number;
}

/**
 * ESPN/league season year for a given date.
 *
 * Sep–Dec → next calendar year (the season that is about to start),
 * Jan–Jun → the current calendar year (the season in progress),
 * Jul–Aug → the just-finished season (offseason).
 */
export function seasonYearFor(now: Date = new Date()): number {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth(); // 0 = Jan
  if (month >= 8) return year + 1; // Sep, Oct, Nov, Dec
  return year; // Jan–Aug
}

export function seasonId(year: number): string {
  const start = year - 1;
  const end = String(year % 100).padStart(2, "0");
  return `${start}-${end}`;
}

export function espnYearFor(id: string): number {
  const end = Number(id.split("-")[1]);
  return Number.isFinite(end) ? 2000 + end : new Date().getUTCFullYear();
}

export function seasonConfig(now: Date = new Date()): SeasonConfig {
  const currentYear = seasonYearFor(now);
  return {
    current: seasonId(currentYear),
    previous: seasonId(currentYear - 1),
    fit: seasonId(currentYear - 2),
    currentYear,
  };
}

/** "2026-27" → "2026-27"; used for display and validation. */
export function isSeasonId(value: string): boolean {
  return /^\d{4}-\d{2}$/.test(value);
}
