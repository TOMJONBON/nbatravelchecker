import { TEAM_IDS, TEAM_BY_ID } from "./teams";
import { addDays, diffDays, leagueInstant, rangeDates, todayISO, weekdayLabel } from "./time";
import { gaussian, rngFor, shuffle } from "./rand";
import { haversineMiles } from "./geo";
import { injuryImpact } from "./injuries";
import { PLAYERS } from "./players";
import type { Game, NeutralSite, SeasonType } from "./types";

export interface Season {
  id: string;
  label: string;
  start: string;
  end: string;
  type: SeasonType;
  complete: boolean;
  note: string;
}

/**
 * Mock seasons.
 *
 * `2025-26` is a completed synthetic season used for historical splits and
 * backtests. `2026-27` is the live demo season; its calendar is compressed
 * (September start) so that the dashboard has meaningful early-season data on
 * the demo date. Both are labelled Mock everywhere they surface.
 */
export const SEASONS: Season[] = [
  {
    id: "2025-26",
    label: "2025-26",
    start: "2025-10-21",
    end: "2026-04-12",
    type: "regular",
    complete: true,
    note: "Completed synthetic season — used for historical splits and backtests.",
  },
  {
    id: "2026-27",
    label: "2026-27",
    start: "2026-09-15",
    end: "2027-04-11",
    type: "regular",
    complete: false,
    note: "Current demo season with a compressed calendar. Dates are synthetic.",
  },
];

export const CURRENT_SEASON_ID = "2026-27";
export const PREVIOUS_SEASON_ID = "2025-26";

export function getSeason(id: string): Season {
  return SEASONS.find((s) => s.id === id) ?? SEASONS[SEASONS.length - 1];
}

export function seasonForDate(date: string): Season {
  return SEASONS.find((s) => date >= s.start && date <= s.end) ?? getSeason(CURRENT_SEASON_ID);
}

/** Internal game shape: synthetic final scores are kept here and masked by the view layer. */
export interface SimulatedGame extends Game {
  result: { home: number; away: number } | null;
}

interface Counts {
  games: number;
  home: number;
  away: number;
}

const HOME_ADVANTAGE_ELO = 60;
const ELO_K = 18;
const LEAGUE_AVG_TOTAL = 228;

function seedElo(teamId: string): number {
  return 1500 + (TEAM_BY_ID[teamId].strength - 78) * 9;
}

export { seedElo };

function tipoffHour(date: string): { hour: number; minute: number } {
  const dow = weekdayLabel(date);
  if (dow === "Sun") return { hour: 15, minute: 30 };
  if (dow === "Sat") return { hour: 20, minute: 0 };
  return { hour: 19, minute: 30 };
}

function neutralSites(): { date: string; site: NeutralSite }[] {
  return [
    {
      date: "2026-11-07",
      site: {
        name: "Arena CDMX",
        city: "Mexico City, MX",
        lat: 19.4042,
        lon: -99.0907,
        note: "NBA Mexico City Game — international neutral site, 7,350 ft altitude.",
        utcOffset: -6,
      },
    },
    {
      date: "2026-11-14",
      site: {
        name: "T-Mobile Arena",
        city: "Las Vegas, NV",
        lat: 36.1027,
        lon: -115.1782,
        note: "Neutral-site game. Neither team is at home; no home-court term applied.",
        utcOffset: -7,
      },
    },
  ];
}

/**
 * Build a deterministic synthetic schedule for a season.
 *
 * Pairing rules: teams need a two-day gap unless a seeded coin flip creates a
 * back-to-back; games per team are capped at 82 and home/away is balanced.
 * This is a plausible schedule, not the official NBA schedule.
 */
export function buildSchedule(seasonId: string, horizonISO: string): SimulatedGame[] {
  const season = getSeason(seasonId);
  const horizon = horizonISO < season.end ? horizonISO : season.end;
  const teams = TEAM_IDS;
  const rng = rngFor(`schedule:v3:${season.id}`);
  const lastPlayed = new Map<string, string>();
  /** Last city a team was in, used to bake travel distance into results. */
  const lastCity = new Map<string, { lat: number; lon: number }>(
    teams.map((team) => [team, TEAM_BY_ID[team].arena]),
  );
  const counts = new Map<string, Counts>(teams.map((t) => [t, { games: 0, home: 0, away: 0 }]));
  const meetings = new Map<string, string[]>(); // pair key -> dates
  const games: SimulatedGame[] = [];
  const elo = new Map<string, number>(teams.map((t) => [t, seedElo(t)]));

  const pairKey = (a: string, b: string) => [a, b].sort().join(":");

  for (const date of rangeDates(season.start, horizon)) {
    const eligible = teams.filter((team) => {
      const c = counts.get(team)!;
      if (c.games >= 82) return false;
      const last = lastPlayed.get(team);
      if (!last) return true;
      const gap = diffDays(date, last);
      if (gap >= 2) return true;
      if (gap === 1) return rng() < 0.22;
      return false;
    });

    let pool = shuffle(rng, eligible);
    const target = Math.min(8, 4 + Math.floor(rng() * 5));
    let made = 0;
    let guard = 0;

    while (pool.length >= 2 && made < target && guard < 40) {
      guard += 1;
      const a = pool.shift()!;
      const keyCandidates = pool
        .filter((b) => {
          const k = pairKey(a, b);
          const past = meetings.get(k) ?? [];
          if (past.length >= 4) return false;
          const lastMeeting = past[past.length - 1];
          if (lastMeeting && diffDays(date, lastMeeting) < 14) return false;
          return true;
        })
        .sort((x, y) => counts.get(x)!.games - counts.get(y)!.games);

      if (keyCandidates.length === 0) continue;

      const sameConference = keyCandidates.filter(
        (b) => TEAM_BY_ID[b].conference === TEAM_BY_ID[a].conference,
      );
      const shortlist = (rng() < 0.62 && sameConference.length > 0 ? sameConference : keyCandidates).slice(
        0,
        4,
      );
      const b = shortlist[Math.floor(rng() * shortlist.length)];
      pool = pool.filter((p) => p !== b);

      const ca = counts.get(a)!;
      const cb = counts.get(b)!;
      let home: string;
      let away: string;
      if (ca.home - ca.away > cb.home - cb.away) {
        home = b;
        away = a;
      } else if (cb.home - cb.away > ca.home - ca.away) {
        home = a;
        away = b;
      } else {
        home = rng() < 0.5 ? a : b;
        away = home === a ? b : a;
      }

      const { hour, minute } = tipoffHour(date);
      const tipoff = leagueInstant(date, hour, minute).toISOString();
      const id = `${season.id}-${date}-${away}-${home}`;

      const base: SimulatedGame = {
        id,
        seasonId: season.id,
        date,
        tipoff,
        homeTeamId: home,
        awayTeamId: away,
        status: "final",
        homeScore: null,
        awayScore: null,
        period: "Final",
        clock: null,
        venueType: "team",
        seasonType: "regular",
        result: null,
      };

      // Elo-driven synthetic result (kept internal until the game is final).
      // Rest, travel and availability effects are baked into the simulated
      // margin so the prediction model has a real signal to recover.
      const expectedHome = elo.get(home)! + HOME_ADVANTAGE_ELO - elo.get(away)!;
      const restFor = (teamId: string): number => {
        const last = lastPlayed.get(teamId);
        if (!last) return 3;
        return Math.max(0, diffDays(date, last) - 1);
      };
      const homeRest = restFor(home);
      const awayRest = restFor(away);

      const arenaHome = TEAM_BY_ID[home].arena;
      const previousCityHome = lastCity.get(home) ?? arenaHome;
      const previousCityAway = lastCity.get(away) ?? TEAM_BY_ID[away].arena;
      const awayMiles = haversineMiles(previousCityAway, arenaHome);
      const homeMiles = haversineMiles(previousCityHome, arenaHome);
      lastCity.set(home, arenaHome);
      lastCity.set(away, arenaHome);

      const homeInjury = injuryImpact(base, home, PLAYERS).points;
      const awayInjury = injuryImpact(base, away, PLAYERS).points;

      let trueMargin = expectedHome / 25;
      if (homeRest === 0) trueMargin -= 1.4;
      if (awayRest === 0) trueMargin += 2.0;
      if (TEAM_BY_ID[home].arena.altitudeFt >= 4000 && awayRest <= 1) trueMargin += 0.9;
      trueMargin += ((awayMiles - homeMiles) / 1000) * 0.22;
      trueMargin += (awayInjury - homeInjury) * 0.55;

      const margin = gaussian(rng, trueMargin, 11.5);
      const paceNoise = gaussian(rng, 0, 6.5);
      const total = LEAGUE_AVG_TOTAL + paceNoise;
      let homeScore = Math.round(total / 2 + margin / 2);
      let awayScore = Math.round(total / 2 - margin / 2);
      homeScore = Math.max(78, homeScore);
      awayScore = Math.max(78, awayScore);
      if (homeScore === awayScore) homeScore += 1;

      base.homeScore = homeScore;
      base.awayScore = awayScore;
      base.result = { home: homeScore, away: awayScore };
      games.push(base);

      meetings.set(pairKey(a, b), [...(meetings.get(pairKey(a, b)) ?? []), date]);
      lastPlayed.set(a, date);
      lastPlayed.set(b, date);
      ca.games += 1;
      cb.games += 1;
      ca.home += home === a ? 1 : 0;
      ca.away += away === a ? 1 : 0;
      cb.home += home === b ? 1 : 0;
      cb.away += away === b ? 1 : 0;

      // Elo update from the synthetic result.
      const homeWon = homeScore > awayScore;
      const expHome = 1 / (1 + 10 ** (-(expectedHome) / 400));
      const actual = homeWon ? 1 : 0;
      elo.set(home, elo.get(home)! + ELO_K * (actual - expHome));
      elo.set(away, elo.get(away)! - ELO_K * (actual - expHome));

      made += 1;
    }
  }

  applySpecialGames(games, season.id);
  return games.sort((a, b) => (a.tipoff < b.tipoff ? -1 : 1));
}

/** Neutral-site, international, and postponed examples required by the spec. */
function applySpecialGames(games: SimulatedGame[], seasonId: string): void {
  if (seasonId !== CURRENT_SEASON_ID) return;
  for (const { date, site } of neutralSites()) {
    const candidates = games.filter((g) => g.date === date && g.venueType === "team");
    const game = candidates[0];
    if (!game) continue;
    game.venueType = site.city.includes("MX") ? "international" : "neutral";
    game.neutralSite = site;
  }

  // One postponed game: moved two weeks later and flagged as rescheduled.
  const today = todayISO();
  const past = games.filter((g) => g.date < today && g.date > addDays(today, -18) && g.result);
  const target = past[Math.floor(past.length * 0.4)];
  if (target) {
    const original = target.result!;
    const originalDate = target.date;
    target.status = "postponed";
    target.postponedReason = "Arena availability / weather (mock example)";
    target.homeScore = null;
    target.awayScore = null;
    target.result = null;

    const movedDate = addDays(originalDate, 16);
    games.push({
      ...target,
      id: `${target.id}-R`,
      date: movedDate,
      tipoff: leagueInstant(movedDate, 19, 30).toISOString(),
      status: "final",
      postponedReason: undefined,
      rescheduled: true,
      homeScore: original.home,
      awayScore: original.away,
      result: original,
    });
  }
}

/** Clamp the horizon so the demo never pretends to know the far future. */
export function scheduleHorizon(now = new Date()): string {
  return addDays(todayISO(now), 21);
}

export function buildSeasonGames(seasonId: string, now = new Date()): SimulatedGame[] {
  const horizon = seasonId === CURRENT_SEASON_ID ? scheduleHorizon(now) : getSeason(seasonId).end;
  return buildSchedule(seasonId, horizon);
}
