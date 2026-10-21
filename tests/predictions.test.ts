import { describe, expect, it } from "vitest";
import {
  calibrationBuckets,
  eloUpdate,
  normalCdf,
  predictGame,
  projectScores,
  winProbabilityFromMargin,
  type GameFeatures,
} from "@/lib/predictions";
import { TEAM_BY_ID } from "@/lib/teams";
import type { Game } from "@/lib/types";

const home = TEAM_BY_ID.bos;
const away = TEAM_BY_ID.mia;

const game: Game = {
  id: "test-game",
  seasonId: "2026-27",
  date: "2026-10-21",
  tipoff: "2026-10-21T23:30:00.000Z",
  homeTeamId: home.id,
  awayTeamId: away.id,
  status: "scheduled",
  homeScore: null,
  awayScore: null,
  period: null,
  clock: null,
  venueType: "team",
  seasonType: "regular",
};

const NEUTRAL_FEATURES: GameFeatures = {
  homeRest: 2,
  awayRest: 2,
  homeB2B: false,
  awayB2B: false,
  homeMiles7: 0,
  awayMiles7: 0,
  homeTimeZones7: 0,
  awayTimeZones7: 0,
  homeInjuryPoints: 0,
  awayInjuryPoints: 0,
  homeAltitude: false,
  neutral: true,
  homeGamesPlayed: 20,
  awayGamesPlayed: 20,
};

function predict(features: Partial<GameFeatures>, homeElo = 1600, awayElo = 1600) {
  return predictGame({
    game,
    home,
    away,
    homeElo,
    awayElo,
    features: { ...NEUTRAL_FEATURES, ...features },
  });
}

describe("probability link", () => {
  it("is 0.5 at a zero margin", () => {
    expect(winProbabilityFromMargin(0)).toBeCloseTo(0.5, 6);
    expect(normalCdf(0)).toBeCloseTo(0.5, 6);
  });

  it("is symmetric and monotonic", () => {
    expect(winProbabilityFromMargin(-5)).toBeCloseTo(1 - winProbabilityFromMargin(5), 6);
    expect(winProbabilityFromMargin(10)).toBeGreaterThan(winProbabilityFromMargin(2));
  });
});

describe("prediction model", () => {
  it("returns an even game at a neutral site with equal ratings and no fatigue", () => {
    const prediction = predict({});
    expect(prediction.homeWinProbability).toBeCloseTo(0.5, 2);
    expect(prediction.projectedMargin).toBe(0);
  });

  it("adds home court at a normal venue", () => {
    const prediction = predict({ neutral: false });
    expect(prediction.homeWinProbability).toBeGreaterThan(0.55);
    const homeCourtFactor = prediction.factors.find((factor) => factor.key === "home");
    expect(homeCourtFactor?.impact).toBeGreaterThan(0);
  });

  it("penalises a road team on a back-to-back", () => {
    const rested = predict({});
    const b2b = predict({ awayB2B: true, awayRest: 0 });
    expect(b2b.homeWinProbability).toBeGreaterThan(rested.homeWinProbability);
  });

  it("penalises heavy recent travel and east-west zone shifts", () => {
    const baseline = predict({});
    const travelled = predict({ awayMiles7: 6000, awayTimeZones7: 3 });
    expect(travelled.homeWinProbability).toBeGreaterThan(baseline.homeWinProbability);
  });

  it("rewards the home team when the visitor is missing more value", () => {
    const baseline = predict({});
    const injured = predict({ awayInjuryPoints: 12, homeInjuryPoints: 1 });
    expect(injured.homeWinProbability).toBeGreaterThan(baseline.homeWinProbability);
  });

  it("never reports a probability outside 2-98%", () => {
    const extreme = predict({ homeInjuryPoints: 100, awayInjuryPoints: -100 }, 2400, 1200);
    expect(extreme.homeWinProbability).toBeLessThanOrEqual(0.98);
    expect(extreme.homeWinProbability).toBeGreaterThanOrEqual(0.02);
  });

  it("degrades confidence when the sample is small", () => {
    const thin = predict({ homeGamesPlayed: 3, awayGamesPlayed: 3 });
    expect(thin.confidence).toBe("low");
    expect(thin.confidenceReason).toContain("3");
  });

  it("always exposes a baseline and ranked factors", () => {
    const prediction = predict({ neutral: false });
    expect(prediction.baseline.model).toContain("Elo");
    expect(prediction.factors.length).toBeGreaterThanOrEqual(6);
    const sorted = [...prediction.factors].sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));
    expect(prediction.factors[0].key).toBe(sorted[0].key);
  });

  it("projects scores that reconcile with the margin", () => {
    const prediction = predict({ neutral: false });
    const total = prediction.projectedHomeScore + prediction.projectedAwayScore;
    expect(total).toBeGreaterThan(190);
    expect(total).toBeLessThan(280);
    expect(Math.abs(prediction.projectedHomeScore - prediction.projectedAwayScore - prediction.projectedMargin)).toBeLessThanOrEqual(1);
  });

  it("projects total points near the league baseline", () => {
    const { home: h, away: a } = projectScores(0, 1500, 1500);
    expect(h + a).toBeGreaterThan(215);
    expect(h + a).toBeLessThan(240);
  });
});

describe("Elo bookkeeping", () => {
  it("is zero-sum after an update", () => {
    const state = { ratings: { bos: 1500, mia: 1500 }, played: { bos: 0, mia: 0 } };
    eloUpdate(state, game, 112, 104);
    expect(state.ratings.bos + state.ratings.mia).toBeCloseTo(3000, 6);
    expect(state.ratings.bos).toBeGreaterThan(1500);
    expect(state.played.bos).toBe(1);
  });
});

describe("calibration", () => {
  it("buckets predictions and preserves the total count", () => {
    const rows = [
      { probability: 0.72, outcome: 1 },
      { probability: 0.75, outcome: 0 },
      { probability: 0.12, outcome: 0 },
      { probability: 0.98, outcome: 1 },
    ];
    const buckets = calibrationBuckets(rows);
    expect(buckets.reduce((sum, bucket) => sum + bucket.count, 0)).toBe(4);
    const seventy = buckets.find((bucket) => bucket.bucket === "70-80%");
    expect(seventy?.count).toBe(2);
    expect(seventy?.observed).toBe(0.5);
  });
});
