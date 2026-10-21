import { TEAM_BY_ID } from "./teams";
import type { TravelEndpoint } from "./types";

/** Great-circle distance in statute miles. */
export function haversineMiles(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  const R = 3958.7613;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Estimated flight distance for a road leg. Great-circle distance plus a 6%
 * routing/approach buffer — still an estimate, not filed flight data.
 */
export function estimatedFlightMiles(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  return Math.round(haversineMiles(a, b) * 1.06);
}

export function teamAirport(teamId: string): TravelEndpoint {
  const team = TEAM_BY_ID[teamId];
  if (!team) throw new Error(`Unknown team: ${teamId}`);
  return {
    city: team.city,
    code: team.airport.code,
    lat: team.airport.lat,
    lon: team.airport.lon,
    utcOffset: team.utcOffset,
  };
}

export function teamArena(teamId: string): TravelEndpoint {
  const team = TEAM_BY_ID[teamId];
  if (!team) throw new Error(`Unknown team: ${teamId}`);
  return {
    city: team.city,
    code: team.airport.code,
    lat: team.arena.lat,
    lon: team.arena.lon,
    utcOffset: team.utcOffset,
  };
}

/** Interpolate a great-circle path for map rendering (simple lat/lon easing). */
export function arcPoints(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
  segments = 32,
): [number, number][] {
  const points: [number, number][] = [];
  let dLon = b.lon - a.lon;
  if (Math.abs(dLon) > 180) dLon -= Math.sign(dLon) * 360;
  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    const lat = a.lat + (b.lat - a.lat) * t;
    let lon = a.lon + dLon * t;
    if (lon > 180) lon -= 360;
    if (lon < -180) lon += 360;
    // Gentle curvature so arcs read as flights rather than straight lines.
    const lift = Math.sin(Math.PI * t) * Math.min(6, haversineMiles(a, b) / 550);
    points.push([lat + lift, lon]);
  }
  return points;
}
