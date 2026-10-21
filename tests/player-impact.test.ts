import { describe, expect, it } from "vitest";
import { buildPlayerImpact, MIN_MODEL_N, MIN_SPLIT_SAMPLE, ols } from "@/lib/player-impact";
import type { Player, PlayerGameLog } from "@/lib/types";

const player: Player = {
  id: "bos-p1",
  teamId: "bos",
  name: "Test Player",
  position: "G",
  number: 7,
  age: 27,
  heightIn: 76,
  minutesPerGame: 30,
  pointsPer36: 20,
  usage: 0.25,
  bpm: 3,
  starter: true,
};

function makeLog(index: number, overrides: Partial<PlayerGameLog> = {}): PlayerGameLog {
  return {
    gameId: `g${index}`,
    date: `2026-01-${String((index % 28) + 1).padStart(2, "0")}`,
    seasonId: "2026-27",
    opponentId: "mia",
    home: true,
    minutes: 30,
    points: 20,
    rebounds: 4,
    assists: 4,
    fgPct: 0.47,
    fg3Pct: 0.36,
    turnovers: 2,
    plusMinus: 3,
    restDays: 2,
    backToBack: false,
    miles7: 0,
    timeZones7: 0,
    altitudeGame: false,
    opponentDefRating: 114,
    available: true,
    ...overrides,
  };
}

describe("OLS", () => {
  it("recovers known coefficients on noise-free data", () => {
    const rows = Array.from({ length: 80 }, (_, i) => {
      const b2b = i % 2;
      const miles = (i * 137) % 6000;
      const zone = i % 3;
      const alt = i % 5 === 0 ? 1 : 0;
      const homeFlag = i % 4 === 0 ? 1 : 0;
      const oppDef = 110 + (i % 9);
      const y = 5 + 3 * b2b - 0.5 * (miles / 1000) - 0.2 * zone - 1 * alt + 1 * homeFlag + 0.1 * (oppDef - 114);
      return { x: [1, b2b, miles / 1000, zone, alt, homeFlag, oppDef - 114], y };
    });

    const fit = ols(rows.map((row) => row.x), rows.map((row) => row.y));
    expect(fit).not.toBeNull();
    expect(fit!.beta[0]).toBeCloseTo(5, 4);
    expect(fit!.beta[1]).toBeCloseTo(3, 4);
    expect(fit!.beta[2]).toBeCloseTo(-0.5, 4);
    expect(fit!.beta[3]).toBeCloseTo(-0.2, 4);
    expect(fit!.beta[4]).toBeCloseTo(-1, 4);
    expect(fit!.beta[5]).toBeCloseTo(1, 4);
    expect(fit!.beta[6]).toBeCloseTo(0.1, 4);
    expect(fit!.r2).toBeCloseTo(1, 6);
  });

  it("returns null for underdetermined systems", () => {
    expect(ols([[1, 2]], [3])).toBeNull();
    expect(ols([], [])).toBeNull();
  });

  it("survives a constant column by dropping it and reporting zero", () => {
    const rows = Array.from({ length: 40 }, (_, i) => [1, i % 2, i % 5, 0, (i % 7) * 0.1]);
    const y = rows.map(([, b, c]) => 2 + 3 * b - 1 * c);
    const fit = ols(rows, y);
    expect(fit).not.toBeNull();
    expect(fit!.beta[1]).toBeCloseTo(3, 6);
    expect(fit!.beta[2]).toBeCloseTo(-1, 6);
    expect(fit!.beta[3]).toBe(0);
    expect(fit!.se[3]).toBe(0);
  });
});

describe("player travel impact", () => {
  it("withholds the adjusted model below the minimum sample", () => {
    const logs = Array.from({ length: 12 }, (_, i) => makeLog(i, { points: 18 + (i % 5) }));
    const impact = buildPlayerImpact(player, logs, { seasonId: "all" });
    expect(impact.model).toBeNull();
    expect(impact.games).toBe(12);
    expect(impact.explanation.join(" ")).toMatch(/not enough/i);
  });

  it("fits a model and produces coefficient intervals at adequate sample size", () => {
    const logs = Array.from({ length: 60 }, (_, i) =>
      makeLog(i, {
        backToBack: i % 3 === 0,
        miles7: (i * 211) % 7000,
        timeZones7: i % 4,
        altitudeGame: i % 7 === 0,
        home: i % 2 === 0,
        opponentDefRating: 110 + (i % 9),
        points: 20 + (i % 6) - (i % 3 === 0 ? 2 : 0),
        minutes: 28 + (i % 7),
      }),
    );
    const impact = buildPlayerImpact(player, logs, { seasonId: "all" });
    expect(impact.model).not.toBeNull();
    expect(impact.model!.n).toBeGreaterThanOrEqual(MIN_MODEL_N);
    expect(impact.model!.coefficients).toHaveLength(7);
    for (const coefficient of impact.model!.coefficients) {
      expect(Number.isFinite(coefficient.estimate)).toBe(true);
      expect(coefficient.ci).toBeGreaterThanOrEqual(0);
    }
    expect(impact.travelImpactScore).toBeGreaterThanOrEqual(0);
    expect(impact.travelImpactScore).toBeLessThanOrEqual(100);
  });

  it("filters unavailable games out of the sample", () => {
    const logs = Array.from({ length: 40 }, (_, i) => makeLog(i, { available: i % 2 === 0 }));
    const impact = buildPlayerImpact(player, logs, { seasonId: "all" });
    expect(impact.games).toBe(20);
  });

  it("honours the season filter", () => {
    const logs = [
      ...Array.from({ length: 20 }, (_, i) => makeLog(i, { seasonId: "2025-26" })),
      ...Array.from({ length: 20 }, (_, i) => makeLog(i + 100, { seasonId: "2026-27" })),
    ];
    expect(buildPlayerImpact(player, logs, { seasonId: "2025-26" }).games).toBe(20);
    expect(buildPlayerImpact(player, logs, { seasonId: "all" }).games).toBe(40);
  });

  it("flags small splits in caveats", () => {
    const logs = Array.from({ length: 40 }, (_, i) => makeLog(i));
    const impact = buildPlayerImpact(player, logs, { seasonId: "all" });
    expect(impact.caveats.join(" ")).toContain(String(MIN_SPLIT_SAMPLE));
  });
});
