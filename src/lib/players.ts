import { rngFor, gaussian, clamp } from "./rand";
import { TEAMS } from "./teams";
import type { Player } from "./types";

/**
 * Synthetic rosters.
 *
 * Player names are generated — they are NOT real NBA players. This keeps the
 * demo free of likeness/trademark issues and makes the mock provenance obvious.
 */
const FIRST = [
  "Andre", "Malik", "Devin", "Jalen", "Trey", "Cameron", "Isaiah", "Marcus", "Tyrese", "Omar",
  "Kellan", "Dante", "Josiah", "Miles", "Rashad", "Cole", "Amir", "Bryce", "Elijah", "Grant",
  "Hugo", "Ivan", "Jaxson", "Kobe", "Landon", "Mateo", "Nico", "Owen", "Pierce", "Quincy",
  "Rowan", "Silas", "Tobias", "Uriah", "Victor", "Wes", "Xavier", "Yusuf", "Zane", "Ari",
];

const LAST = [
  "Whitfield", "Okafor", "Brennan", "Castillo", "Duval", "Ellison", "Fontaine", "Grady", "Holloway",
  "Iverson", "Jennings", "Kowalski", "Langford", "Mercer", "Novak", "Osei", "Pemberton", "Quintero",
  "Rasmussen", "Sinclair", "Tavares", "Underwood", "Vance", "Winslow", "Yeboah", "Zeller", "Ashford",
  "Blakely", "Cortez", "Delgado", "Emerson", "Fairbanks", "Gill", "Hargrove", "Ishida", "Jaramillo",
  "Kensington", "Lindqvist", "Moreau", "Nakamura", "Ortega", "Prescott", "Reyes", "Santos", "Thibodeaux",
  "Ulloa", "Vasquez", "Whitaker", "Yates", "Zamora",
];

const POSITIONS: Player["position"][] = ["G", "G", "F", "F", "C", "G", "F", "C", "G-F", "F-C"];

const MINUTES = [35.2, 34.1, 32.8, 32.2, 30.6, 25.4, 22.8, 19.6, 15.2, 11.4];
const POINTS_PER_36 = [24.5, 21.2, 18.4, 15.8, 14.2, 15.6, 13.1, 11.4, 12.2, 8.6];
const BPM = [6.2, 4.6, 3.1, 2.2, 1.6, 0.7, -0.4, -1.1, -1.4, -2.2];

function heightFor(position: Player["position"], rng: () => number): number {
  const base =
    position === "G" ? 76 : position === "G-F" ? 78 : position === "F" ? 80 : position === "F-C" ? 82 : 84;
  return Math.round(base + (rng() - 0.5) * 4);
}

function buildRoster(teamId: string, strength: number): Player[] {
  const rng = rngFor(`roster:v2:${teamId}`);
  const usedNumbers = new Set<number>();
  const players: Player[] = [];
  const talent = 0.88 + (strength - 70) / 110;

  for (let i = 0; i < 10; i += 1) {
    let name = "";
    let guard = 0;
    do {
      name = `${FIRST[Math.floor(rng() * FIRST.length)]} ${LAST[Math.floor(rng() * LAST.length)]}`;
      guard += 1;
    } while (guard < 40 && players.some((p) => p.name === name));

    let number = Math.floor(rng() * 55);
    while (usedNumbers.has(number)) number = (number + 1) % 56;
    usedNumbers.add(number);

    const position = POSITIONS[i];
    const minutes = clamp(MINUTES[i] + gaussian(rng, 0, 2.2), 7, 39);
    players.push({
      id: `${teamId}-p${i + 1}`,
      teamId,
      name,
      position,
      number,
      age: Math.round(19 + rng() * 16),
      heightIn: heightFor(position, rng),
      minutesPerGame: Math.round(minutes * 10) / 10,
      pointsPer36: Math.round(POINTS_PER_36[i] * talent * 10) / 10,
      usage: Math.round((0.29 - i * 0.018 + gaussian(rng, 0, 0.01)) * 100) / 100,
      bpm: Math.round((BPM[i] + (talent - 1) * 4) * 10) / 10,
      starter: i < 5,
    });
  }
  return players;
}

export const PLAYERS: Player[] = TEAMS.flatMap((team) => buildRoster(team.id, team.strength));

export const PLAYER_BY_ID: Record<string, Player> = Object.fromEntries(
  PLAYERS.map((p) => [p.id, p]),
);

export function playersByTeam(teamId: string): Player[] {
  return PLAYERS.filter((p) => p.teamId === teamId);
}

export function getPlayer(id: string): Player | undefined {
  return PLAYER_BY_ID[id];
}

export function playerName(id: string): string {
  return PLAYER_BY_ID[id]?.name ?? id;
}

export function rosterMinutesLoad(teamId: string): number {
  const roster = playersByTeam(teamId).slice(0, 7);
  const avg = roster.reduce((sum, p) => sum + p.minutesPerGame, 0) / Math.max(1, roster.length);
  return Math.round(clamp((avg - 18) / 18, 0, 1) * 100) / 100;
}
