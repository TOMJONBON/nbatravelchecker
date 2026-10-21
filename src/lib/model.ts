import { calibrationBuckets, eloUpdate, logLoss, type EloState } from "./predictions";
import { clamp, round } from "./rand";
import type { Game, ModelReport, PredictionRecord } from "./types";

export interface ModelReportBundle extends ModelReport {
  recent: {
    gameId: string;
    date: string;
    homeTeamId: string;
    awayTeamId: string;
    predictedWinnerId: string;
    homeWinProbability: number;
    actualHomeScore: number;
    actualAwayScore: number;
    winnerCorrect: boolean;
    baselineWinnerCorrect: boolean;
  }[];
}

export function applyEloFromGames(state: EloState, game: Game): void {
  if (game.homeScore === null || game.awayScore === null) return;
  eloUpdate(state, game, game.homeScore, game.awayScore);
}

export function buildModelReport(records: PredictionRecord[]): ModelReportBundle {
  const n = records.length;
  const accuracy = n ? records.filter((r) => r.winnerCorrect).length / n : 0;
  const baselineAccuracy = n ? records.filter((r) => r.baselineWinnerCorrect).length / n : 0;
  const brier = n ? records.reduce((s, r) => s + r.brier, 0) / n : 0;
  const baselineBrier = n ? records.reduce((s, r) => s + r.baselineBrier, 0) / n : 0;
  const loss = n ? records.reduce((s, r) => s + r.logLoss, 0) / n : 0;
  const baselineLoss = n
    ? records.reduce(
        (s, r) =>
          s +
          logLoss(
            r.prediction.baseline.homeWinProbability,
            r.actualHomeScore > r.actualAwayScore ? 1 : 0,
          ),
        0,
      ) / n
    : 0;

  const calibration = calibrationBuckets(
    records.map((r) => ({
      probability: r.prediction.homeWinProbability,
      outcome: r.actualHomeScore > r.actualAwayScore ? 1 : 0,
    })),
  );

  const recent = records
    .slice(-24)
    .reverse()
    .map((r) => ({
      gameId: r.prediction.gameId,
      date: r.prediction.date,
      homeTeamId: r.prediction.homeTeamId,
      awayTeamId: r.prediction.awayTeamId,
      predictedWinnerId: r.prediction.predictedWinnerId,
      homeWinProbability: r.prediction.homeWinProbability,
      actualHomeScore: r.actualHomeScore,
      actualAwayScore: r.actualAwayScore,
      winnerCorrect: r.winnerCorrect,
      baselineWinnerCorrect: r.baselineWinnerCorrect,
    }));

  return {
    modelVersion: records[0]?.prediction.modelVersion ?? "v1.3-elo-fatigue",
    games: n,
    accuracy: round(accuracy, 4),
    baselineAccuracy: round(baselineAccuracy, 4),
    brier: round(brier, 4),
    baselineBrier: round(baselineBrier, 4),
    logLoss: round(loss, 4),
    calibration,
    windowStart: records[0]?.prediction.date ?? "",
    windowEnd: records[records.length - 1]?.prediction.date ?? "",
    updatedAt: new Date().toISOString(),
    provenance: "mock",
    recent,
  };
}

/**
 * Skill score vs the baseline, expressed as a percentage reduction in Brier
 * score. Negative values mean the richer model is worse out of sample.
 */
export function skillScore(report: ModelReport): number {
  if (report.baselineBrier <= 0) return 0;
  return round((1 - report.brier / report.baselineBrier) * 100, 1);
}

export function calibrationError(report: ModelReport): number {
  if (report.calibration.length === 0) return 0;
  const total = report.calibration.reduce((s, b) => s + b.count, 0);
  const weighted = report.calibration.reduce(
    (s, b) => s + Math.abs(b.predicted - b.observed) * b.count,
    0,
  );
  return round((weighted / Math.max(1, total)) * 100, 1);
}

export function sampleWarning(games: number): string | null {
  if (games === 0) return "No completed games in the sample yet.";
  if (games < 40) return `Only ${games} games in the sample — accuracy estimates are noisy (±${Math.round(clamp(50 / Math.sqrt(games), 3, 20))} pts).`;
  return null;
}
