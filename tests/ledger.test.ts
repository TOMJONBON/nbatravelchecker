import { describe, expect, it } from "vitest";
import { gradeEntries, type LedgerEntry } from "@/lib/ledger";
import type { Game } from "@/lib/types";

function game(overrides: Partial<Game> & Pick<Game, "id" | "homeTeamId" | "awayTeamId">): Game {
  return {
    seasonId: "2026-27",
    date: "2026-10-21",
    tipoff: "2026-10-21T23:00:00.000Z",
    status: "final",
    homeScore: 110,
    awayScore: 100,
    period: "Final",
    clock: null,
    venueType: "team",
    seasonType: "regular",
    ...overrides,
  };
}

function entry(overrides: Partial<LedgerEntry> & Pick<LedgerEntry, "gameId">): LedgerEntry {
  return {
    date: "2026-10-21",
    capturedAt: "2026-10-21T18:00:00.000Z",
    homeWinProbability: 0.7,
    predictedWinnerId: "bos",
    projectedMargin: 4,
    modelVersion: "v2",
    ...overrides,
  };
}

describe("prediction ledger grading", () => {
  it("grades only completed games", () => {
    const games = [
      game({ id: "g1", homeTeamId: "bos", awayTeamId: "nyk", homeScore: 110, awayScore: 100 }),
      game({
        id: "g2",
        homeTeamId: "lal",
        awayTeamId: "gsw",
        status: "live",
        homeScore: 50,
        awayScore: 48,
      }),
    ];
    const report = gradeEntries(
      [
        entry({ gameId: "g1", homeWinProbability: 0.8, predictedWinnerId: "bos" }),
        entry({ gameId: "g2", predictedWinnerId: "lal" }),
      ],
      games,
    );
    expect(report.graded).toBe(1);
    expect(report.accuracy).toBe(1);
    expect(report.brier).toBeCloseTo(0.04, 5);
  });

  it("scores a miss and an away win", () => {
    const games = [
      game({ id: "g1", homeTeamId: "bos", awayTeamId: "nyk", homeScore: 98, awayScore: 105 }),
    ];
    const report = gradeEntries(
      [entry({ gameId: "g1", homeWinProbability: 0.4, predictedWinnerId: "bos" })],
      games,
    );
    expect(report.graded).toBe(1);
    expect(report.accuracy).toBe(0);
    expect(report.brier).toBeCloseTo(0.16, 5);
    expect(report.logLoss).toBeGreaterThan(0);
  });

  it("returns nulls when nothing has finished", () => {
    const report = gradeEntries([entry({ gameId: "g1" })], []);
    expect(report.graded).toBe(0);
    expect(report.accuracy).toBeNull();
    expect(report.brier).toBeNull();
  });

  it("reports the first capture and last graded date", () => {
    const games = [game({ id: "g1", homeTeamId: "bos", awayTeamId: "nyk", date: "2026-10-22" })];
    const report = gradeEntries(
      [
        entry({ gameId: "g1", capturedAt: "2026-10-20T12:00:00.000Z" }),
        entry({ gameId: "g2", capturedAt: "2026-10-21T12:00:00.000Z" }),
      ],
      games,
    );
    expect(report.firstCapturedAt).toBe("2026-10-20T12:00:00.000Z");
    expect(report.lastGradedAt).toBe("2026-10-22");
  });
});
