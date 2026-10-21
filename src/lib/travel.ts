import { estimatedFlightMiles, teamAirport } from "./geo";
import { addDays, diffDays, todayISO } from "./time";
import { TEAM_BY_ID, isAltitude } from "./teams";
import type {
  Game,
  RoadTrip,
  RoadTripStatus,
  Team,
  TravelEndpoint,
  TravelLeg,
} from "./types";

export interface TeamSchedule {
  teamId: string;
  games: Game[];
  legs: TravelLeg[];
  trips: RoadTrip[];
  currentTrip: RoadTrip | null;
  nextTrip: RoadTrip | null;
  nextGame: Game | null;
  lastGame: Game | null;
  locationTeamId: string | null;
}

function destinationFor(game: Game): TravelEndpoint {
  if (game.neutralSite) {
    return {
      city: game.neutralSite.city,
      code: "—",
      lat: game.neutralSite.lat,
      lon: game.neutralSite.lon,
      utcOffset: game.neutralSite.utcOffset ?? Math.round(game.neutralSite.lon / 15),
    };
  }
  const team = TEAM_BY_ID[game.homeTeamId];
  return {
    city: team.city,
    code: team.airport.code,
    lat: team.arena.lat,
    lon: team.arena.lon,
    utcOffset: team.utcOffset,
  };
}

/** The city a team sleeps in before a game (home arena or opponent city). */
function gameCity(teamId: string, game: Game): TravelEndpoint {
  if (game.homeTeamId === teamId && !game.neutralSite) return teamAirport(teamId);
  if (game.neutralSite) return destinationFor(game);
  return teamAirport(game.homeTeamId);
}

/**
 * Travel is reconstructed from the schedule: a flight is assumed to depart the
 * day before each game where the team changes city. It is an ESTIMATE, never
 * live flight tracking.
 */
export function buildTeamSchedule(
  teamId: string,
  games: Game[],
  now = new Date(),
): TeamSchedule {
  const today = todayISO(now);
  const teamGames = games
    .filter((g) => g.homeTeamId === teamId || g.awayTeamId === teamId)
    .sort((a, b) => (a.tipoff < b.tipoff ? -1 : 1));
  const homeBase = teamAirport(teamId);
  const legs: TravelLeg[] = [];
  let cursor = homeBase;
  let previousDate: string | null = null;

  for (const game of teamGames) {
    const dest = gameCity(teamId, game);
    const changedCity =
      cursor.code !== dest.code || Math.abs(cursor.lat - dest.lat) > 0.01 || Math.abs(cursor.lon - dest.lon) > 0.01;
    if (changedCity) {
      const departed =
        previousDate && diffDays(game.date, previousDate) === 1
          ? game.date
          : addDays(game.date, -1);
      legs.push({
        id: `${teamId}-${game.id}-leg`,
        teamId,
        gameId: game.id,
        from: cursor,
        to: dest,
        departDate: departed,
        miles: estimatedFlightMiles(cursor, dest),
        timeZoneShift: dest.utcOffset - cursor.utcOffset,
        isEstimated: true,
        mode: "air",
        note: game.neutralSite
          ? "Neutral-site routing (estimated)."
          : undefined,
      });
    }
    cursor = dest;
    previousDate = game.date;
  }

  // Return legs to home are implicit until the next game; add one after the last
  // road game of the generated horizon for completeness.
  if (cursor.code !== homeBase.code && teamGames.length > 0) {
    const last = teamGames[teamGames.length - 1];
    legs.push({
      id: `${teamId}-${last.id}-return`,
      teamId,
      gameId: last.id,
      from: cursor,
      to: homeBase,
      departDate: addDays(last.date, 1),
      miles: estimatedFlightMiles(cursor, homeBase),
      timeZoneShift: homeBase.utcOffset - cursor.utcOffset,
      isEstimated: true,
      mode: "air",
      note: "Estimated return leg.",
    });
  }

  const trips = buildTrips(teamId, teamGames, legs, today);
  const currentTrip =
    trips.find((t) => t.status === "active") ?? null;
  const nextTrip = trips.find((t) => t.status === "upcoming") ?? null;
  const nextGame = teamGames.find((g) => g.date >= today && g.status !== "postponed") ?? null;
  const lastGame = [...teamGames].reverse().find((g) => g.date < today || g.status === "final") ?? null;

  return {
    teamId,
    games: teamGames,
    legs,
    trips,
    currentTrip,
    nextTrip,
    nextGame,
    lastGame,
    locationTeamId: cursor.code === homeBase.code ? teamId : null,
  };
}

/** Consecutive road games = one road trip. A single away game is a 1-game trip. */
export function buildTrips(
  teamId: string,
  teamGames: Game[],
  legs: TravelLeg[],
  today: string,
): RoadTrip[] {
  const trips: RoadTrip[] = [];
  let run: Game[] = [];

  const flush = () => {
    if (run.length === 0) return;
    const first = run[0];
    const last = run[run.length - 1];
    const startIndex = Math.max(0, teamGames.findIndex((g) => g.id === first.id));
    const tripLegs = legs.filter((l) => run.some((g) => g.id === l.gameId));
    const cities = Array.from(
      new Set(run.map((g) => (g.neutralSite ? g.neutralSite.city : TEAM_BY_ID[g.homeTeamId].city))),
    );
    const stops = run.map((g, index) => {
      const previous = teamGames[startIndex + index - 1];
      const altitude = g.neutralSite
        ? g.neutralSite.lat > 19 && g.neutralSite.city.includes("Mexico")
        : isAltitude(TEAM_BY_ID[g.homeTeamId]);
      return {
        gameId: g.id,
        date: g.date,
        city: g.neutralSite ? g.neutralSite.city : TEAM_BY_ID[g.homeTeamId].city,
        opponentId: g.homeTeamId,
        backToBack: Boolean(previous) && diffDays(g.date, previous.date) === 1,
        altitude,
      };
    });
    const timeZonesCrossed = tripLegs.reduce((sum, l) => sum + Math.abs(l.timeZoneShift), 0);
    const backToBacks = stops.filter((stop) => stop.backToBack).length;
    const altitudeGames = run.filter((g) =>
      g.neutralSite ? g.neutralSite.lat > 19 && g.neutralSite.city.includes("Mexico") : isAltitude(TEAM_BY_ID[g.homeTeamId]),
    ).length;
    const restDaysBetween = run.slice(1).map((g, i) => diffDays(g.date, run[i].date) - 1);
    const startDate = first.date;
    const endDate = last.date;
    let status: RoadTripStatus = "completed";
    if (today < startDate) status = "upcoming";
    else if (today <= endDate) status = "active";

    trips.push({
      id: `${teamId}-trip-${first.date}-${run.length}`,
      teamId,
      seasonId: first.seasonId,
      gameIds: run.map((g) => g.id),
      legs: tripLegs,
      cities,
      stops,
      startDate,
      endDate,
      totalMiles: tripLegs.reduce((s, l) => s + l.miles, 0),
      timeZonesCrossed,
      backToBacks,
      altitudeGames,
      restDaysBetween,
      status,
      singleGame: run.length === 1,
    });
    run = [];
  };

  for (const game of teamGames) {
    if (game.awayTeamId === teamId) {
      run.push(game);
    } else {
      flush();
    }
  }
  flush();
  return trips;
}

/** Miles and zone changes actually logged in the trailing `days` window. */
export function travelInWindow(
  legs: TravelLeg[],
  today: string,
  days: number,
): { miles: number; timeZones: number; legs: TravelLeg[] } {
  const start = addDays(today, -(days - 1));
  const windowLegs = legs.filter((l) => l.departDate >= start && l.departDate <= today);
  return {
    miles: windowLegs.reduce((s, l) => s + l.miles, 0),
    timeZones: windowLegs.reduce((s, l) => s + Math.abs(l.timeZoneShift), 0),
    legs: windowLegs,
  };
}

export function isHomeGame(teamId: string, game: Game): boolean {
  return game.homeTeamId === teamId && game.venueType === "team";
}

export function teamLocationLabel(team: Team, schedule: TeamSchedule): string {
  if (schedule.nextGame && schedule.nextGame.date === todayISO() && schedule.nextGame.awayTeamId === team.id) {
    const g = schedule.nextGame;
    return g.neutralSite ? g.neutralSite.city : TEAM_BY_ID[g.homeTeamId].city;
  }
  if (schedule.currentTrip) return schedule.currentTrip.cities[schedule.currentTrip.cities.length - 1];
  return team.city;
}
