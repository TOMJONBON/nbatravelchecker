import { describe, expect, it } from "vitest";
import { arcPoints, estimatedFlightMiles, haversineMiles } from "@/lib/geo";
import { buildTeamSchedule, buildTrips, travelInWindow } from "@/lib/travel";
import { addDays } from "@/lib/time";
import type { Game } from "@/lib/types";

function game(overrides: Partial<Game> & Pick<Game, "date" | "homeTeamId" | "awayTeamId">): Game {
  return {
    id: `g-${overrides.date}-${overrides.homeTeamId}-${overrides.awayTeamId}`,
    seasonId: "2026-27",
    tipoff: `${overrides.date}T23:30:00.000Z`,
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

describe("geo", () => {
  it("computes a plausible NYC → LA great-circle distance", () => {
    const miles = haversineMiles({ lat: 40.7769, lon: -73.874 }, { lat: 33.9416, lon: -118.4085 });
    expect(miles).toBeGreaterThan(2_400);
    expect(miles).toBeLessThan(2_500);
  });

  it("adds a routing buffer for estimated flight miles", () => {
    const a = { lat: 40.7769, lon: -73.874 };
    const b = { lat: 33.9416, lon: -118.4085 };
    expect(estimatedFlightMiles(a, b)).toBeGreaterThan(haversineMiles(a, b));
  });

  it("returns the requested number of arc segments with matching endpoints", () => {
    const points = arcPoints({ lat: 40, lon: -70 }, { lat: 34, lon: -118 }, 16);
    expect(points).toHaveLength(17);
    expect(points[0][1]).toBeCloseTo(-70, 5);
    expect(points[16][1]).toBeCloseTo(-118, 5);
    expect(points[0][0]).toBeCloseTo(40, 5);
  });
});

describe("road trips", () => {
  const games = [
    game({ date: "2026-10-20", homeTeamId: "bos", awayTeamId: "nyk" }),
    game({ date: "2026-10-22", homeTeamId: "mia", awayTeamId: "bos" }),
    game({ date: "2026-10-24", homeTeamId: "orl", awayTeamId: "bos" }),
    game({ date: "2026-10-26", homeTeamId: "bos", awayTeamId: "phi" }),
    game({ date: "2026-10-28", homeTeamId: "was", awayTeamId: "bos" }),
  ];

  it("groups consecutive away games into one trip and splits at home games", () => {
    const schedule = buildTeamSchedule("bos", games, new Date("2026-10-25T12:00:00Z"));
    expect(schedule.trips).toHaveLength(2);
    expect(schedule.trips[0].gameIds).toHaveLength(2);
    expect(schedule.trips[0].cities).toEqual(["Miami", "Orlando"]);
    expect(schedule.trips[0].totalMiles).toBeGreaterThan(1_000);
    expect(schedule.trips[1].singleGame).toBe(true);
  });

  it("marks a one-day gap as a back-to-back", () => {
    const b2bGames = [
      game({ date: "2026-10-20", homeTeamId: "bos", awayTeamId: "nyk" }),
      game({ date: "2026-10-21", homeTeamId: "phi", awayTeamId: "bos" }),
    ];
    const schedule = buildTeamSchedule("bos", b2bGames, new Date("2026-10-21T12:00:00Z"));
    expect(schedule.trips[0].backToBacks).toBe(1);
  });

  it("creates a leg for every city change and sums miles into the 7-day window", () => {
    const schedule = buildTeamSchedule("bos", games, new Date("2026-10-25T12:00:00Z"));
    expect(schedule.legs.length).toBeGreaterThanOrEqual(4);
    const window = travelInWindow(schedule.legs, "2026-10-24", 7);
    expect(window.miles).toBeGreaterThan(0);
    expect(window.legs.length).toBeGreaterThan(0);
  });

  it("counts time-zone shifts with the correct sign", () => {
    const eastWest = [
      game({ date: "2026-10-20", homeTeamId: "lal", awayTeamId: "bos" }),
      game({ date: "2026-10-22", homeTeamId: "bos", awayTeamId: "lal" }),
    ];
    const schedule = buildTeamSchedule("bos", eastWest, new Date("2026-10-21T12:00:00Z"));
    const westward = schedule.legs.find((leg) => leg.from.code === "BOS" && leg.to.code === "LAX");
    expect(westward?.timeZoneShift).toBe(-3);
  });

  it("never exceeds one leg per game beyond the return leg", () => {
    const schedule = buildTeamSchedule("bos", games, new Date("2026-10-25T12:00:00Z"));
    const perGame = new Map<string, number>();
    for (const leg of schedule.legs) {
      perGame.set(leg.gameId, (perGame.get(leg.gameId) ?? 0) + 1);
    }
    for (const count of perGame.values()) expect(count).toBeLessThanOrEqual(2);
  });
});
