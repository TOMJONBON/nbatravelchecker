import { diffDays } from "./time";
import type { Game, TeamRecord } from "./types";

export const EMPTY_RECORD: TeamRecord = {
  wins: 0,
  losses: 0,
  games: 0,
  winPct: 0,
  pointsFor: 0,
  pointsAgainst: 0,
  form: [],
};

export function summarizeGames(teamId: string, games: Game[]): TeamRecord {
  const finals = games.filter(
    (g) => g.status === "final" && g.homeScore !== null && g.awayScore !== null,
  );
  let wins = 0;
  let losses = 0;
  let pointsFor = 0;
  let pointsAgainst = 0;
  const form: ("W" | "L")[] = [];

  for (const g of finals) {
    const isHome = g.homeTeamId === teamId;
    const own = (isHome ? g.homeScore : g.awayScore) ?? 0;
    const opp = (isHome ? g.awayScore : g.homeScore) ?? 0;
    pointsFor += own;
    pointsAgainst += opp;
    if (own > opp) {
      wins += 1;
      form.push("W");
    } else {
      losses += 1;
      form.push("L");
    }
  }

  return {
    wins,
    losses,
    games: wins + losses,
    winPct: wins + losses > 0 ? wins / (wins + losses) : 0,
    pointsFor,
    pointsAgainst,
    form: form.slice(-5),
  };
}

export function homeRecord(teamId: string, games: Game[]): TeamRecord {
  return summarizeGames(
    teamId,
    games.filter((g) => g.homeTeamId === teamId && g.venueType === "team"),
  );
}

export function awayRecord(teamId: string, games: Game[]): TeamRecord {
  return summarizeGames(
    teamId,
    games.filter((g) => g.awayTeamId === teamId),
  );
}

export function restDaysBefore(teamId: string, game: Game, games: Game[]): number {
  const prior = games
    .filter((g) => g.id !== game.id && g.date < game.date && (g.homeTeamId === teamId || g.awayTeamId === teamId))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  const last = prior[prior.length - 1];
  if (!last) return 7;
  return Math.max(0, diffDays(game.date, last.date) - 1);
}

export interface TeamSplitRow {
  key: string;
  label: string;
  games: number;
  wins: number;
  losses: number;
  winPct: number;
  pointsFor: number;
  pointsAgainst: number;
}

export interface TeamSplits {
  rest: TeamSplitRow[];
  location: TeamSplitRow[];
  altitude: TeamSplitRow[];
  backToBack: TeamSplitRow[];
}

function bucket(rows: Map<string, TeamSplitRow>, key: string, label: string): TeamSplitRow {
  if (!rows.has(key)) {
    rows.set(key, {
      key,
      label,
      games: 0,
      wins: 0,
      losses: 0,
      winPct: 0,
      pointsFor: 0,
      pointsAgainst: 0,
    });
  }
  return rows.get(key)!;
}

/** Splits need a travel context; pass a precomputed map of gameId -> rest days. */
export function buildTeamSplits(
  teamId: string,
  games: Game[],
  restByGame: Map<string, number>,
  b2bByGame: Set<string>,
  altitudeByGame: Set<string>,
): TeamSplits {
  const finals = games.filter(
    (g) => g.status === "final" && g.homeScore !== null && g.awayScore !== null,
  );
  const restRows = new Map<string, TeamSplitRow>();
  const locRows = new Map<string, TeamSplitRow>();
  const altRows = new Map<string, TeamSplitRow>();
  const b2bRows = new Map<string, TeamSplitRow>();

  for (const g of finals) {
    const isHome = g.homeTeamId === teamId;
    const own = (isHome ? g.homeScore : g.awayScore) ?? 0;
    const opp = (isHome ? g.awayScore : g.homeScore) ?? 0;
    const win = own > opp;

    const rest = restByGame.get(g.id) ?? 0;
    const restKey = rest >= 3 ? "3+" : String(rest);
    const restLabel = rest === 0 ? "0 days" : rest >= 3 ? "3+ days" : `${rest} day${rest === 1 ? "" : "s"}`;

    for (const [rows, key, label] of [
      [restRows, `rest-${restKey}`, restLabel],
      [locRows, isHome ? "home" : "away", isHome ? "Home" : "Road"],
      [altRows, altitudeByGame.has(g.id) ? "alt" : "sea", altitudeByGame.has(g.id) ? "Altitude" : "Sea level"],
      [b2bRows, b2bByGame.has(g.id) ? "b2b" : "rested", b2bByGame.has(g.id) ? "Back-to-back" : "Rested"],
    ] as const) {
      const row = bucket(rows as Map<string, TeamSplitRow>, key, label);
      row.games += 1;
      row.wins += win ? 1 : 0;
      row.losses += win ? 0 : 1;
      row.pointsFor += own;
      row.pointsAgainst += opp;
    }
  }

  const finish = (rows: Map<string, TeamSplitRow>, order?: string[]) => {
    const list = Array.from(rows.values()).map((r) => ({
      ...r,
      winPct: r.games ? r.wins / r.games : 0,
    }));
    if (!order) return list;
    return list.sort((a, b) => order.indexOf(a.key.split("-")[0]) - order.indexOf(b.key.split("-")[0]));
  };

  return {
    rest: finish(restRows, ["rest-0", "rest-1", "rest-2", "rest-3"]),
    location: finish(locRows),
    altitude: finish(altRows),
    backToBack: finish(b2bRows),
  };
}
