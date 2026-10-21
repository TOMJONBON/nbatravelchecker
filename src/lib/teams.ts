import type { Team } from "./types";

/**
 * Static team / arena / airport seed data for all 30 NBA teams.
 *
 * Coordinates are real (arena and primary commercial airport). Altitudes are
 * approximate city elevations. `strength` is a *mock* 2026-27 prior used to seed
 * the Elo model — it is not a published rating.
 *
 * Nothing here is trademarked artwork: the UI uses abbreviation marks tinted with
 * team colours only.
 */
export const TEAMS: Team[] = [
  {
    id: "atl", name: "Atlanta Hawks", nickname: "Hawks", city: "Atlanta", abbreviation: "ATL",
    conference: "East", division: "Southeast", timezone: "America/New_York", utcOffset: -5, altitudeFt: 1050, strength: 74,
    colors: { primary: "#E03A3E", secondary: "#C1D32F" },
    arena: { name: "State Farm Arena", city: "Atlanta", lat: 33.7573, lon: -84.3963, altitudeFt: 1050 },
    airport: { code: "ATL", name: "Hartsfield-Jackson", lat: 33.6407, lon: -84.4277 },
  },
  {
    id: "bos", name: "Boston Celtics", nickname: "Celtics", city: "Boston", abbreviation: "BOS",
    conference: "East", division: "Atlantic", timezone: "America/New_York", utcOffset: -5, altitudeFt: 141, strength: 88,
    colors: { primary: "#007A33", secondary: "#BA9653" },
    arena: { name: "TD Garden", city: "Boston", lat: 42.3662, lon: -71.0621, altitudeFt: 141 },
    airport: { code: "BOS", name: "Logan International", lat: 42.3656, lon: -71.0096 },
  },
  {
    id: "bkn", name: "Brooklyn Nets", nickname: "Nets", city: "Brooklyn", abbreviation: "BKN",
    conference: "East", division: "Atlantic", timezone: "America/New_York", utcOffset: -5, altitudeFt: 30, strength: 69,
    colors: { primary: "#C9CDD1", secondary: "#1A1A1A" },
    arena: { name: "Barclays Center", city: "Brooklyn", lat: 40.6826, lon: -73.9754, altitudeFt: 30 },
    airport: { code: "JFK", name: "John F. Kennedy", lat: 40.6413, lon: -73.7781 },
  },
  {
    id: "cha", name: "Charlotte Hornets", nickname: "Hornets", city: "Charlotte", abbreviation: "CHA",
    conference: "East", division: "Southeast", timezone: "America/New_York", utcOffset: -5, altitudeFt: 751, strength: 69,
    colors: { primary: "#1D1160", secondary: "#00788C" },
    arena: { name: "Spectrum Center", city: "Charlotte", lat: 35.2251, lon: -80.8392, altitudeFt: 751 },
    airport: { code: "CLT", name: "Charlotte Douglas", lat: 35.2144, lon: -80.9473 },
  },
  {
    id: "chi", name: "Chicago Bulls", nickname: "Bulls", city: "Chicago", abbreviation: "CHI",
    conference: "East", division: "Central", timezone: "America/Chicago", utcOffset: -6, altitudeFt: 594, strength: 74,
    colors: { primary: "#CE1141", secondary: "#1A1A1A" },
    arena: { name: "United Center", city: "Chicago", lat: 41.8807, lon: -87.6742, altitudeFt: 594 },
    airport: { code: "ORD", name: "O'Hare International", lat: 41.9742, lon: -87.9073 },
  },
  {
    id: "cle", name: "Cleveland Cavaliers", nickname: "Cavaliers", city: "Cleveland", abbreviation: "CLE",
    conference: "East", division: "Central", timezone: "America/New_York", utcOffset: -5, altitudeFt: 653, strength: 84,
    colors: { primary: "#860038", secondary: "#FDBB30" },
    arena: { name: "Rocket Mortgage FieldHouse", city: "Cleveland", lat: 41.4965, lon: -81.6882, altitudeFt: 653 },
    airport: { code: "CLE", name: "Hopkins International", lat: 41.4117, lon: -81.8498 },
  },
  {
    id: "dal", name: "Dallas Mavericks", nickname: "Mavericks", city: "Dallas", abbreviation: "DAL",
    conference: "West", division: "Southwest", timezone: "America/Chicago", utcOffset: -6, altitudeFt: 430, strength: 79,
    colors: { primary: "#00538C", secondary: "#B8C4CA" },
    arena: { name: "American Airlines Center", city: "Dallas", lat: 32.7905, lon: -96.8103, altitudeFt: 430 },
    airport: { code: "DFW", name: "Dallas/Fort Worth", lat: 32.8998, lon: -97.0403 },
  },
  {
    id: "den", name: "Denver Nuggets", nickname: "Nuggets", city: "Denver", abbreviation: "DEN",
    conference: "West", division: "Northwest", timezone: "America/Denver", utcOffset: -7, altitudeFt: 5280, strength: 88,
    colors: { primary: "#FEC524", secondary: "#0E2240" },
    arena: { name: "Ball Arena", city: "Denver", lat: 39.7487, lon: -105.0077, altitudeFt: 5280 },
    airport: { code: "DEN", name: "Denver International", lat: 39.8561, lon: -104.6737 },
  },
  {
    id: "det", name: "Detroit Pistons", nickname: "Pistons", city: "Detroit", abbreviation: "DET",
    conference: "East", division: "Central", timezone: "America/New_York", utcOffset: -5, altitudeFt: 600, strength: 73,
    colors: { primary: "#C8102E", secondary: "#1D42BA" },
    arena: { name: "Little Caesars Arena", city: "Detroit", lat: 42.3411, lon: -83.0553, altitudeFt: 600 },
    airport: { code: "DTW", name: "Detroit Metro Wayne County", lat: 42.2162, lon: -83.3554 },
  },
  {
    id: "gsw", name: "Golden State Warriors", nickname: "Warriors", city: "San Francisco", abbreviation: "GSW",
    conference: "West", division: "Pacific", timezone: "America/Los_Angeles", utcOffset: -8, altitudeFt: 13, strength: 80,
    colors: { primary: "#1D428A", secondary: "#FFC72C" },
    arena: { name: "Chase Center", city: "San Francisco", lat: 37.768, lon: -122.3877, altitudeFt: 13 },
    airport: { code: "SFO", name: "San Francisco International", lat: 37.6213, lon: -122.379 },
  },
  {
    id: "hou", name: "Houston Rockets", nickname: "Rockets", city: "Houston", abbreviation: "HOU",
    conference: "West", division: "Southwest", timezone: "America/Chicago", utcOffset: -6, altitudeFt: 50, strength: 77,
    colors: { primary: "#CE1141", secondary: "#C4CED4" },
    arena: { name: "Toyota Center", city: "Houston", lat: 29.7508, lon: -95.3621, altitudeFt: 50 },
    airport: { code: "IAH", name: "George Bush Intercontinental", lat: 29.9902, lon: -95.3368 },
  },
  {
    id: "ind", name: "Indiana Pacers", nickname: "Pacers", city: "Indianapolis", abbreviation: "IND",
    conference: "East", division: "Central", timezone: "America/Indiana/Indianapolis", utcOffset: -5, altitudeFt: 715, strength: 82,
    colors: { primary: "#FDBB30", secondary: "#002D62" },
    arena: { name: "Gainbridge Fieldhouse", city: "Indianapolis", lat: 39.764, lon: -86.1555, altitudeFt: 715 },
    airport: { code: "IND", name: "Indianapolis International", lat: 39.7173, lon: -86.2944 },
  },
  {
    id: "lac", name: "LA Clippers", nickname: "Clippers", city: "Inglewood", abbreviation: "LAC",
    conference: "West", division: "Pacific", timezone: "America/Los_Angeles", utcOffset: -8, altitudeFt: 100, strength: 76,
    colors: { primary: "#C8102E", secondary: "#1D428A" },
    arena: { name: "Intuit Dome", city: "Inglewood", lat: 33.958, lon: -118.341, altitudeFt: 100 },
    airport: { code: "LAX", name: "Los Angeles International", lat: 33.9416, lon: -118.4085 },
  },
  {
    id: "lal", name: "Los Angeles Lakers", nickname: "Lakers", city: "Los Angeles", abbreviation: "LAL",
    conference: "West", division: "Pacific", timezone: "America/Los_Angeles", utcOffset: -8, altitudeFt: 285, strength: 81,
    colors: { primary: "#552583", secondary: "#FDB927" },
    arena: { name: "Crypto.com Arena", city: "Los Angeles", lat: 34.043, lon: -118.2673, altitudeFt: 285 },
    airport: { code: "LAX", name: "Los Angeles International", lat: 33.9416, lon: -118.4085 },
  },
  {
    id: "mem", name: "Memphis Grizzlies", nickname: "Grizzlies", city: "Memphis", abbreviation: "MEM",
    conference: "West", division: "Southwest", timezone: "America/Chicago", utcOffset: -6, altitudeFt: 246, strength: 76,
    colors: { primary: "#5D76A9", secondary: "#12173F" },
    arena: { name: "FedExForum", city: "Memphis", lat: 35.1385, lon: -90.0506, altitudeFt: 246 },
    airport: { code: "MEM", name: "Memphis International", lat: 35.0424, lon: -89.9767 },
  },
  {
    id: "mia", name: "Miami Heat", nickname: "Heat", city: "Miami", abbreviation: "MIA",
    conference: "East", division: "Southeast", timezone: "America/New_York", utcOffset: -5, altitudeFt: 6, strength: 78,
    colors: { primary: "#98002E", secondary: "#F9A01B" },
    arena: { name: "Kaseya Center", city: "Miami", lat: 25.7814, lon: -80.187, altitudeFt: 6 },
    airport: { code: "MIA", name: "Miami International", lat: 25.7959, lon: -80.287 },
  },
  {
    id: "mil", name: "Milwaukee Bucks", nickname: "Bucks", city: "Milwaukee", abbreviation: "MIL",
    conference: "East", division: "Central", timezone: "America/Chicago", utcOffset: -6, altitudeFt: 617, strength: 80,
    colors: { primary: "#00471B", secondary: "#EEE1C6" },
    arena: { name: "Fiserv Forum", city: "Milwaukee", lat: 43.0451, lon: -87.9172, altitudeFt: 617 },
    airport: { code: "MKE", name: "Mitchell International", lat: 42.9472, lon: -87.8966 },
  },
  {
    id: "min", name: "Minnesota Timberwolves", nickname: "Timberwolves", city: "Minneapolis", abbreviation: "MIN",
    conference: "West", division: "Northwest", timezone: "America/Chicago", utcOffset: -6, altitudeFt: 830, strength: 83,
    colors: { primary: "#78BE20", secondary: "#0C2340" },
    arena: { name: "Target Center", city: "Minneapolis", lat: 44.9795, lon: -93.2761, altitudeFt: 830 },
    airport: { code: "MSP", name: "Minneapolis-St. Paul", lat: 44.8848, lon: -93.2223 },
  },
  {
    id: "nop", name: "New Orleans Pelicans", nickname: "Pelicans", city: "New Orleans", abbreviation: "NOP",
    conference: "West", division: "Southwest", timezone: "America/Chicago", utcOffset: -6, altitudeFt: 3, strength: 72,
    colors: { primary: "#0C2340", secondary: "#85714D" },
    arena: { name: "Smoothie King Center", city: "New Orleans", lat: 29.949, lon: -90.0821, altitudeFt: 3 },
    airport: { code: "MSY", name: "Louis Armstrong International", lat: 29.9934, lon: -90.258 },
  },
  {
    id: "nyk", name: "New York Knicks", nickname: "Knicks", city: "New York", abbreviation: "NYK",
    conference: "East", division: "Atlantic", timezone: "America/New_York", utcOffset: -5, altitudeFt: 33, strength: 85,
    colors: { primary: "#006BB6", secondary: "#F58426" },
    arena: { name: "Madison Square Garden", city: "New York", lat: 40.7505, lon: -73.9934, altitudeFt: 33 },
    airport: { code: "LGA", name: "LaGuardia", lat: 40.7769, lon: -73.874 },
  },
  {
    id: "okc", name: "Oklahoma City Thunder", nickname: "Thunder", city: "Oklahoma City", abbreviation: "OKC",
    conference: "West", division: "Northwest", timezone: "America/Chicago", utcOffset: -6, altitudeFt: 1201, strength: 90,
    colors: { primary: "#007AC1", secondary: "#EF3B24" },
    arena: { name: "Paycom Center", city: "Oklahoma City", lat: 35.4634, lon: -97.5151, altitudeFt: 1201 },
    airport: { code: "OKC", name: "Will Rogers World", lat: 35.3931, lon: -97.6007 },
  },
  {
    id: "orl", name: "Orlando Magic", nickname: "Magic", city: "Orlando", abbreviation: "ORL",
    conference: "East", division: "Southeast", timezone: "America/New_York", utcOffset: -5, altitudeFt: 82, strength: 77,
    colors: { primary: "#0077C0", secondary: "#C4CED4" },
    arena: { name: "Kia Center", city: "Orlando", lat: 28.5392, lon: -81.3839, altitudeFt: 82 },
    airport: { code: "MCO", name: "Orlando International", lat: 28.4312, lon: -81.3081 },
  },
  {
    id: "phi", name: "Philadelphia 76ers", nickname: "76ers", city: "Philadelphia", abbreviation: "PHI",
    conference: "East", division: "Atlantic", timezone: "America/New_York", utcOffset: -5, altitudeFt: 39, strength: 78,
    colors: { primary: "#006BB6", secondary: "#ED174C" },
    arena: { name: "Wells Fargo Center", city: "Philadelphia", lat: 39.9012, lon: -75.172, altitudeFt: 39 },
    airport: { code: "PHL", name: "Philadelphia International", lat: 39.8744, lon: -75.2424 },
  },
  {
    id: "phx", name: "Phoenix Suns", nickname: "Suns", city: "Phoenix", abbreviation: "PHX",
    conference: "West", division: "Pacific", timezone: "America/Phoenix", utcOffset: -7, altitudeFt: 1086, strength: 78,
    colors: { primary: "#E56020", secondary: "#1D1160" },
    arena: { name: "Footprint Center", city: "Phoenix", lat: 33.4457, lon: -112.0712, altitudeFt: 1086 },
    airport: { code: "PHX", name: "Sky Harbor International", lat: 33.4342, lon: -112.0116 },
  },
  {
    id: "por", name: "Portland Trail Blazers", nickname: "Trail Blazers", city: "Portland", abbreviation: "POR",
    conference: "West", division: "Northwest", timezone: "America/Los_Angeles", utcOffset: -8, altitudeFt: 50, strength: 71,
    colors: { primary: "#E03A3E", secondary: "#1A1A1A" },
    arena: { name: "Moda Center", city: "Portland", lat: 45.5316, lon: -122.6668, altitudeFt: 50 },
    airport: { code: "PDX", name: "Portland International", lat: 45.5898, lon: -122.5951 },
  },
  {
    id: "sac", name: "Sacramento Kings", nickname: "Kings", city: "Sacramento", abbreviation: "SAC",
    conference: "West", division: "Pacific", timezone: "America/Los_Angeles", utcOffset: -8, altitudeFt: 25, strength: 75,
    colors: { primary: "#5A2D81", secondary: "#63727A" },
    arena: { name: "Golden 1 Center", city: "Sacramento", lat: 38.5802, lon: -121.4997, altitudeFt: 25 },
    airport: { code: "SMF", name: "Sacramento International", lat: 38.6954, lon: -121.5908 },
  },
  {
    id: "sas", name: "San Antonio Spurs", nickname: "Spurs", city: "San Antonio", abbreviation: "SAS",
    conference: "West", division: "Southwest", timezone: "America/Chicago", utcOffset: -6, altitudeFt: 650, strength: 74,
    colors: { primary: "#C4CED4", secondary: "#1A1A1A" },
    arena: { name: "Frost Bank Center", city: "San Antonio", lat: 29.427, lon: -98.4375, altitudeFt: 650 },
    airport: { code: "SAT", name: "San Antonio International", lat: 29.5337, lon: -98.4698 },
  },
  {
    id: "tor", name: "Toronto Raptors", nickname: "Raptors", city: "Toronto", abbreviation: "TOR",
    conference: "East", division: "Atlantic", timezone: "America/Toronto", utcOffset: -5, altitudeFt: 249, strength: 71,
    colors: { primary: "#CE1141", secondary: "#1A1A1A" },
    arena: { name: "Scotiabank Arena", city: "Toronto", lat: 43.6435, lon: -79.3791, altitudeFt: 249 },
    airport: { code: "YYZ", name: "Toronto Pearson", lat: 43.6777, lon: -79.6248 },
  },
  {
    id: "uta", name: "Utah Jazz", nickname: "Jazz", city: "Salt Lake City", abbreviation: "UTA",
    conference: "West", division: "Northwest", timezone: "America/Denver", utcOffset: -7, altitudeFt: 4226, strength: 68,
    colors: { primary: "#F9A01B", secondary: "#002B5C" },
    arena: { name: "Delta Center", city: "Salt Lake City", lat: 40.7683, lon: -111.9011, altitudeFt: 4226 },
    airport: { code: "SLC", name: "Salt Lake City International", lat: 40.7899, lon: -111.9798 },
  },
  {
    id: "was", name: "Washington Wizards", nickname: "Wizards", city: "Washington", abbreviation: "WAS",
    conference: "East", division: "Southeast", timezone: "America/New_York", utcOffset: -5, altitudeFt: 25, strength: 66,
    colors: { primary: "#E31837", secondary: "#002B5C" },
    arena: { name: "Capital One Arena", city: "Washington", lat: 38.8981, lon: -77.0209, altitudeFt: 25 },
    airport: { code: "DCA", name: "Ronald Reagan Washington National", lat: 38.8521, lon: -77.0377 },
  },
];

export const TEAM_BY_ID: Record<string, Team> = Object.fromEntries(
  TEAMS.map((t) => [t.id, t]),
);

export const TEAM_IDS = TEAMS.map((t) => t.id);

export function getTeam(id: string): Team | undefined {
  return TEAM_BY_ID[id];
}

export function teamName(id: string): string {
  return TEAM_BY_ID[id]?.name ?? id.toUpperCase();
}

/** Venues above ~4,000 ft are treated as altitude games (Denver, Salt Lake City). */
export const ALTITUDE_THRESHOLD_FT = 4000;

export function isAltitude(venue: {
  altitudeFt?: number;
  arena?: { altitudeFt?: number };
}): boolean {
  const ft = venue.arena?.altitudeFt ?? venue.altitudeFt ?? 0;
  return ft >= ALTITUDE_THRESHOLD_FT;
}
