/**
 * Public data layer.
 *
 * Live mode pulls real schedules, scores, injuries, rosters and player game logs
 * from ESPN's public NBA endpoints. If anything critical fails, the synthetic
 * engine takes over and every surface is labelled Mock instead of Live.
 */
import { TEAMS, TEAM_BY_ID, isAltitude } from "./teams";
import { buildTeamSchedule, travelInWindow, type TeamSchedule } from "./travel";
import { buildTeamMetrics, computeFatigueIndex } from "./fatigue";
import { awayRecord, buildTeamSplits, homeRecord, summarizeGames } from "./stats";
import { buildModelReport, type ModelReportBundle } from "./model";
import { eloUpdate, predictGame, DEFAULT_COEFFICIENTS, type EloState, type GameFeatures, type ModelCoefficients } from "./predictions";
import { seedElo } from "./schedule";
import { buildPlayerImpact, ols } from "./player-impact";
import { addDays, diffDays, isoDateIn, todayISO } from "./time";
import { clamp, round } from "./rand";
import { forceMock } from "./providers";
import {
  espnHealth,
  fetchInjuries,
  fetchPlayerHistory,
  fetchRoster,
  fetchScoreboard,
  fetchSeasonSchedule,
  type RawGamelog,
} from "./providers/espn";
import * as mock from "./dataset";
import { seasonConfig, seasonId, espnYearFor } from "./seasons";
import { ledgerReport, recordPredictions, type LedgerEntry, type LedgerReport } from "./ledger";
import type {
  Alert,
  DataMeta,
  DataSourceStatus,
  Game,
  InjuryStatus,
  ModelReport,
  Player,
  PlayerGameLog,
  PlayerTravelImpact,
  Prediction,
  PredictionRecord,
  RoadTrip,
  Team,
  TeamRecord,
  TeamTravelMetrics,
} from "./types";

export type DatasetMode = "live" | "mock";

/** Bumped whenever the fitted coefficients or features change. */
export const LIVE_MODEL_VERSION = "v2.0-live-elo-fatigue";

export interface AppDataset {
  mode: DatasetMode;
  generatedAt: string;
  today: string;
  seasonId: string;
  previousSeasonId: string;
  fitSeasonId: string;
  /** True when the current season's schedule is not published yet. */
  offseason: boolean;
  games: Game[];
  schedules: Record<string, TeamSchedule>;
  history: Record<string, Record<string, TeamSchedule>>;
  metrics: Record<string, TeamTravelMetrics>;
  predictions: Record<string, Prediction>;
  records: PredictionRecord[];
  report: ModelReportBundle;
  ledger: LedgerReport;
  alerts: Alert[];
  injuries: InjuryStatus[];
  defRatings: Record<string, number>;
  coefficients: ModelCoefficients;
  status: DataSourceStatus[];
  meta: DataMeta;
}

const DATASET_TTL_MS = 15_000;
let datasetCache: { expires: number; data: AppDataset } | null = null;
let pendingBuild: Promise<AppDataset> | null = null;

// ─── Shared helpers ─────────────────────────────────────────────────────────

function meta(provenance: DataMeta["provenance"], source: string, note?: string): DataMeta {
  return { provenance, source, updatedAt: new Date().toISOString(), note };
}

function emptyLedger(note = "No graded predictions yet."): LedgerReport {
  return {
    entries: 0,
    graded: 0,
    accuracy: null,
    brier: null,
    logLoss: null,
    firstCapturedAt: null,
    lastGradedAt: null,
    storage: "memory",
    note,
  };
}

function restFor(game: Game, schedule: TeamSchedule): number {
  const prior = schedule.games.filter((g) => g.date < game.date && g.id !== game.id);
  const last = prior[prior.length - 1];
  if (!last) return 7;
  return Math.max(0, diffDays(game.date, last.date) - 1);
}

const INJURY_WEIGHT: Record<InjuryStatus["status"], number> = {
  out: 1.4,
  doubtful: 0.9,
  questionable: 0.5,
  probable: 0.2,
  available: 0,
};

function injuryPoints(list: InjuryStatus[]): number {
  return round(Math.min(4.5, list.reduce((sum, item) => sum + (INJURY_WEIGHT[item.status] ?? 0), 0)), 1);
}

function sortByTipoff(games: Game[]): Game[] {
  return [...games].sort((a, b) => (a.tipoff < b.tipoff ? -1 : a.tipoff > b.tipoff ? 1 : 0));
}

function replayElo(games: Game[], beforeDate: string, includeDate = false): EloState {
  const state: EloState = {
    ratings: Object.fromEntries(TEAMS.map((team) => [team.id, seedElo(team.id)])),
    played: Object.fromEntries(TEAMS.map((team) => [team.id, 0])),
  };
  for (const game of games) {
    if (game.status !== "final" || game.homeScore === null || game.awayScore === null) continue;
    const inRange = includeDate ? game.date <= beforeDate : game.date < beforeDate;
    if (!inRange) continue;
    eloUpdate(state, game, game.homeScore, game.awayScore);
  }
  return state;
}

// ─── Per-game travel features (memoised per season/team) ────────────────────

interface TravelFeature {
  rest: number;
  miles7: number;
  tz7: number;
  b2b: boolean;
}

const featureMaps = new Map<string, Map<string, TravelFeature>>();

function featureKey(seasonId: string, teamId: string): string {
  return `${seasonId}:${teamId}`;
}

function buildFeatureMap(schedule: TeamSchedule): Map<string, TravelFeature> {
  const map = new Map<string, TravelFeature>();
  let previous: Game | null = null;
  for (const game of schedule.games) {
    const rest = previous ? Math.max(0, diffDays(game.date, previous.date) - 1) : 3;
    const window = travelInWindow(schedule.legs, game.date, 7);
    map.set(game.id, {
      rest,
      miles7: window.miles,
      tz7: window.timeZones,
      b2b: rest === 0,
    });
    previous = game;
  }
  return map;
}

function registerFeatureMaps(seasonId: string, schedules: Record<string, TeamSchedule>): void {
  for (const [teamId, schedule] of Object.entries(schedules)) {
    featureMaps.set(featureKey(seasonId, teamId), buildFeatureMap(schedule));
  }
}

function featuresOf(seasonId: string, teamId: string, gameId: string): TravelFeature {
  const map = featureMaps.get(featureKey(seasonId, teamId));
  return map?.get(gameId) ?? { rest: 3, miles7: 0, tz7: 0, b2b: false };
}

/** Defensive rating proxy from the previous season's points allowed. */
function computeDefRatings(games: Game[]): Record<string, number> {
  const allowed = Object.fromEntries(TEAMS.map((team) => [team.id, { points: 0, games: 0 }]));
  for (const game of games) {
    if (game.homeScore === null || game.awayScore === null || game.status !== "final") continue;
    allowed[game.homeTeamId].points += game.awayScore;
    allowed[game.homeTeamId].games += 1;
    allowed[game.awayTeamId].points += game.homeScore;
    allowed[game.awayTeamId].games += 1;
  }
  const averages = Object.entries(allowed).map(([teamId, value]) => ({
    teamId,
    ppg: value.games > 0 ? value.points / value.games : 114,
  }));
  const league = averages.reduce((sum, item) => sum + item.ppg, 0) / Math.max(1, averages.length);
  return Object.fromEntries(averages.map((item) => [item.teamId, round(114 + (item.ppg - league), 1)]));
}

// ─── Live builder ───────────────────────────────────────────────────────────

function liveStatuses(): DataSourceStatus[] {
  const health = espnHealth();
  const lastOk = health.reduce((max, item) => Math.max(max, item.lastOk ?? 0), 0);
  const latencies = health.map((item) => item.latencyMs ?? 0).filter((value) => value > 0);
  const latency = latencies.length
    ? Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length)
    : null;
  const checked = new Date(lastOk || Date.now()).toISOString();

  return [
    {
      id: "espn-schedule",
      name: "ESPN · schedules & results",
      category: "schedule",
      configured: true,
      mode: "live",
      lastChecked: checked,
      latencyMs: latency,
      note: "All 30 team schedules (current + previous season), de-duplicated by event id. Cached for 10 minutes.",
    },
    {
      id: "espn-scores",
      name: "ESPN · live scoreboard",
      category: "scores",
      configured: true,
      mode: "live",
      lastChecked: checked,
      latencyMs: latency,
      note: "Scores, period and game clock for today's slate. Polled every 15 seconds.",
    },
    {
      id: "espn-injuries",
      name: "ESPN · injuries",
      category: "injuries",
      configured: true,
      mode: "live",
      lastChecked: checked,
      latencyMs: latency,
      note: "Team injury reports. Refreshed every 60 seconds; absence weighting is a coarse prior, not a lineup model.",
    },
    {
      id: "espn-rosters",
      name: "ESPN · rosters & player logs",
      category: "injuries",
      configured: true,
      mode: "live",
      lastChecked: checked,
      latencyMs: latency,
      note: "Real rosters cached for 60 minutes and per-game player logs for 10 minutes, fetched on demand.",
    },
    {
      id: "geo",
      name: "Static venue + airport coordinates",
      category: "geo",
      configured: true,
      mode: "estimated",
      lastChecked: checked,
      latencyMs: null,
      note: "Travel legs are great-circle estimates between airports derived from the real schedule. No flight tracking.",
    },
    {
      id: "model",
      name: "Elo + travel model",
      category: "derived",
      configured: true,
      mode: "estimated",
      lastChecked: checked,
      latencyMs: null,
      note: "Computed locally from real results, rest and travel. Backtested on the completed 2025-26 season.",
    },
  ];
}

function buildLiveAlerts(
  games: Game[],
  metrics: Record<string, TeamTravelMetrics>,
  schedules: Record<string, TeamSchedule>,
  injuries: InjuryStatus[],
  today: string,
): Alert[] {
  const alerts: Alert[] = [];
  const horizon = addDays(today, 7);

  for (const team of TEAMS) {
    const m = metrics[team.id];
    const schedule = schedules[team.id];

    const trip = schedule.trips.find((candidate) => candidate.status === "upcoming" && candidate.startDate <= horizon);
    if (trip) {
      alerts.push({
        id: `trip-${trip.id}`,
        kind: "road_trip",
        severity: trip.totalMiles > 4500 ? "watch" : "info",
        title: `${team.abbreviation} road trip starts ${trip.startDate}`,
        body: `${trip.cities.join(" → ")} · ${trip.totalMiles.toLocaleString()} mi · ${trip.timeZonesCrossed} time zones.`,
        teamId: team.id,
        date: trip.startDate,
        meta: meta("estimated", "ESPN schedule", "Trip derived from the real schedule."),
      });
    }

    if (m.fatigueIndex >= 65) {
      alerts.push({
        id: `fatigue-${team.id}`,
        kind: "fatigue",
        severity: m.fatigueIndex >= 80 ? "high" : "watch",
        title: `${team.abbreviation} fatigue index ${m.fatigueIndex}`,
        body: `${m.miles7.toLocaleString()} mi and ${m.backToBacks7} back-to-back${m.backToBacks7 === 1 ? "" : "s"} in the last 7 days.`,
        teamId: team.id,
        date: today,
        meta: meta("estimated", "computed from ESPN schedule"),
      });
    }

    const b2b = schedule.games.find(
      (game) => game.date > today && game.date <= horizon && restFor(game, schedule) === 0,
    );
    if (b2b) {
      alerts.push({
        id: `b2b-${team.id}-${b2b.id}`,
        kind: "back_to_back",
        severity: "info",
        title: `${team.abbreviation} back-to-back on ${b2b.date}`,
        body: `Second game in two nights${b2b.awayTeamId === team.id ? " on the road" : " at home"}.`,
        teamId: team.id,
        gameId: b2b.id,
        date: b2b.date,
        meta: meta("estimated", "ESPN schedule"),
      });
    }

    const out = injuries.filter((injury) => injury.teamId === team.id && injury.status === "out");
    const todayGame = games.find(
      (game) => game.date === today && (game.homeTeamId === team.id || game.awayTeamId === team.id),
    );
    if (out.length > 0 && todayGame) {
      alerts.push({
        id: `injury-${team.id}-${today}`,
        kind: "injury",
        severity: "watch",
        title: `${team.abbreviation}: ${out.length} player${out.length === 1 ? "" : "s"} out tonight`,
        body: out.slice(0, 3).map((injury) => injury.reason).join(" · "),
        teamId: team.id,
        gameId: todayGame.id,
        date: today,
        meta: meta("live", "ESPN injuries"),
      });
    }
  }

  return alerts.sort((a, b) => (a.date < b.date ? -1 : 1));
}

/**
 * Fit the margin model on a completed season so coefficients are estimated
 * rather than guessed. The 2024-25 season is used for fitting and 2025-26 for
 * the out-of-sample backtest.
 */
function fitCoefficients(
  games: Game[],
  schedules: Record<string, TeamSchedule>,
  seasonId: string,
): ModelCoefficients {
  if (games.length < 300) return DEFAULT_COEFFICIENTS;

  const state: EloState = {
    ratings: Object.fromEntries(TEAMS.map((team) => [team.id, seedElo(team.id)])),
    played: Object.fromEntries(TEAMS.map((team) => [team.id, 0])),
  };
  const rows: number[][] = [];
  const y: number[] = [];

  for (const game of games) {
    if (game.status !== "final" || game.homeScore === null || game.awayScore === null) continue;
    if (!schedules[game.homeTeamId] || !schedules[game.awayTeamId]) continue;

    const home = featuresOf(seasonId, game.homeTeamId, game.id);
    const away = featuresOf(seasonId, game.awayTeamId, game.id);
    const restDiff = Math.min(home.rest, 3) - Math.min(away.rest, 3);
    const b2bDiff = (away.b2b ? 1 : 0) - (home.b2b ? 1 : 0);
    const milesDiff = (away.miles7 - home.miles7) / 1000;
    const tzDiff = away.tz7 - home.tz7;
    const altitudeFlag = isAltitude(TEAM_BY_ID[game.homeTeamId]) ? (away.rest <= 1 ? 1 : 0.45) : 0;

    // No separate home-court column: with neutral games almost absent it is
    // collinear with the intercept. The intercept *is* the home advantage.
    rows.push([1, state.ratings[game.homeTeamId] - state.ratings[game.awayTeamId], restDiff, b2bDiff, milesDiff, tzDiff, altitudeFlag]);
    y.push(game.homeScore - game.awayScore);
    eloUpdate(state, game, game.homeScore, game.awayScore);
  }

  if (rows.length < 300) return DEFAULT_COEFFICIENTS;
  const fit = ols(rows, y);
  if (!fit || !fit.beta.every((value) => Number.isFinite(value))) {
    console.warn(`[model] coefficient fit failed (rows=${rows.length})`);
    return DEFAULT_COEFFICIENTS;
  }

  const [homeCourt, elo, rest, b2b, miles, tz, altitude] = fit.beta;
  console.info(`[model] fitted on ${rows.length} games:`, fit.beta.map((v) => v.toFixed(4)).join(", "));
  if (Math.abs(elo) < 0.005 || Math.abs(elo) > 0.12 || Math.abs(homeCourt) > 8) {
    console.warn(`[model] fit rejected (elo=${elo.toFixed(4)}, home=${homeCourt.toFixed(2)})`);
    return DEFAULT_COEFFICIENTS;
  }

  return {
    intercept: 0,
    elo: round(clamp(elo, 0.005, 0.12), 4),
    home: round(clamp(homeCourt, -1, 6), 2),
    // Sign constraints: travel/rest can only plausibly hurt the travelling
    // team. A negative fit is treated as "no measurable effect" (0).
    rest: round(clamp(rest, 0, 3), 2),
    b2b: round(clamp(b2b, 0, 5), 2),
    miles: round(clamp(miles, 0, 1.5), 3),
    tz: round(clamp(tz, 0, 2), 2),
    altitude: round(clamp(altitude, 0, 5), 2),
    injury: DEFAULT_COEFFICIENTS.injury,
  };
}

async function buildLiveDataset(now: Date): Promise<AppDataset> {
  const today = todayISO(now);
  const config = seasonConfig(now);

  let currentSeason = config.current;
  let previousSeason = config.previous;
  let fitSeason = config.fit;

  let currentRaw = await fetchSeasonSchedule(currentSeason).catch(() => []);
  let previousRaw = await fetchSeasonSchedule(previousSeason).catch(() => []);
  let fitRaw = await fetchSeasonSchedule(fitSeason).catch(() => []);

  // Offseason / schedule not published yet: fall back one season so the app
  // still shows the completed season instead of dropping into mock mode.
  let offseason = false;
  if (currentRaw.length < 30) {
    offseason = true;
    currentSeason = config.previous;
    previousSeason = config.fit;
    fitSeason = seasonId(espnYearFor(config.fit) - 1);
    [currentRaw, previousRaw, fitRaw] = await Promise.all([
      fetchSeasonSchedule(currentSeason).catch(() => []),
      fetchSeasonSchedule(previousSeason).catch(() => []),
      fetchSeasonSchedule(fitSeason).catch(() => []),
    ]);
  }

  const [injuries, board] = await Promise.all([
    fetchInjuries().catch(() => []),
    fetchScoreboard(today).catch(() => new Map()),
  ]);

  if (currentRaw.length < 30) {
    throw new Error(`incomplete schedule (${currentRaw.length} games)`);
  }

  const applyLive = (game: Game): Game => {
    const patch = board.get(game.id);
    if (!patch) return game;
    return {
      ...game,
      status: patch.status,
      homeScore: patch.homeScore,
      awayScore: patch.awayScore,
      period: patch.period,
      clock: patch.clock,
    };
  };

  const currentGames = sortByTipoff(currentRaw.map(applyLive));
  const previousGames = sortByTipoff(previousRaw);
  const allGames = [...previousGames, ...currentGames];

  const schedules: Record<string, TeamSchedule> = {};
  const history: Record<string, Record<string, TeamSchedule>> = {
    [currentSeason]: {},
    [previousSeason]: {},
  };
  const metrics: Record<string, TeamTravelMetrics> = {};

  for (const team of TEAMS) {
    const current = buildTeamSchedule(team.id, currentGames, now);
    const previous = buildTeamSchedule(team.id, previousGames, now);
    schedules[team.id] = current;
    history[currentSeason][team.id] = current;
    history[previousSeason][team.id] = previous;
    metrics[team.id] = buildTeamMetrics({
      team,
      schedule: current,
      allGames: currentGames,
      today,
      // Live feed has no cheap per-player minutes: omit rather than invent.
      minutesLoad: undefined,
    });
  }

  registerFeatureMaps(currentSeason, schedules);
  registerFeatureMaps(previousSeason, history[previousSeason]);

  const fitGames = sortByTipoff(fitRaw);
  let coefficients = DEFAULT_COEFFICIENTS;
  if (fitGames.length > 500) {
    const fitSchedules: Record<string, TeamSchedule> = {};
    for (const team of TEAMS) {
      fitSchedules[team.id] = buildTeamSchedule(team.id, fitGames, now);
    }
    registerFeatureMaps(fitSeason, fitSchedules);
    coefficients = fitCoefficients(fitGames, fitSchedules, fitSeason);
  }

  const defRatings = computeDefRatings(previousGames);
  const eloBeforeToday = replayElo(allGames, today);
  const injuriesByTeam = new Map<string, InjuryStatus[]>();
  for (const injury of injuries) {
    injuriesByTeam.set(injury.teamId, [...(injuriesByTeam.get(injury.teamId) ?? []), injury]);
  }

  const predictions: Record<string, Prediction> = {};
  const modelMeta: DataMeta = {
    provenance: "estimated",
    source: "Elo + travel model · ESPN inputs",
    updatedAt: new Date().toISOString(),
    note: "Model output computed from live scores, rest, travel and injuries.",
  };
  for (const game of currentGames.filter((candidate) => candidate.date >= today)) {
    const homeFeature = featuresOf(currentSeason, game.homeTeamId, game.id);
    const awayFeature = featuresOf(currentSeason, game.awayTeamId, game.id);
    const homeInjuries = injuriesByTeam.get(game.homeTeamId) ?? [];
    const awayInjuries = injuriesByTeam.get(game.awayTeamId) ?? [];
    const features: GameFeatures = {
      homeRest: homeFeature.rest,
      awayRest: awayFeature.rest,
      homeB2B: homeFeature.b2b,
      awayB2B: awayFeature.b2b,
      homeMiles7: homeFeature.miles7,
      awayMiles7: awayFeature.miles7,
      homeTimeZones7: homeFeature.tz7,
      awayTimeZones7: awayFeature.tz7,
      homeInjuryPoints: injuryPoints(homeInjuries),
      awayInjuryPoints: injuryPoints(awayInjuries),
      homeAltitude: isAltitude(TEAM_BY_ID[game.homeTeamId]),
      neutral: game.venueType !== "team",
      homeGamesPlayed: eloBeforeToday.played[game.homeTeamId] ?? 0,
      awayGamesPlayed: eloBeforeToday.played[game.awayTeamId] ?? 0,
    };
    predictions[game.id] = {
      ...predictGame({
        game,
        home: TEAM_BY_ID[game.homeTeamId],
        away: TEAM_BY_ID[game.awayTeamId],
        homeElo: eloBeforeToday.ratings[game.homeTeamId],
        awayElo: eloBeforeToday.ratings[game.awayTeamId],
        features,
        coefficients,
      }),
      meta: modelMeta,
      modelVersion: LIVE_MODEL_VERSION,
    };
  }

  // Backtest on the completed previous season (no historical injury feed).
  const backtestState: EloState = {
    ratings: Object.fromEntries(TEAMS.map((team) => [team.id, seedElo(team.id)])),
    played: Object.fromEntries(TEAMS.map((team) => [team.id, 0])),
  };
  const records: PredictionRecord[] = [];

  for (const game of previousGames) {
    if (game.status !== "final" || game.homeScore === null || game.awayScore === null) continue;
    const homeFeature = featuresOf(previousSeason, game.homeTeamId, game.id);
    const awayFeature = featuresOf(previousSeason, game.awayTeamId, game.id);
    const prediction = predictGame({
      game,
      home: TEAM_BY_ID[game.homeTeamId],
      away: TEAM_BY_ID[game.awayTeamId],
      homeElo: backtestState.ratings[game.homeTeamId],
      awayElo: backtestState.ratings[game.awayTeamId],
      coefficients,
      features: {
        homeRest: homeFeature.rest,
        awayRest: awayFeature.rest,
        homeB2B: homeFeature.b2b,
        awayB2B: awayFeature.b2b,
        homeMiles7: homeFeature.miles7,
        awayMiles7: awayFeature.miles7,
        homeTimeZones7: homeFeature.tz7,
        awayTimeZones7: awayFeature.tz7,
        homeInjuryPoints: 0,
        awayInjuryPoints: 0,
        homeAltitude: isAltitude(TEAM_BY_ID[game.homeTeamId]),
        neutral: game.venueType !== "team",
        homeGamesPlayed: backtestState.played[game.homeTeamId] ?? 0,
        awayGamesPlayed: backtestState.played[game.awayTeamId] ?? 0,
      },
    });

    const homeWon = game.homeScore > game.awayScore;
    const outcome = homeWon ? 1 : 0;
    const p = prediction.homeWinProbability;
    const bp = prediction.baseline.homeWinProbability;
    const winner = homeWon ? game.homeTeamId : game.awayTeamId;

    records.push({
      prediction,
      actualHomeScore: game.homeScore,
      actualAwayScore: game.awayScore,
      homeWon,
      winnerCorrect: prediction.predictedWinnerId === winner,
      brier: round((p - outcome) ** 2, 4),
      logLoss: round(
        -(outcome * Math.log(clamp(p, 1e-6, 1 - 1e-6)) + (1 - outcome) * Math.log(clamp(1 - p, 1e-6, 1 - 1e-6))),
        4,
      ),
      baselineWinnerCorrect: prediction.baseline.predictedWinnerId === winner,
      baselineBrier: round((bp - outcome) ** 2, 4),
    });

    eloUpdate(backtestState, game, game.homeScore, game.awayScore);
  }

  const report = buildModelReport(records);
  report.modelVersion = LIVE_MODEL_VERSION;
  report.provenance = "estimated";
  report.windowStart = previousGames[0]?.date ?? "";
  report.windowEnd = previousGames[previousGames.length - 1]?.date ?? "";

  const alerts = buildLiveAlerts(currentGames, metrics, schedules, injuries, today);

  // Snapshot the next 48 hours of *pre-game* projections once, then grade them
  // after the games finish. Deduplicated by game + model version in the ledger.
  const gamesById = new Map(currentGames.map((game) => [game.id, game]));
  const ledgerEntries: LedgerEntry[] = Object.values(predictions)
    .filter((prediction) => {
      const game = gamesById.get(prediction.gameId);
      return (
        prediction.date >= today &&
        prediction.date <= addDays(today, 2) &&
        game?.status === "scheduled"
      );
    })
    .map((prediction) => ({
      gameId: prediction.gameId,
      date: prediction.date,
      capturedAt: new Date().toISOString(),
      homeWinProbability: prediction.homeWinProbability,
      predictedWinnerId: prediction.predictedWinnerId,
      projectedMargin: prediction.projectedMargin,
      modelVersion: prediction.modelVersion,
    }));
  await recordPredictions(ledgerEntries);
  const ledger = await ledgerReport(allGames);

  return {
    mode: "live",
    generatedAt: new Date().toISOString(),
    today,
    seasonId: currentSeason,
    previousSeasonId: previousSeason,
    fitSeasonId: fitSeason,
    offseason,
    games: allGames,
    schedules,
    history,
    metrics,
    predictions,
    records,
    report,
    ledger,
    alerts,
    injuries,
    defRatings,
    coefficients,
    status: liveStatuses(),
    meta: meta(
      "live",
      "ESPN public NBA API",
      `Season ${currentSeason}${offseason ? " (offseason view)" : ""} · schedules 10 min · injuries 60 s · scores 15 s. Travel remains an estimate.`,
    ),
  };
}

// ─── Mock wrapper ────────────────────────────────────────────────────────────

function fromMock(note?: string): AppDataset {
  const dataset = mock.getDataset();
  const injuries: InjuryStatus[] = [];
  return {
    mode: "mock",
    generatedAt: dataset.generatedAt,
    today: dataset.today,
    seasonId: dataset.seasonId,
    previousSeasonId: "2025-26",
    fitSeasonId: "2024-25",
    offseason: false,
    games: dataset.games,
    schedules: dataset.schedules,
    history: dataset.history,
    metrics: dataset.metrics,
    predictions: dataset.predictions,
    records: dataset.records,
    report: dataset.report,
    ledger: emptyLedger("Synthetic fallback: no live ledger."),
    alerts: dataset.alerts,
    injuries,
    defRatings: {},
    coefficients: DEFAULT_COEFFICIENTS,
    status: dataset.status,
    meta: {
      provenance: "mock",
      source: "synthetic engine (fallback)",
      updatedAt: dataset.generatedAt,
      note: note ?? "Synthetic fallback: no live provider data was available.",
    },
  };
}

export async function getDataset(now = new Date()): Promise<AppDataset> {
  if (datasetCache && datasetCache.expires > Date.now()) return datasetCache.data;
  if (pendingBuild) return pendingBuild;

  pendingBuild = (async () => {
    if (forceMock()) {
      const data = fromMock("FORCE_MOCK_DATA is enabled.");
      datasetCache = { data, expires: Date.now() + DATASET_TTL_MS };
      return data;
    }
    try {
      const data = await buildLiveDataset(now);
      datasetCache = { data, expires: Date.now() + DATASET_TTL_MS };
      return data;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[data] live refresh failed:", message);
      const data = fromMock(`Live refresh failed (${message}). Showing the synthetic fallback.`);
      datasetCache = { data, expires: Date.now() + DATASET_TTL_MS };
      return data;
    } finally {
      pendingBuild = null;
    }
  })();

  return pendingBuild;
}

// ─── Query helpers ──────────────────────────────────────────────────────────

export interface RosterSummary {
  player: Player;
  impact: PlayerTravelImpact | null;
}

export interface TeamDetail {
  mode: DatasetMode;
  team: Team;
  metrics: TeamTravelMetrics;
  schedule: TeamSchedule;
  record: TeamRecord;
  home: TeamRecord;
  away: TeamRecord;
  splits: ReturnType<typeof buildTeamSplits>;
  trips: RoadTrip[];
  upcoming: Game[];
  recent: Game[];
  roster: Player[];
  rosterSummaries: RosterSummary[];
  trend: { date: string; fatigue: number; miles: number }[];
  predictions: Prediction[];
  meta: DataMeta;
}

function buildFatigueTrend(schedule: TeamSchedule, today: string) {
  const points: { date: string; fatigue: number; miles: number }[] = [];
  for (let offset = 13; offset >= -7; offset -= 1) {
    const date = addDays(today, -offset);
    const window7 = travelInWindow(schedule.legs, date, 7);
    const window14 = travelInWindow(schedule.legs, date, 14);
    const recent = schedule.games.filter((game) => game.date <= date && diffDays(date, game.date) < 7);
    const b2b = recent.reduce((sum, game, index) => {
      if (index === 0) return sum;
      return sum + (diffDays(game.date, recent[index - 1].date) === 1 ? 1 : 0);
    }, 0);
    const altitude = recent.filter((game) => isAltitude(TEAM_BY_ID[game.homeTeamId])).length;
    const prior = schedule.games.filter((game) => game.date < date);
    const last = prior[prior.length - 1];
    const restDays = last ? Math.max(0, diffDays(date, last.date) - 1) : 3;
    const { index } = computeFatigueIndex({
      miles7: window7.miles,
      miles14: window14.miles,
      timeZones7: window7.timeZones,
      backToBacks7: b2b,
      restDays,
      altitudeGames7: altitude,
      games7: recent.length,
      minutesLoad: undefined,
    });
    points.push({ date, fatigue: index, miles: Math.round(window7.miles) });
  }
  return points;
}

export async function getTeamDetail(teamId: string, now = new Date()): Promise<TeamDetail | null> {
  const ds = await getDataset(now);
  const team = TEAM_BY_ID[teamId];
  if (!team) return null;

  if (ds.mode === "mock") {
    const detail = mock.getTeamDetail(teamId, now);
    if (!detail) return null;
    return {
      ...detail,
      mode: "mock",
      rosterSummaries: detail.rosterSummaries,
      meta: detail.meta,
    };
  }

  const schedule = ds.schedules[teamId];
  const metrics = ds.metrics[teamId];
  const teamGames = ds.games.filter(
    (game) => game.seasonId === ds.seasonId && (game.homeTeamId === teamId || game.awayTeamId === teamId),
  );
  const finals = teamGames.filter((game) => game.status === "final");

  const restByGame = new Map<string, number>();
  const b2b = new Set<string>();
  const altitude = new Set<string>();
  for (const game of teamGames) {
    const rest = restFor(game, schedule);
    restByGame.set(game.id, rest);
    if (rest === 0) b2b.add(game.id);
    if (isAltitude(TEAM_BY_ID[game.homeTeamId])) altitude.add(game.id);
  }

  const roster = await fetchRoster(teamId).catch(() => []);
  const upcoming = teamGames.filter((game) => game.date >= ds.today && game.status !== "postponed").slice(0, 6);

  return {
    mode: "live",
    team,
    metrics,
    schedule,
    record: summarizeGames(teamId, finals),
    home: homeRecord(teamId, finals),
    away: awayRecord(teamId, finals),
    splits: buildTeamSplits(teamId, teamGames, restByGame, b2b, altitude),
    trips: schedule.trips,
    upcoming,
    recent: finals.slice(-10).reverse(),
    roster,
    rosterSummaries: roster.map((player) => ({ player, impact: null })),
    trend: buildFatigueTrend(schedule, ds.today),
    predictions: upcoming.map((game) => ds.predictions[game.id]).filter(Boolean),
    meta: meta("live", "ESPN schedule + computed metrics"),
  };
}

export async function getTeamMetrics(teamId: string, now = new Date()): Promise<TeamTravelMetrics | undefined> {
  const ds = await getDataset(now);
  return ds.metrics[teamId];
}

export async function getTeamSchedule(teamId: string, now = new Date()): Promise<TeamSchedule | undefined> {
  const ds = await getDataset(now);
  return ds.schedules[teamId];
}

export async function getPrediction(gameId: string, now = new Date()): Promise<Prediction | undefined> {
  const ds = await getDataset(now);
  return ds.predictions[gameId];
}

export async function getTeamUpcoming(teamId: string, now = new Date(), limit = 5): Promise<Game[]> {
  const ds = await getDataset(now);
  return ds.games
    .filter(
      (game) =>
        game.seasonId === ds.seasonId &&
        (game.homeTeamId === teamId || game.awayTeamId === teamId) &&
        game.date >= ds.today &&
        game.status !== "postponed",
    )
    .slice(0, limit);
}

export async function getTeamRecent(teamId: string, now = new Date(), limit = 10): Promise<Game[]> {
  const ds = await getDataset(now);
  return ds.games
    .filter(
      (game) =>
        game.seasonId === ds.seasonId &&
        (game.homeTeamId === teamId || game.awayTeamId === teamId) &&
        game.status === "final",
    )
    .slice(-limit)
    .reverse();
}

export async function getTeamTravel(teamId: string, now = new Date()) {
  const ds = await getDataset(now);
  const schedule = ds.schedules[teamId];
  if (!schedule) return null;
  return {
    metrics: ds.metrics[teamId],
    schedule,
    trips: schedule.trips,
    legs: schedule.legs,
    meta: meta("estimated", "ESPN schedule", "Flights are estimated from schedule city changes."),
  };
}

export async function getTodaySnapshot(now = new Date()) {
  const ds = await getDataset(now);
  const todayGames = ds.games.filter((game) => game.seasonId === ds.seasonId && game.date === ds.today);
  return {
    todayGames,
    live: todayGames.filter((game) => game.status === "live"),
    upcoming: ds.games.filter((game) => game.date > ds.today).slice(0, 12),
    activeTrips: Object.values(ds.metrics)
      .map((metrics) => metrics.trip)
      .filter((trip): trip is RoadTrip => Boolean(trip) && trip!.status === "active"),
    travelling: Object.values(ds.metrics).filter((metric) =>
      ["traveling", "road_trip", "back_to_back"].includes(metric.status),
    ),
    metrics: ds.metrics,
    report: ds.report,
    alerts: ds.alerts,
    meta: ds.meta,
  };
}

export async function getGameDetail(gameId: string, now = new Date()) {
  const ds = await getDataset(now);
  if (ds.mode === "mock") {
    const detail = mock.getGameDetail(gameId, now);
    return detail ? { ...detail, mode: "mock" as const } : null;
  }

  const game = ds.games.find((candidate) => candidate.id === gameId);
  if (!game) return null;
  const home = TEAM_BY_ID[game.homeTeamId];
  const away = TEAM_BY_ID[game.awayTeamId];
  const homeInjuries = ds.injuries.filter((injury) => injury.teamId === game.homeTeamId);
  const awayInjuries = ds.injuries.filter((injury) => injury.teamId === game.awayTeamId);

  return {
    mode: "live" as const,
    game,
    home,
    away,
    homeMetrics: ds.metrics[game.homeTeamId],
    awayMetrics: ds.metrics[game.awayTeamId],
    prediction: ds.predictions[game.id],
    homeInjuries,
    awayInjuries,
    meta: meta("live", "ESPN schedule, injuries and scores"),
  };
}

export async function getPredictionsForDate(date: string, now = new Date()) {
  const ds = await getDataset(now);
  if (ds.mode === "mock") {
    const payload = mock.getPredictionsForDate(date, now);
    return { ...payload, mode: "mock" as const, ledger: emptyLedger("Synthetic fallback: no live ledger.") };
  }
  const games = ds.games.filter((game) => game.date === date && game.seasonId === ds.seasonId);
  return {
    mode: "live" as const,
    date,
    games,
    predictions: games.map((game) => ds.predictions[game.id]).filter((prediction): prediction is Prediction => Boolean(prediction)),
    report: ds.report,
    ledger: ds.ledger,
    meta: ds.meta,
  };
}

export async function getMapData(date: string, teamFilter?: string, now = new Date()) {
  const ds = await getDataset(now);
  if (ds.mode === "mock") {
    const payload = mock.getMapData(date, teamFilter, now);
    return { ...payload, mode: "mock" as const };
  }

  const windowEnd = addDays(date, 2);
  const teams = TEAMS.filter((team) => !teamFilter || team.id === teamFilter);
  const trips: Array<{
    teamId: string;
    trip: RoadTrip;
    prediction: Prediction | null;
    game: Game | null;
  }> = [];

  for (const team of teams) {
    const schedule = ds.schedules[team.id];
    for (const trip of schedule.trips) {
      const overlaps = trip.startDate <= windowEnd && trip.endDate >= date;
      const upcoming = trip.startDate > date && trip.startDate <= addDays(date, 9);
      if (!overlaps && !upcoming) continue;
      const lastGameId = trip.gameIds[trip.gameIds.length - 1];
      trips.push({
        teamId: team.id,
        trip,
        prediction: ds.predictions[lastGameId] ?? null,
        game: ds.games.find((game) => game.id === lastGameId) ?? null,
      });
    }
  }

  return {
    mode: "live" as const,
    date,
    teams: teams.map((team) => ({
      team,
      metrics: ds.metrics[team.id],
      nextGame: ds.metrics[team.id].nextGame,
    })),
    trips,
    meta: meta("estimated", "ESPN schedule", "Routes are great-circle estimates between airport coordinates."),
  };
}

export async function getStatus(now = new Date()) {
  const ds = await getDataset(now);
  return {
    mode: ds.mode,
    status: ds.status,
    report: ds.report,
    ledger: ds.ledger,
    coefficients: ds.coefficients,
    season: {
      current: ds.seasonId,
      previous: ds.previousSeasonId,
      fit: ds.fitSeasonId,
      offseason: ds.offseason,
    },
    generatedAt: ds.generatedAt,
    today: ds.today,
    counts: {
      games: ds.games.length,
      teams: TEAMS.length,
      players: ds.mode === "live" ? 0 : 300,
      predictions: Object.keys(ds.predictions).length,
      records: ds.records.length,
    },
    meta: ds.meta,
  };
}

export function getPlayerOptions(now = new Date()): { id: string; name: string; teamId: string }[] {
  void now;
  return [];
}

// ─── Player impact from real logs ───────────────────────────────────────────

export interface PlayerDetail {
  mode: DatasetMode;
  player: Player;
  team: Team;
  impact: PlayerTravelImpact;
  logs: PlayerGameLog[];
  recentLogs: PlayerGameLog[];
  seasonId: string;
  seasons: { id: string; label: string; start: string; end: string; note: string }[];
  meta: DataMeta;
}

function seasonOf(seasonParam: string, ds: AppDataset): string {
  if (seasonParam === "current") return ds.seasonId;
  if (seasonParam === "previous") return ds.previousSeasonId;
  return seasonParam;
}

function rawToLogs(raw: RawGamelog[], ds: AppDataset): PlayerGameLog[] {
  const logs: PlayerGameLog[] = [];
  for (const item of raw) {
    if (!item.teamId) continue;
    for (const seasonId of [ds.seasonId, ds.previousSeasonId]) {
      const schedule = ds.history[seasonId]?.[item.teamId];
      if (!schedule) continue;
      const game = schedule.games.find((candidate) => candidate.id === item.eventId);
      if (!game) continue;
      const feature = featuresOf(seasonId, item.teamId, game.id);
      const home = game.homeTeamId === item.teamId;
      const opponentId = home ? game.awayTeamId : game.homeTeamId;
      logs.push({
        gameId: game.id,
        date: game.date,
        seasonId,
        opponentId,
        home,
        minutes: item.minutes,
        points: item.points,
        rebounds: item.rebounds,
        assists: item.assists,
        fgPct: item.fgPct ?? 0,
        fg3Pct: item.fg3Pct ?? 0,
        turnovers: item.turnovers,
        plusMinus: 0,
        restDays: feature.rest,
        backToBack: feature.b2b,
        miles7: Math.round(feature.miles7),
        timeZones7: feature.tz7,
        altitudeGame: isAltitude(TEAM_BY_ID[game.homeTeamId]),
        opponentDefRating: ds.defRatings[opponentId] ?? 114,
        available: true,
      });
      break;
    }
  }
  return logs;
}

export async function getPlayerDetail(
  playerId: string,
  seasonParam = "all",
  now = new Date(),
): Promise<PlayerDetail | null> {
  const ds = await getDataset(now);
  if (ds.mode === "mock") {
    const detail = mock.getPlayerDetail(playerId, seasonParam, now);
    return detail ? { ...detail, mode: "mock" as const } : null;
  }

  const { logs: raw, teamIds, fetchedAt } = await fetchPlayerHistory(playerId, {
    current: ds.seasonId,
    previous: ds.previousSeasonId,
  });
  if (teamIds.length === 0) return null;

  let player: Player | undefined;
  for (const candidateTeam of teamIds) {
    const roster = await fetchRoster(candidateTeam).catch(() => []);
    player = roster.find((candidate) => candidate.id === playerId);
    if (player) break;
  }
  if (!player) return null;

  const logs = rawToLogs(raw, ds);
  const prior = logs.filter((log) => log.seasonId === ds.previousSeasonId);
  const sample = prior.length > 0 ? prior : logs;
  if (sample.length > 0) {
    const minutes = sample.reduce((sum, log) => sum + log.minutes, 0) / sample.length;
    const points = sample.reduce((sum, log) => sum + log.points, 0) / sample.length;
    player = {
      ...player,
      minutesPerGame: round(minutes, 1),
      pointsPer36: minutes > 0 ? round((points / minutes) * 36, 1) : 0,
      statsKnown: true,
    };
  }

  const seasonId = seasonOf(seasonParam, ds);
  const impact = buildPlayerImpact(player, logs, { seasonId });

  if (impact.model) {
    impact.model.note =
      "OLS on real ESPN game logs. Coefficients describe association, not causation — injuries, matchups and load management are unobserved.";
  }
  impact.caveats = [
    "Correlation is not causation: travel co-varies with opponent quality, injuries and load management.",
    "Splits under n=8 are shown for transparency but are not interpretable.",
    "Plus-minus is not available from the public game-log feed and is shown as —.",
    "Availability states come from the provider's report; absences are not reconstructed per game.",
  ];

  const recentLogs = logs
    .filter((log) => log.available)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .slice(-8)
    .reverse();

  return {
    mode: "live",
    player,
    team: TEAM_BY_ID[player.teamId],
    impact,
    logs,
    recentLogs,
    seasonId,
    seasons: [
      { id: ds.seasonId, label: ds.seasonId, start: "", end: "", note: "Current season" },
      { id: ds.previousSeasonId, label: ds.previousSeasonId, start: "", end: "", note: "Previous season" },
    ],
    meta: {
      ...meta(
        "estimated",
        "ESPN game logs + computed travel",
        "Real per-game stats, cached up to 10 minutes; travel conditions are schedule-derived.",
      ),
      // Report the age of the box-score payload, not the render time.
      updatedAt: new Date(Number.isFinite(fetchedAt) ? fetchedAt : Date.now()).toISOString(),
    },
  };
}
