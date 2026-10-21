import { clamp, round } from "./rand";
import { addDays } from "./time";
import { TEAM_BY_ID, isAltitude } from "./teams";
import { diffDays } from "./time";
import type {
  Game,
  Player,
  PlayerGameLog,
  PlayerTravelImpact,
  Split,
  TravelLeg,
} from "./types";

/** Splits below this n are shown but flagged; below `MIN_MODEL_N` no model is fit. */
export const MIN_SPLIT_SAMPLE = 8;
export const MIN_MODEL_N = 30;

export function travelWindow(legs: TravelLeg[], date: string, days: number): {
  miles: number;
  zones: number;
} {
  const start = addDays(date, -(days - 1));
  const window = legs.filter((l) => l.departDate >= start && l.departDate <= date);
  return {
    miles: window.reduce((sum, l) => sum + l.miles, 0),
    zones: window.reduce((sum, l) => sum + Math.abs(l.timeZoneShift), 0),
  };
}

/** Opponent defensive strength proxy (lower is better defence). */
function defenceRating(teamId: string): number {
  const team = TEAM_BY_ID[teamId];
  return round(118.5 - (team.strength - 70) * 0.35, 1);
}

/**
 * Generate a deterministic per-player game log.
 *
 * Travel effects are *baked in* so the adjustment model has a real signal to
 * recover: back-to-backs, 7-day mileage, time zones, altitude and home/away.
 */
export function generatePlayerLogs(
  player: Player,
  teamGames: Game[],
  legs: TravelLeg[],
  today: string,
): PlayerGameLog[] {
  const logs: PlayerGameLog[] = [];

  for (const game of teamGames) {
    if (game.status !== "final" || game.date >= today) continue;
    const isHome = game.homeTeamId === player.teamId;
    const opponentId = isHome ? game.awayTeamId : game.homeTeamId;
    const rest = restBefore(player.teamId, game, teamGames);
    const win = travelWindow(legs, game.date, 7);
    const altitude = isAltitude(TEAM_BY_ID[game.homeTeamId]) ||
      Boolean(game.neutralSite?.city.includes("Mexico"));

    const key = `log:${player.id}:${game.id}`;
    // Deterministic availability from a hash of the key.
    const h = hashToUnit(key);
    const available = h > (player.starter ? 0.07 : 0.12);

    const b2b = rest === 0;
    const minutesBase = player.minutesPerGame;
    let minutes = minutesBase
      + (b2b ? -0.8 : 0)
      - Math.min(1.2, win.miles / 6000)
      + jitter(key, "min") * 3.2;
    minutes = clamp(minutes, 5, 40);

    const basePts = (player.pointsPer36 * minutes) / 36;
    const adj =
      (b2b ? -2.0 : 0)
      - (win.miles / 1000) * 0.6
      - win.zones * 0.35
      + (isHome ? 1.2 : 0)
      - (altitude && !isHome ? 1.0 : 0)
      + (defenceRating(opponentId) - 114) * 0.11;
    const points = clamp(basePts + adj + jitter(key, "pts") * 4.0, 0, 58);

    const fgPct = clamp(
      0.462 + (player.position === "C" ? 0.04 : 0) - (b2b ? 0.012 : 0) - win.zones * 0.003 + jitter(key, "fg") * 0.045,
      0.28,
      0.68,
    );
    const fg3Pct = clamp(
      0.361 - (b2b ? 0.011 : 0) - win.miles / 100000 + jitter(key, "fg3") * 0.065,
      0.19,
      0.52,
    );
    const turnovers = clamp(2.2 + (b2b ? 0.35 : 0) + jitter(key, "tov") * 0.9, 0, 8);
    const plusMinus = round(jitter(key, "pm") * 8 + (isHome ? 1.8 : -1.2), 0);

    logs.push({
      gameId: game.id,
      date: game.date,
      seasonId: game.seasonId,
      opponentId,
      home: isHome,
      minutes: round(minutes, 1),
      points: round(points, 1),
      rebounds: round(clamp(6.5 - (player.position === "G" ? 2 : 0) + jitter(key, "reb") * 2.6, 0, 18), 1),
      assists: round(clamp(3.4 + (player.position === "G" ? 2.2 : 0) + jitter(key, "ast") * 2, 0, 14), 1),
      fgPct: round(fgPct, 3),
      fg3Pct: round(fg3Pct, 3),
      turnovers: round(turnovers, 1),
      plusMinus,
      restDays: rest,
      backToBack: b2b,
      miles7: Math.round(win.miles),
      timeZones7: win.zones,
      altitudeGame: altitude,
      opponentDefRating: defenceRating(opponentId),
      available,
      note: available ? undefined : "Did not play (mock injury/rest)",
    });
  }

  return logs;
}

function restBefore(teamId: string, game: Game, games: Game[]): number {
  let last: Game | null = null;
  for (const g of games) {
    if (g.date >= game.date) break;
    if (g.homeTeamId === teamId || g.awayTeamId === teamId) last = g;
  }
  if (!last) return 7;
  return Math.max(0, diffDays(game.date, last.date) - 1);
}

function hashToUnit(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i += 1) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

function jitter(key: string, tag: string): number {
  const u = hashToUnit(`${key}:${tag}`);
  const v = hashToUnit(`${key}:${tag}:2`);
  return Math.sqrt(-2 * Math.log(Math.max(u, 1e-9))) * Math.cos(2 * Math.PI * v);
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stdev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1));
}

function makeSplit(key: string, label: string, rows: PlayerGameLog[]): Split {
  const n = rows.length;
  return {
    key,
    label,
    n,
    pts: round(mean(rows.map((r) => r.points)), 1),
    min: round(mean(rows.map((r) => r.minutes)), 1),
    fgPct: round(mean(rows.map((r) => r.fgPct)), 3),
    fg3Pct: round(mean(rows.map((r) => r.fg3Pct)), 3),
    tov: round(mean(rows.map((r) => r.turnovers)), 1),
    plusMinus: round(mean(rows.map((r) => r.plusMinus)), 1),
    ci: n > 1 ? round((1.96 * stdev(rows.map((r) => r.points))) / Math.sqrt(n), 1) : 0,
  };
}

interface OlsResult {
  beta: number[];
  se: number[];
  r2: number;
  n: number;
}

/** Ordinary least squares with a Gaussian-elimination solve and classical SEs. */
export function ols(X: number[][], y: number[]): OlsResult | null {
  const n = X.length;
  const k = X[0]?.length ?? 0;
  if (n <= k + 2 || k === 0) return null;

  // Drop columns with no variation (e.g. a team that never played at altitude
  // in the sample). A constant column is collinear with the intercept and would
  // make the normal equations singular. Dropped terms are reported as 0 with a
  // zero-width interval, which the UI flags as "not distinguishable from zero".
  const keep: number[] = [0];
  for (let j = 1; j < k; j += 1) {
    const column = X.map((row) => row[j]);
    if (stdev(column) > 1e-9) keep.push(j);
  }
  if (keep.length < 2) return null;

  const kr = keep.length;
  const Xr = X.map((row) => keep.map((j) => row[j]));

  const XtX = Array.from({ length: kr }, () => new Array<number>(kr).fill(0));
  const Xty = new Array<number>(kr).fill(0);
  for (let i = 0; i < n; i += 1) {
    for (let a = 0; a < kr; a += 1) {
      Xty[a] += Xr[i][a] * y[i];
      for (let b = 0; b < kr; b += 1) XtX[a][b] += Xr[i][a] * Xr[i][b];
    }
  }

  // Augment with identity to obtain the inverse alongside the solve.
  const aug = XtX.map((row, i) => [...row, ...Array.from({ length: kr }, (_, j) => (i === j ? 1 : 0))]);
  for (let col = 0; col < kr; col += 1) {
    let pivot = col;
    for (let r = col + 1; r < kr; r += 1) {
      if (Math.abs(aug[r][col]) > Math.abs(aug[pivot][col])) pivot = r;
    }
    if (Math.abs(aug[pivot][col]) < 1e-12) return null;
    [aug[col], aug[pivot]] = [aug[pivot], aug[col]];
    const p = aug[col][col];
    for (let c = col; c < 2 * kr; c += 1) aug[col][c] /= p;
    for (let r = 0; r < kr; r += 1) {
      if (r === col) continue;
      const factor = aug[r][col];
      if (factor === 0) continue;
      for (let c = col; c < 2 * kr; c += 1) aug[r][c] -= factor * aug[col][c];
    }
  }

  const inv = aug.map((row) => row.slice(kr));
  const betaReduced = inv.map((row) => row.reduce((sum, v, j) => sum + v * Xty[j], 0));

  const beta = new Array<number>(k).fill(0);
  const se = new Array<number>(k).fill(0);
  keep.forEach((originalIndex, reducedIndex) => {
    beta[originalIndex] = betaReduced[reducedIndex];
  });

  let rss = 0;
  let tss = 0;
  const ybar = mean(y);
  for (let i = 0; i < n; i += 1) {
    const pred = X[i].reduce((sum, v, j) => sum + v * beta[j], 0);
    rss += (y[i] - pred) ** 2;
    tss += (y[i] - ybar) ** 2;
  }
  const sigma2 = rss / Math.max(1, n - kr);
  keep.forEach((originalIndex, reducedIndex) => {
    se[originalIndex] = Math.sqrt(Math.max(0, sigma2 * inv[reducedIndex][reducedIndex]));
  });

  return { beta, se, r2: tss > 0 ? 1 - rss / tss : 0, n };
}

export interface PlayerImpactOptions {
  seasonId: string;
  startDate?: string;
  endDate?: string;
}

export function buildPlayerImpact(
  player: Player,
  logs: PlayerGameLog[],
  options: PlayerImpactOptions,
): PlayerTravelImpact {
  const filtered = logs.filter((log) => {
    if (!log.available) return false;
    if (options.seasonId !== "all" && log.seasonId !== options.seasonId) return false;
    if (options.startDate && log.date < options.startDate) return false;
    if (options.endDate && log.date > options.endDate) return false;
    return true;
  });

  const restRows = [0, 1, 2, 3].map((bucket) =>
    makeSplit(
      `rest-${bucket}`,
      bucket === 3 ? "3+ days rest" : bucket === 0 ? "0 days (B2B)" : `${bucket} day${bucket === 1 ? "" : "s"} rest`,
      filtered.filter((l) => (bucket === 3 ? l.restDays >= 3 : l.restDays === bucket)),
    ),
  );

  const b2bSplits = [
    makeSplit("b2b-yes", "Back-to-back", filtered.filter((l) => l.backToBack)),
    makeSplit("b2b-no", "Rested (1+ days)", filtered.filter((l) => !l.backToBack)),
  ];

  const milesSplits = [
    makeSplit("miles-0", "Under 1,000 mi", filtered.filter((l) => l.miles7 < 1000)),
    makeSplit("miles-1", "1,000–2,500 mi", filtered.filter((l) => l.miles7 >= 1000 && l.miles7 < 2500)),
    makeSplit("miles-2", "2,500–5,000 mi", filtered.filter((l) => l.miles7 >= 2500 && l.miles7 < 5000)),
    makeSplit("miles-3", "5,000+ mi", filtered.filter((l) => l.miles7 >= 5000)),
  ];

  const tzSplits = [
    makeSplit("tz-0", "0 zones", filtered.filter((l) => l.timeZones7 === 0)),
    makeSplit("tz-1", "1 zone", filtered.filter((l) => l.timeZones7 === 1)),
    makeSplit("tz-2", "2+ zones", filtered.filter((l) => l.timeZones7 >= 2)),
  ];

  const altitudeSplits = [
    makeSplit("alt-yes", "Altitude game", filtered.filter((l) => l.altitudeGame)),
    makeSplit("alt-no", "Sea level", filtered.filter((l) => !l.altitudeGame)),
  ];

  const locationSplits = [
    makeSplit("loc-home", "Home", filtered.filter((l) => l.home)),
    makeSplit("loc-away", "Road", filtered.filter((l) => !l.home)),
  ];

  // Adjusted model: points per 36 to neutralise minutes, controlling for
  // opponent quality, home/away, rest and altitude.
  const usable = filtered.filter((l) => l.minutes >= 10);
  const X = usable.map((l) => [
    1,
    l.backToBack ? 1 : 0,
    l.miles7 / 1000,
    l.timeZones7,
    l.altitudeGame ? 1 : 0,
    l.home ? 1 : 0,
    l.opponentDefRating - 114,
  ]);
  const y = usable.map((l) => (l.points / l.minutes) * 36);
  const fit = X.length >= MIN_MODEL_N ? ols(X, y) : null;

  const labels = [
    "Intercept",
    "Back-to-back",
    "Miles in prior 7 days (per 1,000)",
    "Time zones crossed",
    "Altitude game",
    "Home game",
    "Opponent defence (per pt)",
  ];
  const units = ["pts/36", "pts/36", "pts/36", "pts/36", "pts/36", "pts/36", "pts/36"];

  const model = fit
    ? {
        n: fit.n,
        r2: round(fit.r2, 3),
        coefficients: fit.beta.map((estimate, i) => ({
          key: ["intercept", "b2b", "miles", "tz", "altitude", "home", "oppDef"][i],
          label: labels[i],
          estimate: round(estimate, 2),
          ci: round(1.96 * fit.se[i], 2),
          unit: units[i],
        })),
        controls: [
          "Points per 36 minutes (removes minutes-load effects)",
          "Opponent defensive rating",
          "Home vs road",
          "Back-to-back flag",
          "Altitude flag",
        ],
        note:
          "OLS on synthetic game logs. Coefficients describe association, not causation — injuries, matchups and load management are unobserved.",
      }
    : null;

  const coef = (key: string) => model?.coefficients.find((c) => c.key === key);

  /**
   * Shrink each coefficient toward zero by its standard error (z²/(1+z²)), then
   * price a "heavy travel" scenario: a back-to-back, 4,000 miles, two zones and
   * an altitude game. This keeps noisy coefficients from producing extreme
   * scores while still rewarding real signal.
   */
  const shrunk = (key: string): number => {
    const coefficient = coef(key);
    if (!coefficient) return 0;
    const se = coefficient.ci / 1.96;
    if (se <= 1e-9) return 0;
    const z = Math.abs(coefficient.estimate) / se;
    return coefficient.estimate * ((z * z) / (1 + z * z));
  };

  const lostPoints = -(
    shrunk("b2b") * 1 +
    shrunk("miles") * 4 +
    shrunk("tz") * 2 +
    shrunk("altitude") * 1
  );

  const travelImpactScore = model ? Math.round(clamp(45 + lostPoints * 5, 0, 100)) : 50;

  const b2b = b2bSplits[0];
  const rested = b2bSplits[1];
  const away = locationSplits[1];
  const home = locationSplits[0];

  const explanation: string[] = [];
  if (model) {
    const b2bCoef = model.coefficients.find((c) => c.key === "b2b")!;
    const milesCoef = model.coefficients.find((c) => c.key === "miles")!;
    explanation.push(
      `Back-to-backs: ${b2bCoef.estimate > 0 ? "+" : ""}${b2bCoef.estimate.toFixed(2)} pts/36 (95% CI ±${b2bCoef.ci.toFixed(2)}) after controls.`,
    );
    explanation.push(
      `Each additional 1,000 miles in the prior 7 days: ${milesCoef.estimate > 0 ? "+" : ""}${milesCoef.estimate.toFixed(2)} pts/36 (95% CI ±${milesCoef.ci.toFixed(2)}).`,
    );
    explanation.push(
      `Raw split: ${b2b.pts.toFixed(1)} pts on back-to-backs vs ${rested.pts.toFixed(1)} rested (n=${b2b.n}/${rested.n}).`,
    );
  } else {
    explanation.push(
      `Not enough games to fit an adjusted model (${usable.length} < ${MIN_MODEL_N}); descriptive splits only.`,
    );
    if (b2b.n >= MIN_SPLIT_SAMPLE && rested.n >= MIN_SPLIT_SAMPLE) {
      explanation.push(
        `Raw difference: ${(b2b.pts - rested.pts).toFixed(1)} pts on back-to-backs vs rested games.`,
      );
    }
  }
  explanation.push(
    `Road vs home: ${away.pts.toFixed(1)} vs ${home.pts.toFixed(1)} pts per game (n=${away.n}/${home.n}).`,
  );

  const impactLabel =
    travelImpactScore < 35
      ? "Minimal"
      : travelImpactScore < 50
        ? "Low"
        : travelImpactScore < 65
          ? "Moderate"
          : travelImpactScore < 80
            ? "Elevated"
            : "High";

  return {
    playerId: player.id,
    teamId: player.teamId,
    seasonId: options.seasonId,
    games: filtered.length,
    splits: {
      rest: restRows,
      backToBack: b2bSplits,
      miles: milesSplits,
      timeZones: tzSplits,
      altitude: altitudeSplits,
      location: locationSplits,
    },
    travelImpactScore,
    impactLabel,
    explanation,
    model,
    caveats: [
      "Correlation is not causation: travel co-varies with opponent quality, injuries and load management.",
      `Splits under n=${MIN_SPLIT_SAMPLE} are shown for transparency but are not interpretable.`,
      "Mock game logs are synthetic; the signal is designed for demonstration.",
      "Injury/availability states are simulated and may not reflect real absence reasons.",
    ],
    meta: {
      provenance: "mock",
      source: "synthetic game logs + OLS",
      updatedAt: new Date().toISOString(),
      note: "Travel conditions are schedule-derived estimates.",
    },
  };
}
