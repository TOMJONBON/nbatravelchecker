import { TEAMS, TEAM_BY_ID, isAltitude } from "./teams";
import { PLAYERS, playersByTeam, rosterMinutesLoad } from "./players";
import {
  buildSeasonGames,
  CURRENT_SEASON_ID,
  PREVIOUS_SEASON_ID,
  SEASONS,
  seedElo,
  type SimulatedGame,
} from "./schedule";
import { buildTeamSchedule, travelInWindow, type TeamSchedule } from "./travel";
import { buildTeamMetrics, computeFatigueIndex, type FatigueBand } from "./fatigue";
import { awayRecord, buildTeamSplits, homeRecord, summarizeGames } from "./stats";
import {
  applyEloFromGames,
  buildModelReport,
  type ModelReportBundle,
} from "./model";
import { predictGame, type GameFeatures } from "./predictions";
import { injuriesForGame, injuryImpact } from "./injuries";
import { buildPlayerImpact, generatePlayerLogs, MIN_SPLIT_SAMPLE } from "./player-impact";
import { addDays, diffDays, todayISO } from "./time";
import { clamp, round } from "./rand";
import { providerStatuses } from "./providers";
import type { MapPayload, MapTrip } from "./map";
import type {
  Alert,
  DataMeta,
  Game,
  Player,
  PlayerTravelImpact,
  Prediction,
  PredictionRecord,
  RoadTrip,
  Team,
  TeamTravelMetrics,
} from "./types";

export const DATA_SOURCE = "synthetic schedule + Elo engine";

export interface Dataset {
  generatedAt: string;
  today: string;
  seasonId: string;
  games: Game[];
  schedules: Record<string, TeamSchedule>;
  /** Per-season schedules, retained for player game logs. */
  history: Record<string, Record<string, TeamSchedule>>;
  metrics: Record<string, TeamTravelMetrics>;
  predictions: Record<string, Prediction>;
  records: PredictionRecord[];
  report: ModelReportBundle;
  alerts: Alert[];
  status: ReturnType<typeof providerStatuses>;
}

const scheduleCache = new Map<string, SimulatedGame[]>();

function cachedSeasonGames(seasonId: string, today: string): SimulatedGame[] {
  const horizon = seasonId === CURRENT_SEASON_ID ? addDays(today, 21) : "";
  const key = `${seasonId}:${horizon}`;
  const hit = scheduleCache.get(key);
  if (hit) return hit;
  const games = buildSeasonGames(seasonId, new Date(`${today}T12:00:00Z`));
  scheduleCache.set(key, games);
  return games;
}

function resolveStatus(game: SimulatedGame, today: string, now: Date): Game {
  const { result, ...rest } = game;
  const tipoff = new Date(game.tipoff);
  const minutesSince = (now.getTime() - tipoff.getTime()) / 60000;

  if (game.status === "postponed") {
    return { ...rest, status: "postponed", homeScore: null, awayScore: null, period: null, clock: null };
  }

  if (game.date < today || minutesSince >= 165) {
    return {
      ...rest,
      status: "final",
      homeScore: result?.home ?? null,
      awayScore: result?.away ?? null,
      period: "Final",
      clock: null,
    };
  }

  if (game.date === today && minutesSince > 0) {
    const progress = clamp(minutesSince / 150, 0.03, 0.97);
    const home = result ? Math.round(result.home * progress) : 0;
    const away = result ? Math.round(result.away * progress) : 0;
    const quarter = Math.min(4, Math.floor(minutesSince / 34) + 1);
    const clockMinutes = Math.max(0, 12 - ((minutesSince % 34) / 34) * 12);
    return {
      ...rest,
      status: "live",
      homeScore: home,
      awayScore: away,
      period: `Q${quarter}`,
      clock: `${Math.floor(clockMinutes)}:${String(Math.floor((clockMinutes % 1) * 60)).padStart(2, "0")}`,
    };
  }

  return { ...rest, status: "scheduled", homeScore: null, awayScore: null, period: null, clock: null };
}

function meta(provenance: DataMeta["provenance"], note?: string): DataMeta {
  return {
    provenance,
    source: DATA_SOURCE,
    updatedAt: new Date().toISOString(),
    note,
  };
}

export function resolveGameList(now = new Date()): Game[] {
  const today = todayISO(now);
  const games = [
    ...cachedSeasonGames(PREVIOUS_SEASON_ID, today),
    ...cachedSeasonGames(CURRENT_SEASON_ID, today),
  ];
  return games
    .map((g) => resolveStatus(g, today, now))
    .sort((a, b) => (a.tipoff < b.tipoff ? -1 : a.tipoff > b.tipoff ? 1 : 0));
}

/** Elo replay up to (but excluding) a date, or including finals through it. */
function replayElo(games: Game[], beforeDate: string, includeDate = false) {
  const state = {
    ratings: Object.fromEntries(TEAMS.map((t) => [t.id, seedElo(t.id)])) as Record<string, number>,
    played: Object.fromEntries(TEAMS.map((t) => [t.id, 0])) as Record<string, number>,
  };
  for (const game of games) {
    if (game.status !== "final" || game.homeScore === null || game.awayScore === null) continue;
    const inRange = includeDate ? game.date <= beforeDate : game.date < beforeDate;
    if (!inRange) continue;
    applyEloFromGames(state, game);
  }
  return state;
}

const datasetCache = new Map<string, Dataset>();

/** Cached per minute so live scores tick without rebuilding the season. */
export function getDataset(now = new Date()): Dataset {
  const bucket = Math.floor(now.getTime() / 60_000).toString();
  const hit = datasetCache.get(bucket);
  if (hit) return hit;

  const today = todayISO(now);
  const games = resolveGameList(now);
  const currentGames = games.filter((game) => game.seasonId === CURRENT_SEASON_ID);
  const previousGames = games.filter((game) => game.seasonId === PREVIOUS_SEASON_ID);
  const schedules: Record<string, TeamSchedule> = {};
  const metrics: Record<string, TeamTravelMetrics> = {};
  const history: Record<string, Record<string, TeamSchedule>> = {
    [CURRENT_SEASON_ID]: {},
    [PREVIOUS_SEASON_ID]: {},
  };

  for (const team of TEAMS) {
    const schedule = buildTeamSchedule(team.id, currentGames, now);
    schedules[team.id] = schedule;
    history[CURRENT_SEASON_ID][team.id] = schedule;
    history[PREVIOUS_SEASON_ID][team.id] = buildTeamSchedule(team.id, previousGames, now);
    metrics[team.id] = buildTeamMetrics({
      team,
      schedule,
      allGames: currentGames,
      today,
      minutesLoad: rosterMinutesLoad(team.id),
    });
  }

  const eloBeforeToday = replayElo(games, today);
  const eloCurrent = replayElo(games, today, true);

  const predictions: Record<string, Prediction> = {};
  const records: PredictionRecord[] = [];

  const contextFor = (game: Game): { homeElo: number; awayElo: number; features: GameFeatures } => {
    const homeSchedule = schedules[game.homeTeamId];
    const awaySchedule = schedules[game.awayTeamId];
    const homeRest = restFor(game.homeTeamId, game, homeSchedule);
    const awayRest = restFor(game.awayTeamId, game, awaySchedule);
    const homeWindow = travelWindowSafe(homeSchedule, game.date);
    const awayWindow = travelWindowSafe(awaySchedule, game.date);
    const homeInjury = injuryImpact(game, game.homeTeamId, PLAYERS);
    const awayInjury = injuryImpact(game, game.awayTeamId, PLAYERS);

    return {
      homeElo: eloBeforeToday.ratings[game.homeTeamId],
      awayElo: eloBeforeToday.ratings[game.awayTeamId],
      features: {
        homeRest,
        awayRest,
        homeB2B: homeRest === 0,
        awayB2B: awayRest === 0,
        homeMiles7: homeWindow.miles,
        awayMiles7: awayWindow.miles,
        homeTimeZones7: homeWindow.zones,
        awayTimeZones7: awayWindow.zones,
        homeInjuryPoints: homeInjury.points,
        awayInjuryPoints: awayInjury.points,
        homeAltitude: isAltitude(TEAM_BY_ID[game.homeTeamId]),
        neutral: game.venueType !== "team",
        homeGamesPlayed: eloBeforeToday.played[game.homeTeamId],
        awayGamesPlayed: eloBeforeToday.played[game.awayTeamId],
      },
    };
  };

  // Upcoming + today's games use the pre-today rating snapshot.
  for (const game of games.filter((g) => g.date >= today)) {
    const ctx = contextFor(game);
    predictions[game.id] = predictGame({
      game,
      home: TEAM_BY_ID[game.homeTeamId],
      away: TEAM_BY_ID[game.awayTeamId],
      homeElo: ctx.homeElo,
      awayElo: ctx.awayElo,
      features: ctx.features,
    });
  }

  // Backtest: walk the current season chronologically, predicting pre-game.
  const backtestState = {
    ratings: Object.fromEntries(TEAMS.map((t) => [t.id, seedElo(t.id)])) as Record<string, number>,
    played: Object.fromEntries(TEAMS.map((t) => [t.id, 0])) as Record<string, number>,
  };

  for (const game of games) {
    if (game.date >= today) break;
    if (game.status !== "final" || game.homeScore === null || game.awayScore === null) continue;

    if (game.seasonId === CURRENT_SEASON_ID) {
      const homeSchedule = schedules[game.homeTeamId];
      const awaySchedule = schedules[game.awayTeamId];
      const homeRest = restFor(game.homeTeamId, game, homeSchedule);
      const awayRest = restFor(game.awayTeamId, game, awaySchedule);
      const homeWindow = travelWindowSafe(homeSchedule, game.date);
      const awayWindow = travelWindowSafe(awaySchedule, game.date);
      const homeInjury = injuryImpact(game, game.homeTeamId, PLAYERS);
      const awayInjury = injuryImpact(game, game.awayTeamId, PLAYERS);

      const prediction = predictGame({
        game,
        home: TEAM_BY_ID[game.homeTeamId],
        away: TEAM_BY_ID[game.awayTeamId],
        homeElo: backtestState.ratings[game.homeTeamId],
        awayElo: backtestState.ratings[game.awayTeamId],
        features: {
          homeRest,
          awayRest,
          homeB2B: homeRest === 0,
          awayB2B: awayRest === 0,
          homeMiles7: homeWindow.miles,
          awayMiles7: awayWindow.miles,
          homeTimeZones7: homeWindow.zones,
          awayTimeZones7: awayWindow.zones,
          homeInjuryPoints: homeInjury.points,
          awayInjuryPoints: awayInjury.points,
          homeAltitude: isAltitude(TEAM_BY_ID[game.homeTeamId]),
          neutral: game.venueType !== "team",
          homeGamesPlayed: backtestState.played[game.homeTeamId],
          awayGamesPlayed: backtestState.played[game.awayTeamId],
        },
      });

      const homeWon = game.homeScore > game.awayScore;
      const outcome = homeWon ? 1 : 0;
      const p = prediction.homeWinProbability;
      const bp = prediction.baseline.homeWinProbability;
      records.push({
        prediction,
        actualHomeScore: game.homeScore,
        actualAwayScore: game.awayScore,
        homeWon,
        winnerCorrect: (p >= 0.5 ? game.homeTeamId : game.awayTeamId) === (homeWon ? game.homeTeamId : game.awayTeamId),
        brier: round((p - outcome) ** 2, 4),
        logLoss: round(-(outcome * Math.log(clamp(p, 1e-6, 1 - 1e-6)) + (1 - outcome) * Math.log(clamp(1 - p, 1e-6, 1 - 1e-6))), 4),
        baselineWinnerCorrect:
          (bp >= 0.5 ? game.homeTeamId : game.awayTeamId) === (homeWon ? game.homeTeamId : game.awayTeamId),
        baselineBrier: round((bp - outcome) ** 2, 4),
      });
      predictions[game.id] = prediction;
    }

    applyEloFromGames(backtestState, game);
  }

  const report = buildModelReport(records);
  const alerts = buildAlerts(games, metrics, schedules, today);

  const dataset: Dataset = {
    generatedAt: new Date().toISOString(),
    today,
    seasonId: CURRENT_SEASON_ID,
    games,
    schedules,
    history,
    metrics,
    predictions,
    records,
    report,
    alerts,
    status: providerStatuses(),
  };

  datasetCache.clear();
  datasetCache.set(bucket, dataset);
  return dataset;
}

function restFor(teamId: string, game: Game, schedule: TeamSchedule): number {
  const prior = schedule.games.filter((g) => g.date < game.date && g.id !== game.id);
  const last = prior[prior.length - 1];
  if (!last) return 7;
  return Math.max(0, diffDays(game.date, last.date) - 1);
}

function travelWindowSafe(schedule: TeamSchedule, date: string): { miles: number; zones: number } {
  const window = travelInWindow(schedule.legs, date, 7);
  return { miles: window.miles, zones: window.timeZones };
}

function buildAlerts(
  games: Game[],
  metrics: Record<string, TeamTravelMetrics>,
  schedules: Record<string, TeamSchedule>,
  today: string,
): Alert[] {
  const alerts: Alert[] = [];
  const horizon = addDays(today, 7);

  for (const team of TEAMS) {
    const m = metrics[team.id];
    const schedule = schedules[team.id];

    const upcomingTrip = schedule.trips.find(
      (t) => t.status === "upcoming" && t.startDate <= horizon,
    );
    if (upcomingTrip) {
      alerts.push({
        id: `trip-${upcomingTrip.id}`,
        kind: "road_trip",
        severity: upcomingTrip.totalMiles > 4500 ? "watch" : "info",
        title: `${team.abbreviation} road trip starts ${upcomingTrip.startDate}`,
        body: `${upcomingTrip.cities.join(" → ")} · ${upcomingTrip.totalMiles.toLocaleString()} mi · ${upcomingTrip.timeZonesCrossed} time zones.`,
        teamId: team.id,
        date: upcomingTrip.startDate,
        meta: meta("estimated", "Road trips are derived from the schedule."),
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
        meta: meta("estimated"),
      });
    }

    const b2b = schedule.games.find(
      (g) => g.date > today && g.date <= horizon && restFor(team.id, g, schedule) === 0,
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
        meta: meta("estimated"),
      });
    }

    const todayGame = games.find(
      (g) => g.date === today && (g.homeTeamId === team.id || g.awayTeamId === team.id),
    );
    if (todayGame) {
      const injuries = injuriesForGame(todayGame, team.id, PLAYERS).filter((i) => i.status === "out");
      if (injuries.length > 0) {
        alerts.push({
          id: `injury-${team.id}-${todayGame.id}`,
          kind: "injury",
          severity: "watch",
          title: `${team.abbreviation}: ${injuries.length} player${injuries.length === 1 ? "" : "s"} out tonight`,
          body: injuries
            .map((i) => {
              const p = PLAYERS.find((pl) => pl.id === i.playerId);
              return `${p?.name ?? i.playerId} (${i.reason})`;
            })
            .join(" · "),
          teamId: team.id,
          gameId: todayGame.id,
          date: today,
          meta: meta("mock"),
        });
      }
    }
  }

  return alerts.sort((a, b) => (a.date < b.date ? -1 : 1));
}

// ─── Query helpers ───────────────────────────────────────────────────────────

export function getGamesOn(date: string, now = new Date()): Game[] {
  return getDataset(now).games.filter((g) => g.date === date);
}

export function getTeam(id: string): Team | undefined {
  return TEAM_BY_ID[id];
}

export function getTeamMetrics(id: string, now = new Date()): TeamTravelMetrics | undefined {
  return getDataset(now).metrics[id];
}

export function getTeamSchedule(id: string, now = new Date()): TeamSchedule | undefined {
  return getDataset(now).schedules[id];
}

export function getPrediction(gameId: string, now = new Date()): Prediction | undefined {
  return getDataset(now).predictions[gameId];
}

export function getTeamUpcoming(teamId: string, now = new Date(), limit = 5): Game[] {
  const ds = getDataset(now);
  return ds.games
    .filter(
      (g) =>
        g.seasonId === CURRENT_SEASON_ID &&
        (g.homeTeamId === teamId || g.awayTeamId === teamId) &&
        g.date >= ds.today &&
        g.status !== "postponed",
    )
    .slice(0, limit);
}

export function getTeamRecent(teamId: string, now = new Date(), limit = 10): Game[] {
  const ds = getDataset(now);
  return ds.games
    .filter(
      (g) =>
        g.seasonId === CURRENT_SEASON_ID &&
        (g.homeTeamId === teamId || g.awayTeamId === teamId) &&
        g.status === "final",
    )
    .slice(-limit)
    .reverse();
}

export function getTeamTravel(teamId: string, now = new Date()) {
  const ds = getDataset(now);
  const schedule = ds.schedules[teamId];
  return {
    metrics: ds.metrics[teamId],
    schedule,
    trips: schedule.trips,
    legs: schedule.legs,
    meta: meta("estimated", "Flights are estimated from schedule changes of city."),
  };
}

export function getTodaySnapshot(now = new Date()) {
  const ds = getDataset(now);
  const todayGames = ds.games.filter((g) => g.date === ds.today);
  const live = todayGames.filter((g) => g.status === "live");
  const upcoming = ds.games.filter((g) => g.date > ds.today).slice(0, 12);
  const activeTrips: RoadTrip[] = Object.values(ds.metrics)
    .map((m) => m.trip)
    .filter((t): t is RoadTrip => Boolean(t) && t!.status === "active");
  const travelling = Object.values(ds.metrics).filter((m) => m.status === "traveling" || m.status === "road_trip" || m.status === "back_to_back");

  return {
    todayGames,
    live,
    upcoming,
    activeTrips,
    travelling,
    metrics: ds.metrics,
    report: ds.report,
    alerts: ds.alerts,
    meta: meta("mock", "Synthetic schedule, scores and injury reports."),
  };
}

export function getTeamDetail(teamId: string, now = new Date()) {
  const ds = getDataset(now);
  const team = TEAM_BY_ID[teamId];
  if (!team) return null;
  const schedule = ds.schedules[teamId];
  const metrics = ds.metrics[teamId];
  const teamGames = ds.games.filter(
    (g) =>
      g.seasonId === CURRENT_SEASON_ID &&
      (g.homeTeamId === teamId || g.awayTeamId === teamId),
  );
  const finals = teamGames.filter((g) => g.status === "final");

  const restByGame = new Map<string, number>();
  const b2b = new Set<string>();
  const altitude = new Set<string>();
  for (const g of teamGames) {
    const rest = restFor(teamId, g, schedule);
    restByGame.set(g.id, rest);
    if (rest === 0) b2b.add(g.id);
    if (isAltitude(TEAM_BY_ID[g.homeTeamId])) altitude.add(g.id);
  }

  const splits = buildTeamSplits(teamId, teamGames, restByGame, b2b, altitude);
  const roster = playersByTeam(teamId);
  const previousGames = ds.games.filter(
    (g) =>
      g.seasonId === PREVIOUS_SEASON_ID &&
      (g.homeTeamId === teamId || g.awayTeamId === teamId),
  );
  const previousSchedule = ds.history[PREVIOUS_SEASON_ID][teamId];
  const rosterSummaries = roster.map((p) => {
    const logs = generatePlayerLogs(p, previousGames, previousSchedule.legs, ds.today);
    const impact = buildPlayerImpact(p, logs, { seasonId: PREVIOUS_SEASON_ID });
    return { player: p, impact };
  });

  const trend = buildFatigueTrend(teamId, schedule, ds.today);
  const upcoming = teamGames.filter((g) => g.date >= ds.today && g.status !== "postponed").slice(0, 6);

  return {
    team,
    metrics,
    schedule,
    record: summarizeGames(teamId, finals),
    home: homeRecord(teamId, finals),
    away: awayRecord(teamId, finals),
    splits,
    trips: schedule.trips,
    upcoming,
    recent: finals.slice(-10).reverse(),
    roster,
    rosterSummaries,
    trend,
    predictions: upcoming.map((g) => ds.predictions[g.id]).filter(Boolean),
    meta: meta("estimated"),
  };
}

function buildFatigueTrend(teamId: string, schedule: TeamSchedule, today: string) {
  const points: { date: string; fatigue: number; miles: number }[] = [];
  for (let i = 13; i >= -7; i -= 1) {
    const date = addDays(today, -i);
    const window7 = travelInWindow(schedule.legs, date, 7);
    const window14 = travelInWindow(schedule.legs, date, 14);
    const recent = schedule.games.filter((g) => g.date <= date && diffDays(date, g.date) < 7);
    const b2bCount = recent.reduce((sum, g, idx) => {
      if (idx === 0) return sum;
      return sum + (diffDays(g.date, recent[idx - 1].date) === 1 ? 1 : 0);
    }, 0);
    const altitudeGames = recent.filter((g) => isAltitude(TEAM_BY_ID[g.homeTeamId])).length;
    const priorGames = schedule.games.filter((g) => g.date < date);
    const last = priorGames[priorGames.length - 1];
    const restDays = last ? Math.max(0, diffDays(date, last.date) - 1) : 3;

    const { index } = computeFatigueIndex({
      miles7: window7.miles,
      miles14: window14.miles,
      timeZones7: window7.timeZones,
      backToBacks7: b2bCount,
      restDays,
      altitudeGames7: altitudeGames,
      games7: recent.length,
      minutesLoad: 0.55,
    });
    points.push({ date, fatigue: index, miles: Math.round(window7.miles) });
  }
  void teamId;
  return points;
}

const playerLogCache = new Map<string, ReturnType<typeof generatePlayerLogs>>();

export function getPlayerDetail(playerId: string, seasonId = "all", now = new Date()) {
  const ds = getDataset(now);
  const player = PLAYERS.find((p) => p.id === playerId);
  if (!player) return null;

  const cacheKey = `${playerId}:${ds.today}`;
  let logs = playerLogCache.get(cacheKey);
  if (!logs) {
    logs = SEASONS.flatMap((season) => {
      const seasonSchedule = ds.history[season.id]?.[player.teamId];
      if (!seasonSchedule) return [];
      const seasonGames = ds.games.filter(
        (g) =>
          g.seasonId === season.id &&
          (g.homeTeamId === player.teamId || g.awayTeamId === player.teamId),
      );
      return generatePlayerLogs(player, seasonGames, seasonSchedule.legs, ds.today);
    });
    playerLogCache.set(cacheKey, logs);
  }

  const effectiveSeason = seasonId === "current" ? ds.seasonId : seasonId === "previous" ? PREVIOUS_SEASON_ID : seasonId;
  const impact = buildPlayerImpact(player, logs, { seasonId: effectiveSeason });
  const team = TEAM_BY_ID[player.teamId];
  const recentLogs = logs.filter((l) => l.available).slice(-8).reverse();

  return {
    player,
    team,
    impact,
    logs,
    recentLogs,
    seasonId: effectiveSeason,
    seasons: SEASONS,
    meta: meta("mock", "Synthetic game logs; travel conditions are estimates."),
  };
}

export function getGameDetail(gameId: string, now = new Date()) {
  const ds = getDataset(now);
  const game = ds.games.find((g) => g.id === gameId);
  if (!game) return null;
  const home = TEAM_BY_ID[game.homeTeamId];
  const away = TEAM_BY_ID[game.awayTeamId];
  const homeMetrics = ds.metrics[game.homeTeamId];
  const awayMetrics = ds.metrics[game.awayTeamId];
  const prediction = ds.predictions[game.id];
  const homeInjuries = injuriesForGame(game, game.homeTeamId, PLAYERS);
  const awayInjuries = injuriesForGame(game, game.awayTeamId, PLAYERS);
  return {
    game,
    home,
    away,
    homeMetrics,
    awayMetrics,
    prediction,
    homeInjuries,
    awayInjuries,
    meta: meta("mock"),
  };
}

export function getPredictionsForDate(date: string, now = new Date()) {
  const ds = getDataset(now);
  const games = ds.games.filter((g) => g.date === date);
  return {
    date,
    games,
    predictions: games.map((g) => ds.predictions[g.id]).filter((p): p is Prediction => Boolean(p)),
    report: ds.report,
    meta: meta("mock"),
  };
}

export function getMapData(date: string, teamFilter?: string, now = new Date()): MapPayload {
  const ds = getDataset(now);
  const windowEnd = addDays(date, 2);
  const teams = TEAMS.filter((t) => !teamFilter || t.id === teamFilter);
  const trips: MapTrip[] = [];

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
        game: ds.games.find((g) => g.id === lastGameId) ?? null,
      });
    }
  }

  return {
    date,
    teams: teams.map((t) => ({
      team: t,
      metrics: ds.metrics[t.id],
      nextGame: ds.metrics[t.id].nextGame,
    })),
    trips,
    meta: meta("estimated", "Routes are great-circle estimates between airport coordinates."),
  };
}

export function getStatus() {
  const ds = getDataset();
  return {
    status: ds.status,
    report: ds.report,
    generatedAt: ds.generatedAt,
    today: ds.today,
    counts: {
      games: ds.games.length,
      teams: TEAMS.length,
      players: PLAYERS.length,
      predictions: Object.keys(ds.predictions).length,
      records: ds.records.length,
    },
    meta: meta("mock"),
  };
}

export function getPlayerOptions() {
  return PLAYERS.map((p) => ({ id: p.id, name: p.name, teamId: p.teamId }));
}

export { MIN_SPLIT_SAMPLE };
export type { Player, PlayerTravelImpact, FatigueBand };
