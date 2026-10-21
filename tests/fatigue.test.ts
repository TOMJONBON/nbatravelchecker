import { describe, expect, it } from "vitest";
import { computeFatigueIndex, fatigueBand, FATIGUE_WEIGHTS } from "@/lib/fatigue";

const ZERO = {
  miles7: 0,
  miles14: 0,
  timeZones7: 0,
  backToBacks7: 0,
  restDays: 3,
  altitudeGames7: 0,
  games7: 0,
  minutesLoad: 0,
};

describe("Travel Fatigue Index", () => {
  it("scores a fully rested, stationary team at zero (fresh)", () => {
    const result = computeFatigueIndex(ZERO);
    expect(result.index).toBe(0);
    expect(result.band).toBe("fresh");
  });

  it("saturates at 100 for a worst-case schedule (severe)", () => {
    const result = computeFatigueIndex({
      miles7: 20_000,
      miles14: 40_000,
      timeZones7: 8,
      backToBacks7: 4,
      restDays: 0,
      altitudeGames7: 3,
      games7: 6,
      minutesLoad: 1,
    });
    expect(result.index).toBe(100);
    expect(result.band).toBe("severe");
  });

  it("has weights that sum to 100", () => {
    const sum = Object.values(FATIGUE_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBe(100);
  });

  it("component points add up to the index (within rounding)", () => {
    const result = computeFatigueIndex({
      miles7: 3_200,
      miles14: 6_400,
      timeZones7: 2,
      backToBacks7: 1,
      restDays: 1,
      altitudeGames7: 1,
      games7: 3,
      minutesLoad: 0.7,
    });
    const total = result.components.reduce((sum, component) => sum + component.points, 0);
    expect(Math.abs(total - result.index)).toBeLessThanOrEqual(2);
    expect(result.components).toHaveLength(8);
  });

  it("increases monotonically with mileage and decreases with rest", () => {
    const low = computeFatigueIndex({ ...ZERO, miles7: 1_000 });
    const high = computeFatigueIndex({ ...ZERO, miles7: 6_000 });
    expect(high.index).toBeGreaterThan(low.index);

    const tired = computeFatigueIndex({ ...ZERO, restDays: 0 });
    const rested = computeFatigueIndex({ ...ZERO, restDays: 3 });
    expect(tired.index).toBeGreaterThan(rested.index);
  });

  it("assigns documented bands at the boundaries", () => {
    expect(fatigueBand(0)).toBe("fresh");
    expect(fatigueBand(19)).toBe("fresh");
    expect(fatigueBand(20)).toBe("manageable");
    expect(fatigueBand(40)).toBe("elevated");
    expect(fatigueBand(60)).toBe("high");
    expect(fatigueBand(80)).toBe("severe");
  });

  it("does not exceed 100 or fall below 0 for extreme inputs", () => {
    const result = computeFatigueIndex({ ...ZERO, miles7: 1e9, miles14: 1e9, timeZones7: 99, games7: 99 });
    expect(result.index).toBeLessThanOrEqual(100);
    expect(result.index).toBeGreaterThanOrEqual(0);
  });
});
