import { clamp, round } from "./rand";
import { TEAM_BY_ID } from "./teams";
import type {
  ConfidenceLabel,
  Game,
  Prediction,
  PredictionFactor,
  Team,
} from "./types";

/**
 * Transparent margin model.
 *
 *   margin = (EloHome - EloAway) / 25
 *          + homeCourt
 *          + rest differential
 *          + back-to-back penalties
 *          + travel (miles, time zones)
 *          + altitude
 *          + injury value
 *
 *   P(home win) = Phi(margin / 11.5)
 *
 * The Elo-only baseline is the same expression without rest/travel/injury terms.
 * Coefficients are hand-set from published NBA rest/travel research orders of
 * magnitude and are not fitted on real data in this demo.
 */
export const MODEL_VERSION = "v1.3-elo-fatigue";
export const HOME_COURT_POINTS = 2.9;
export const MARGIN_SIGMA = 11.5;
export const ELO_HOME_ADVANTAGE = 60;

export function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-ax * ax);
  return sign * y;
}

export function normalCdf(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

export function winProbabilityFromMargin(margin: number): number {
  return normalCdf(margin / MARGIN_SIGMA);
}

export interface GameFeatures {
  homeRest: number;
  awayRest: number;
  homeB2B: boolean;
  awayB2B: boolean;
  homeMiles7: number;
  awayMiles7: number;
  homeTimeZones7: number;
  awayTimeZones7: number;
  homeInjuryPoints: number;
  awayInjuryPoints: number;
  homeAltitude: boolean;
  neutral: boolean;
  homeGamesPlayed: number;
  awayGamesPlayed: number;
}

export interface ModelCoefficients {
  intercept: number;
  elo: number;
  home: number;
  rest: number;
  b2b: number;
  miles: number;
  tz: number;
  altitude: number;
  injury: number;
}

/** Hand-set defaults, used by the synthetic engine and when a fit is rejected. */
export const DEFAULT_COEFFICIENTS: ModelCoefficients = {
  intercept: 0,
  elo: 1 / 25,
  home: HOME_COURT_POINTS,
  rest: 0.85,
  b2b: 1.4,
  miles: 0.28,
  tz: 0.4,
  altitude: 1.1,
  injury: 0.55,
};

export interface ModelContext {
  game: Game;
  home: Team;
  away: Team;
  homeElo: number;
  awayElo: number;
  features: GameFeatures;
  /** Fitted on the previous season in live mode; defaults otherwise. */
  coefficients?: ModelCoefficients;
}

const CONFIDENCE_ORDER: ConfidenceLabel[] = ["low", "medium", "high"];

function downgrade(label: ConfidenceLabel): ConfidenceLabel {
  return CONFIDENCE_ORDER[Math.max(0, CONFIDENCE_ORDER.indexOf(label) - 1)];
}

export function projectScores(margin: number, homeElo: number, awayElo: number): {
  home: number;
  away: number;
  total: number;
} {
  const total = clamp(226.5 + (homeElo + awayElo - 3000) / 150, 205, 248);
  const home = Math.round(total / 2 + margin / 2);
  const away = Math.round(total / 2 - margin / 2);
  return { home, away, total };
}

export function predictGame(ctx: ModelContext): Prediction {
  const { game, home, away, features } = ctx;
  const coefficients = ctx.coefficients ?? DEFAULT_COEFFICIENTS;
  const eloMargin = (ctx.homeElo - ctx.awayElo) * coefficients.elo;
  const homeCourt = features.neutral ? 0 : coefficients.home;
  const restMargin = clamp(
    (Math.min(features.homeRest, 3) - Math.min(features.awayRest, 3)) * coefficients.rest,
    -3.5,
    3.5,
  );
  const b2bMargin = clamp(
    (features.awayB2B ? 1 : 0) * coefficients.b2b - (features.homeB2B ? 1 : 0) * coefficients.b2b,
    -4,
    4,
  );
  const milesMargin = clamp(
    ((features.awayMiles7 - features.homeMiles7) / 1000) * coefficients.miles,
    -3,
    3,
  );
  const tzMargin = clamp(
    (features.awayTimeZones7 - features.homeTimeZones7) * coefficients.tz,
    -2,
    2,
  );
  const altitudeMargin = features.homeAltitude
    ? coefficients.altitude * (features.awayRest <= 1 ? 1 : 0.45)
    : 0;
  const injuryMargin = clamp(
    (features.awayInjuryPoints - features.homeInjuryPoints) * coefficients.injury,
    -6,
    6,
  );

  const margin = round(
    coefficients.intercept +
      eloMargin +
      homeCourt +
      restMargin +
      b2bMargin +
      milesMargin +
      tzMargin +
      altitudeMargin +
      injuryMargin,
    1,
  );

  const homeWinProbability = clamp(winProbabilityFromMargin(margin), 0.02, 0.98);
  const scores = projectScores(margin, ctx.homeElo, ctx.awayElo);

  const unsorted: PredictionFactor[] = [
    {
      key: "elo",
      label: "Team strength (Elo)",
      impact: round(eloMargin, 1),
      detail: `${home.abbreviation} ${Math.round(ctx.homeElo)} vs ${away.abbreviation} ${Math.round(ctx.awayElo)}`,
      direction: eloMargin >= 0 ? "home" : "away",
    },
    {
      key: "home",
      label: features.neutral ? "Neutral site" : "Home court",
      impact: round(homeCourt, 1),
      detail: features.neutral
        ? "Neutral floor — no home-court term"
        : `${home.abbreviation} at ${home.arena.name}`,
      direction: homeCourt > 0 ? "home" : "neutral",
    },
    {
      key: "rest",
      label: "Rest differential",
      impact: round(restMargin, 1),
      detail: `${home.abbreviation} ${features.homeRest}d rest · ${away.abbreviation} ${features.awayRest}d rest`,
      direction: restMargin > 0 ? "home" : restMargin < 0 ? "away" : "neutral",
    },
    {
      key: "b2b",
      label: "Back-to-back",
      impact: round(b2bMargin, 1),
      detail:
        features.homeB2B || features.awayB2B
          ? [features.homeB2B ? `${home.abbreviation} on 0 days rest` : null, features.awayB2B ? `${away.abbreviation} on 0 days rest` : null]
              .filter(Boolean)
              .join(" · ")
          : "Neither team is on a back-to-back",
      direction: b2bMargin > 0 ? "home" : b2bMargin < 0 ? "away" : "neutral",
    },
    {
      key: "travel",
      label: "Travel load (7 days)",
      impact: round(milesMargin, 1),
      detail: `${away.abbreviation} ${Math.round(features.awayMiles7).toLocaleString()} mi · ${home.abbreviation} ${Math.round(features.homeMiles7).toLocaleString()} mi`,
      direction: milesMargin > 0 ? "home" : milesMargin < 0 ? "away" : "neutral",
    },
    {
      key: "timezones",
      label: "Time zones crossed",
      impact: round(tzMargin, 1),
      detail: `${away.abbreviation} ${features.awayTimeZones7} · ${home.abbreviation} ${features.homeTimeZones7} in the last 7 days`,
      direction: tzMargin > 0 ? "home" : tzMargin < 0 ? "away" : "neutral",
    },
    {
      key: "altitude",
      label: "Altitude",
      impact: round(altitudeMargin, 1),
      detail: features.homeAltitude
        ? `${home.arena.name} sits at ${home.arena.altitudeFt.toLocaleString()} ft`
        : "Sea-level venue",
      direction: altitudeMargin > 0 ? "home" : "neutral",
    },
    {
      key: "injuries",
      label: "Availability",
      impact: round(injuryMargin, 1),
      detail: `${away.abbreviation} −${features.awayInjuryPoints.toFixed(1)} pts · ${home.abbreviation} −${features.homeInjuryPoints.toFixed(1)} pts`,
      direction: injuryMargin > 0 ? "home" : injuryMargin < 0 ? "away" : "neutral",
    },
  ];

  const factors = unsorted.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));

  const edge = Math.abs(homeWinProbability - 0.5);
  const evidence = Math.min(features.homeGamesPlayed, features.awayGamesPlayed);
  let confidence: ConfidenceLabel = edge >= 0.2 ? "high" : edge >= 0.1 ? "medium" : "low";
  if (evidence < 8) confidence = "low";
  else if (evidence < 15 && confidence === "high") confidence = "medium";
  if (features.homeInjuryPoints > 6 || features.awayInjuryPoints > 6) confidence = downgrade(confidence);

  const baselineMargin = round(eloMargin + homeCourt, 1);
  const baselineProb = clamp(winProbabilityFromMargin(baselineMargin), 0.02, 0.98);

  const favourite = homeWinProbability >= 0.5 ? home : away;
  const confidenceReason =
    evidence < 8
      ? `Only ${evidence} games of evidence per team — wide uncertainty.`
      : `${Math.abs(homeWinProbability - 0.5) >= 0.2 ? "Large" : Math.abs(homeWinProbability - 0.5) >= 0.1 ? "Moderate" : "Small"} model edge · ${evidence}+ games of evidence · ${features.homeInjuryPoints + features.awayInjuryPoints > 4 ? "lineup uncertainty" : "stable rotations"}.`;

  return {
    gameId: game.id,
    date: game.date,
    homeTeamId: game.homeTeamId,
    awayTeamId: game.awayTeamId,
    predictedWinnerId: favourite.id,
    homeWinProbability: round(homeWinProbability, 3),
    projectedHomeScore: scores.home,
    projectedAwayScore: scores.away,
    projectedMargin: margin,
    confidence,
    confidenceReason,
    factors,
    baseline: {
      model: "Elo + home court (no fatigue terms)",
      homeWinProbability: round(baselineProb, 3),
      predictedWinnerId: baselineProb >= 0.5 ? home.id : away.id,
      projectedMargin: baselineMargin,
    },
    modelVersion: MODEL_VERSION,
    dataQuality: {
      gamesPlayedHome: features.homeGamesPlayed,
      gamesPlayedAway: features.awayGamesPlayed,
      injuriesKnown: true,
      note: "Projection uses synthetic schedule and injury data; treat as a demonstration, not betting advice.",
    },
    meta: {
      provenance: "mock",
      source: "synthetic Elo + fatigue model",
      updatedAt: new Date().toISOString(),
      note: "Probabilities come from a normal approximation around a projected margin.",
    },
  };
}

export function explainPrediction(prediction: Prediction): string {
  const winner = TEAM_BY_ID[prediction.predictedWinnerId];
  const top = prediction.factors.filter((f) => Math.abs(f.impact) >= 0.3).slice(0, 3);
  const parts = top.map((f) => `${f.label.toLowerCase()} ${f.impact > 0 ? "+" : ""}${f.impact.toFixed(1)}`);
  return `${winner?.nickname ?? "Home"} favoured at ${(prediction.homeWinProbability * 100).toFixed(0)}% home win probability. Largest terms: ${parts.join(", ")}.`;
}

export interface EloState {
  ratings: Record<string, number>;
  played: Record<string, number>;
}

export function eloUpdate(
  state: EloState,
  game: Game,
  homeScore: number,
  awayScore: number,
  k = 18,
): void {
  const homeElo = state.ratings[game.homeTeamId] ?? 1500;
  const awayElo = state.ratings[game.awayTeamId] ?? 1500;
  const expectedHome = 1 / (1 + 10 ** (-(homeElo + ELO_HOME_ADVANTAGE - awayElo) / 400));
  const actualHome = homeScore > awayScore ? 1 : 0;
  state.ratings[game.homeTeamId] = homeElo + k * (actualHome - expectedHome);
  state.ratings[game.awayTeamId] = awayElo - k * (actualHome - expectedHome);
  state.played[game.homeTeamId] = (state.played[game.homeTeamId] ?? 0) + 1;
  state.played[game.awayTeamId] = (state.played[game.awayTeamId] ?? 0) + 1;
}

export function brierScore(probability: number, outcome: number): number {
  return (probability - outcome) ** 2;
}

export function logLoss(probability: number, outcome: number): number {
  const p = clamp(probability, 1e-6, 1 - 1e-6);
  return -(outcome * Math.log(p) + (1 - outcome) * Math.log(1 - p));
}

export function calibrationBuckets(
  rows: { probability: number; outcome: number }[],
): { bucket: string; predicted: number; observed: number; count: number }[] {
  const buckets = Array.from({ length: 10 }, (_, i) => ({
    bucket: `${i * 10}-${i * 10 + 10}%`,
    predicted: 0,
    observed: 0,
    count: 0,
  }));
  for (const row of rows) {
    const idx = Math.min(9, Math.floor(row.probability * 10));
    const b = buckets[idx];
    b.count += 1;
    b.predicted += row.probability;
    b.observed += row.outcome;
  }
  return buckets
    .filter((b) => b.count > 0)
    .map((b) => ({
      bucket: b.bucket,
      predicted: round(b.predicted / b.count, 3),
      observed: round(b.observed / b.count, 3),
      count: b.count,
    }));
}
