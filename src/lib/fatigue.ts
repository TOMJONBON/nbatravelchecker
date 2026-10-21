import { clamp } from "./rand";
import { diffDays, todayISO } from "./time";
import { TEAM_BY_ID, isAltitude } from "./teams";
import { travelInWindow, type TeamSchedule } from "./travel";
import { awayRecord, homeRecord, restDaysBefore, summarizeGames } from "./stats";
import type {
  FatigueComponent,
  Game,
  Team,
  TeamRecord,
  TeamTravelMetrics,
  TravelStatus,
} from "./types";

/**
 * Travel Fatigue Index — deterministic, 0-100, higher = more fatigued.
 *
 * Each input is normalised to 0-1 against the cap in parentheses and multiplied
 * by its weight. Weights sum to 100:
 *   miles last 7d (7,000) ....... 20
 *   miles last 14d (12,000) ..... 10
 *   time zones crossed 7d (4) ... 14
 *   back-to-backs 7d (2) ........ 14
 *   rest deficit (0 rest = 1) ... 16
 *   altitude games 7d (1) ....... 6
 *   games in 7d (4) ............ 10
 *   minutes load (1) ........... 10
 *
 * The index is a heuristic, documented on /methodology. It is not a medical or
 * injury-risk assessment.
 */
export const FATIGUE_WEIGHTS = {
  miles7: 20,
  miles14: 10,
  timeZones7: 14,
  backToBacks7: 14,
  rest: 16,
  altitude: 6,
  density: 10,
  minutes: 10,
} as const;

export const FATIGUE_CAPS = {
  miles7: 7000,
  miles14: 12000,
  timeZones7: 4,
  backToBacks7: 2,
  altitudeGames7: 1,
  games7: 4,
} as const;

export interface FatigueInputs {
  miles7: number;
  miles14: number;
  timeZones7: number;
  backToBacks7: number;
  restDays: number;
  altitudeGames7: number;
  games7: number;
  /** Omit when real minutes are unavailable; the index renormalises. */
  minutesLoad?: number;
}

export type FatigueBand = TeamTravelMetrics["fatigueBand"];

function normalise(value: number, cap: number): number {
  return clamp(value / cap, 0, 1);
}

export function fatigueBand(index: number): FatigueBand {
  if (index < 20) return "fresh";
  if (index < 40) return "manageable";
  if (index < 60) return "elevated";
  if (index < 80) return "high";
  return "severe";
}

export function computeFatigueIndex(inputs: FatigueInputs): {
  index: number;
  band: FatigueBand;
  components: FatigueComponent[];
} {
  const items: Array<{
    key: keyof typeof FATIGUE_WEIGHTS;
    label: string;
    value: number;
    normalized: number;
    detail: string;
  }> = [
    {
      key: "miles7",
      label: "Miles · last 7 days",
      value: Math.round(inputs.miles7),
      normalized: normalise(inputs.miles7, FATIGUE_CAPS.miles7),
      detail: `${Math.round(inputs.miles7).toLocaleString()} mi flown in the last 7 days`,
    },
    {
      key: "miles14",
      label: "Miles · last 14 days",
      value: Math.round(inputs.miles14),
      normalized: normalise(inputs.miles14, FATIGUE_CAPS.miles14),
      detail: `${Math.round(inputs.miles14).toLocaleString()} mi over 14 days`,
    },
    {
      key: "timeZones7",
      label: "Time zones crossed · 7 days",
      value: inputs.timeZones7,
      normalized: normalise(inputs.timeZones7, FATIGUE_CAPS.timeZones7),
      detail: `${inputs.timeZones7} zone change${inputs.timeZones7 === 1 ? "" : "s"} (eastward shifts weighted equally)`,
    },
    {
      key: "backToBacks7",
      label: "Back-to-backs · 7 days",
      value: inputs.backToBacks7,
      normalized: normalise(inputs.backToBacks7, FATIGUE_CAPS.backToBacks7),
      detail: `${inputs.backToBacks7} back-to-back set${inputs.backToBacks7 === 1 ? "" : "s"}`,
    },
    {
      key: "rest",
      label: "Rest deficit",
      value: inputs.restDays,
      normalized: clamp(1 - inputs.restDays / 3, 0, 1),
      detail:
        inputs.restDays === 0
          ? "No full rest day between games"
          : `${inputs.restDays} full rest day${inputs.restDays === 1 ? "" : "s"} before the next game`,
    },
    {
      key: "altitude",
      label: "Altitude games · 7 days",
      value: inputs.altitudeGames7,
      normalized: normalise(inputs.altitudeGames7, FATIGUE_CAPS.altitudeGames7),
      detail: `${inputs.altitudeGames7} game${inputs.altitudeGames7 === 1 ? "" : "s"} at 4,000ft or higher`,
    },
    {
      key: "density",
      label: "Schedule density · 7 days",
      value: inputs.games7,
      normalized: normalise(inputs.games7, FATIGUE_CAPS.games7),
      detail: `${inputs.games7} game${inputs.games7 === 1 ? "" : "s"} in 7 days`,
    },
    {
      key: "minutes",
      label: "Recent minutes load",
      value: Math.round((inputs.minutesLoad ?? 0) * 100) / 100,
      normalized: clamp(inputs.minutesLoad ?? 0, 0, 1),
      detail: `Rotation load index ${((inputs.minutesLoad ?? 0) * 100).toFixed(0)}/100 (projected starter minutes)`,
    },
  ];

  // Minutes load needs a box score the public feed does not expose cheaply. If
  // it is unavailable, omit the component and renormalise the remaining weights
  // rather than injecting a constant that looks like data.
  const activeItems = inputs.minutesLoad === undefined ? items.filter((item) => item.key !== "minutes") : items;
  const totalWeight = activeItems.reduce((sum, item) => sum + FATIGUE_WEIGHTS[item.key], 0);

  const components: FatigueComponent[] = activeItems.map((item) => {
    const weight = Math.round((FATIGUE_WEIGHTS[item.key] / totalWeight) * 1000) / 10;
    return {
      key: item.key,
      label: item.label,
      value: item.value,
      normalized: Math.round(item.normalized * 100) / 100,
      weight,
      points: Math.round(item.normalized * weight * 10) / 10,
      detail: item.detail,
    };
  });

  const index = Math.round(components.reduce((sum, c) => sum + (c.normalized * c.weight), 0));
  return { index: clamp(index, 0, 100), band: fatigueBand(index), components };
}

export interface BuildMetricsDeps {
  team: Team;
  schedule: TeamSchedule;
  allGames: Game[];
  today: string;
  /** Omit when real minutes are unavailable; the index renormalises. */
  minutesLoad?: number;
}

function statusFor(
  today: string,
  teamId: string,
  schedule: TeamSchedule,
  restDays: number,
): { status: TravelStatus; label: string; detail: string } {
  const gameToday = schedule.games.find((g) => g.date === today);
  const trip = schedule.currentTrip;
  const gameYesterday = schedule.games.find((g) => diffDays(today, g.date) === 1);

  if (gameToday) {
    const away = gameToday.awayTeamId === teamId;
    if (restDays === 0 && gameYesterday) {
      return {
        status: "back_to_back",
        label: "Back-to-back",
        detail: away
          ? `Second night of a back-to-back on the road in ${gameToday.neutralSite?.city ?? TEAM_BY_ID[gameToday.homeTeamId].city}.`
          : "Second night of a back-to-back at home.",
      };
    }
    if (away) {
      return {
        status: "road_trip",
        label: "Road trip",
        detail: `Playing at ${gameToday.neutralSite?.city ?? TEAM_BY_ID[gameToday.homeTeamId].city}${trip ? ` (game ${trip.gameIds.indexOf(gameToday.id) + 1} of ${trip.gameIds.length})` : ""}.`,
      };
    }
    return { status: "home", label: "At home", detail: "Home game tonight." };
  }

  if (trip && today >= trip.startDate && today <= trip.endDate) {
    return {
      status: "traveling",
      label: "Traveling",
      detail: `On the road: ${trip.cities.join(" → ")}.`,
    };
  }

  const tomorrow = schedule.games.find((g) => diffDays(g.date, today) === 1);
  if (tomorrow && tomorrow.awayTeamId === teamId) {
    return {
      status: "traveling",
      label: "Traveling",
      detail: `Departing for ${tomorrow.neutralSite?.city ?? TEAM_BY_ID[tomorrow.homeTeamId].city}.`,
    };
  }

  const playedToday = schedule.lastGame?.date === today;
  if (!playedToday && restDays >= 1) {
    return {
      status: "rest_day",
      label: "Rest day",
      detail: `No game today — ${restDays} day${restDays === 1 ? "" : "s"} between games.`,
    };
  }
  return { status: "traveling", label: "Traveling", detail: "In transit between games." };
}

export function buildTeamMetrics({
  team,
  schedule,
  allGames,
  today,
  minutesLoad,
}: BuildMetricsDeps): TeamTravelMetrics {
  const teamGames = schedule.games;
  const nextGame = schedule.games.find((g) => g.date >= today && g.status !== "postponed") ?? null;
  const lastGame =
    [...schedule.games].reverse().find((g) => g.date < today || g.status === "final") ?? null;

  const restDays = nextGame ? restDaysBefore(team.id, nextGame, teamGames) : Math.max(
    0,
    lastGame ? diffDays(today, lastGame.date) : 3,
  );

  const window7 = travelInWindow(schedule.legs, today, 7);
  const window14 = travelInWindow(schedule.legs, today, 14);

  const last7 = teamGames.filter((g) => g.date <= today && diffDays(today, g.date) < 7);
  const backToBacks7 = last7.reduce((sum, g, i) => {
    if (i === 0) return sum;
    return sum + (diffDays(g.date, last7[i - 1].date) === 1 ? 1 : 0);
  }, 0);
  const altitudeGames7 = last7.filter((g) =>
    g.neutralSite
      ? g.neutralSite.lat > 19 && g.neutralSite.city.includes("Mexico")
      : isAltitude(TEAM_BY_ID[g.homeTeamId]),
  ).length;

  const { index, band, components } = computeFatigueIndex({
    miles7: window7.miles,
    miles14: window14.miles,
    timeZones7: window7.timeZones,
    backToBacks7,
    restDays,
    altitudeGames7,
    games7: last7.length,
    minutesLoad,
  });

  const status = statusFor(today, team.id, schedule, restDays);

  const nextOpponentId = nextGame
    ? nextGame.homeTeamId === team.id
      ? nextGame.awayTeamId
      : nextGame.homeTeamId
    : null;

  return {
    teamId: team.id,
    asOf: new Date().toISOString(),
    fatigueIndex: index,
    fatigueBand: band,
    components,
    status: status.status,
    statusLabel: status.label,
    statusDetail: status.detail,
    miles7: Math.round(window7.miles),
    miles14: Math.round(window14.miles),
    timeZones7: window7.timeZones,
    backToBacks7,
    altitudeGames7,
    games7: last7.length,
    restDays,
    minutesLoad: minutesLoad ?? 0,
    trip: schedule.currentTrip ?? schedule.nextTrip,
    nextGame,
    nextOpponentId,
    lastGame,
    roadRecord: awayRecord(team.id, teamGames),
    homeRecord: homeRecord(team.id, teamGames),
    last10: summarizeGames(
      team.id,
      teamGames.filter((g) => g.status === "final").slice(-10),
    ) as TeamRecord,
  };
}

export function fatigueSummary(metrics: TeamTravelMetrics): string {
  const top = [...metrics.components].sort((a, b) => b.points - a.points).slice(0, 2);
  return top.map((c) => `${c.label}: ${c.detail}`).join(" · ");
}

export function fatigueColor(band: FatigueBand): string {
  switch (band) {
    case "fresh":
      return "text-emerald-300";
    case "manageable":
      return "text-lime-300";
    case "elevated":
      return "text-amber-300";
    case "high":
      return "text-orange-300";
    default:
      return "text-rose-300";
  }
}

export function todayFor(now = new Date()): string {
  return todayISO(now);
}
