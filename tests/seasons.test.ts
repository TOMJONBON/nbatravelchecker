import { describe, expect, it } from "vitest";
import { espnYearFor, seasonConfig, seasonId, seasonYearFor } from "@/lib/seasons";

const at = (iso: string) => new Date(`${iso}T12:00:00Z`);

describe("season arithmetic", () => {
  it("rolls to the next season in September", () => {
    expect(seasonYearFor(at("2026-09-01"))).toBe(2027);
    expect(seasonId(2027)).toBe("2026-27");
  });

  it("keeps the current season from January to June", () => {
    expect(seasonYearFor(at("2027-01-15"))).toBe(2027);
    expect(seasonYearFor(at("2027-06-30"))).toBe(2027);
    expect(seasonId(2027)).toBe("2026-27");
  });

  it("stays on the just-finished season during July and August", () => {
    expect(seasonYearFor(at("2027-07-15"))).toBe(2027);
    expect(seasonYearFor(at("2027-08-31"))).toBe(2027);
  });

  it("derives current, previous and fit seasons", () => {
    expect(seasonConfig(at("2026-10-21"))).toEqual({
      current: "2026-27",
      previous: "2025-26",
      fit: "2024-25",
      currentYear: 2027,
    });
    expect(seasonConfig(at("2027-10-21"))).toEqual({
      current: "2027-28",
      previous: "2026-27",
      fit: "2025-26",
      currentYear: 2028,
    });
  });

  it("converts a season id to the ESPN year", () => {
    expect(espnYearFor("2026-27")).toBe(2027);
    expect(espnYearFor("2024-25")).toBe(2025);
    expect(espnYearFor("2027-28")).toBe(2028);
  });
});
