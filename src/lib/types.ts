/**
 * Domain types for NBA Travel Tracker.
 *
 * Units: miles are statute miles (great-circle between airports), heights in
 * inches, scores in points, probabilities in [0,1], dates in ISO-8601.
 */

/** Contract every data widget must satisfy (see /status and ProvenanceBadge). */
export type Provenance = "live" | "cached" | "estimated" | "mock";

export interface DataMeta {
  provenance: Provenance;
  /** Human readable provider label, e.g. "balldontlie" or "synthetic engine". */
  source: string;
  /** ISO timestamp of the last successful refresh of this payload. */
  updatedAt: string;
  note?: string;
}

export type Conference = "East" | "West";

export type TravelStatus =
  | "home"
  | "traveling"
  | "road_trip"
  | "back_to_back"
  | "rest_day";

export interface TeamColors {
  primary: string;
  secondary: string;
}

export interface Venue {
  name: string;
  city: string;
  lat: number;
  lon: number;
  /** Feet above sea level. Used for altitude splits (Denver / Salt Lake City). */
  altitudeFt: number;
}

export interface Team {
  id: string;
  name: string;
  nickname: string;
  city: string;
  abbreviation: string;
  conference: Conference;
  division: string;
  colors: TeamColors;
  arena: Venue;
  airport: { code: string; name: string; lat: number; lon: number };
  /** IANA zone, e.g. "America/Denver". */
  timezone: string;
  /** Standard (non-DST) UTC offset in hours, used for time-zone-crossing math. */
  utcOffset: number;
  altitudeFt: number;
  /** Approximate 2026-27 roster strength prior (0-100), seeds the Elo model. */
  strength: number;
}

export interface Player {
  id: string;
  teamId: string;
  name: string;
  position: "G" | "F" | "C" | "G-F" | "F-C";
  number: number;
  age: number;
  heightIn: number;
  /** Season-long baseline minutes per game. 0 when the source has no stats. */
  minutesPerGame: number;
  /** Points per 36 minutes baseline. */
  pointsPer36: number;
  usage: number;
  /** Box plus/minus style impact per 100 possessions, used for injury impact. */
  bpm: number;
  starter: boolean;
  /** ESPN athlete id when the roster came from the live provider. */
  espnId?: string;
  headshot?: string;
  /** False when the provider supplies identity but no season statistics. */
  statsKnown?: boolean;
}

export type GameStatus = "scheduled" | "live" | "final" | "postponed";
export type SeasonType = "preseason" | "regular" | "playoffs";
export type VenueType = "team" | "neutral" | "international";

export interface NeutralSite {
  name: string;
  city: string;
  lat: number;
  lon: number;
  note: string;
  /** Standard UTC offset for time-zone-crossing math. */
  utcOffset?: number;
}

export interface Game {
  id: string;
  seasonId: string;
  /** Local game date, YYYY-MM-DD (America/New_York reference calendar). */
  date: string;
  /** ISO tipoff timestamp. */
  tipoff: string;
  homeTeamId: string;
  awayTeamId: string;
  status: GameStatus;
  homeScore: number | null;
  awayScore: number | null;
  period: string | null;
  clock: string | null;
  venueType: VenueType;
  neutralSite?: NeutralSite;
  seasonType: SeasonType;
  postponedReason?: string;
  /** True when the game was replayed after postponement (kept for edge cases). */
  rescheduled?: boolean;
}

export interface TravelEndpoint {
  city: string;
  code: string;
  lat: number;
  lon: number;
  utcOffset: number;
}

export interface TravelLeg {
  id: string;
  teamId: string;
  gameId: string;
  from: TravelEndpoint;
  to: TravelEndpoint;
  /** Local date of travel (day before the game, or same day for short hops). */
  departDate: string;
  miles: number;
  /** Signed time-zone change (eastward positive). */
  timeZoneShift: number;
  /** All travel in this app is schedule-derived, never live flight tracking. */
  isEstimated: true;
  mode: "air";
  note?: string;
}

export type RoadTripStatus = "upcoming" | "active" | "completed";

export interface RoadTripStop {
  gameId: string;
  date: string;
  city: string;
  opponentId: string;
  /** True when this game is on the second night of a back-to-back. */
  backToBack: boolean;
  altitude: boolean;
}

export interface RoadTrip {
  id: string;
  teamId: string;
  seasonId: string;
  gameIds: string[];
  legs: TravelLeg[];
  cities: string[];
  stops: RoadTripStop[];
  startDate: string;
  endDate: string;
  totalMiles: number;
  timeZonesCrossed: number;
  backToBacks: number;
  altitudeGames: number;
  restDaysBetween: number[];
  status: RoadTripStatus;
  /** True for single-game road trips (1 away game between home stands). */
  singleGame: boolean;
}

export interface FatigueComponent {
  key: string;
  label: string;
  /** Raw value used in the score (already in display units). */
  value: number;
  /** 0-1 normalised sub-score. */
  normalized: number;
  weight: number;
  /** Points contributed to the 0-100 index. */
  points: number;
  detail: string;
}

export interface TeamTravelMetrics {
  teamId: string;
  asOf: string;
  fatigueIndex: number;
  fatigueBand: "fresh" | "manageable" | "elevated" | "high" | "severe";
  components: FatigueComponent[];
  status: TravelStatus;
  statusLabel: string;
  statusDetail: string;
  miles7: number;
  miles14: number;
  timeZones7: number;
  backToBacks7: number;
  altitudeGames7: number;
  games7: number;
  restDays: number;
  minutesLoad: number;
  trip: RoadTrip | null;
  nextGame: Game | null;
  nextOpponentId: string | null;
  lastGame: Game | null;
  roadRecord: TeamRecord;
  homeRecord: TeamRecord;
  last10: TeamRecord;
}

export interface TeamRecord {
  wins: number;
  losses: number;
  games: number;
  winPct: number;
  pointsFor: number;
  pointsAgainst: number;
  /** Rolling form: last 5 results, most recent last. */
  form: ("W" | "L")[];
}

export type ConfidenceLabel = "low" | "medium" | "high";

export interface PredictionFactor {
  key: string;
  label: string;
  /** Points added to the home margin (negative favours the away team). */
  impact: number;
  /** Human readable contribution, e.g. "+2.4 pts home". */
  detail: string;
  direction: "home" | "away" | "neutral";
}

export interface Prediction {
  gameId: string;
  date: string;
  homeTeamId: string;
  awayTeamId: string;
  predictedWinnerId: string;
  /** Probability the home team wins. */
  homeWinProbability: number;
  projectedHomeScore: number;
  projectedAwayScore: number;
  projectedMargin: number;
  confidence: ConfidenceLabel;
  confidenceReason: string;
  factors: PredictionFactor[];
  /** Elo-only baseline for the same game. */
  baseline: {
    model: string;
    homeWinProbability: number;
    predictedWinnerId: string;
    projectedMargin: number;
  };
  modelVersion: string;
  dataQuality: {
    gamesPlayedHome: number;
    gamesPlayedAway: number;
    injuriesKnown: boolean;
    note: string;
  };
  meta: DataMeta;
}

export interface PredictionRecord {
  prediction: Prediction;
  actualHomeScore: number;
  actualAwayScore: number;
  homeWon: boolean;
  winnerCorrect: boolean;
  brier: number;
  logLoss: number;
  baselineWinnerCorrect: boolean;
  baselineBrier: number;
}

export interface ModelReport {
  modelVersion: string;
  games: number;
  accuracy: number;
  baselineAccuracy: number;
  brier: number;
  baselineBrier: number;
  logLoss: number;
  calibration: { bucket: string; predicted: number; observed: number; count: number }[];
  windowStart: string;
  windowEnd: string;
  updatedAt: string;
  provenance: Provenance;
}

export interface PlayerGameLog {
  gameId: string;
  date: string;
  seasonId: string;
  opponentId: string;
  home: boolean;
  minutes: number;
  points: number;
  rebounds: number;
  assists: number;
  fgPct: number;
  fg3Pct: number;
  turnovers: number;
  plusMinus: number;
  restDays: number;
  backToBack: boolean;
  miles7: number;
  timeZones7: number;
  altitudeGame: boolean;
  opponentDefRating: number;
  available: boolean;
  note?: string;
}

export interface Split {
  key: string;
  label: string;
  n: number;
  /** Per-game means. */
  pts: number;
  min: number;
  fgPct: number;
  fg3Pct: number;
  tov: number;
  plusMinus: number;
  /** 95% CI half-width for points (mean). */
  ci: number;
}

export interface PlayerTravelImpact {
  playerId: string;
  teamId: string;
  seasonId: string;
  games: number;
  splits: {
    rest: Split[];
    backToBack: Split[];
    miles: Split[];
    timeZones: Split[];
    altitude: Split[];
    location: Split[];
  };
  travelImpactScore: number;
  impactLabel: string;
  explanation: string[];
  model: {
    n: number;
    r2: number;
    coefficients: { key: string; label: string; estimate: number; ci: number; unit: string }[];
    controls: string[];
    note: string;
  } | null;
  caveats: string[];
  meta: DataMeta;
}

export interface InjuryStatus {
  playerId: string;
  teamId: string;
  gameId?: string;
  status: "out" | "doubtful" | "questionable" | "probable" | "available";
  reason: string;
  updatedAt: string;
  provenance: Provenance;
}

export interface DataSourceStatus {
  id: string;
  name: string;
  category: "schedule" | "scores" | "injuries" | "odds" | "geo" | "derived";
  configured: boolean;
  mode: "live" | "cached" | "estimated" | "mock";
  lastChecked: string;
  latencyMs: number | null;
  note: string;
  envVar?: string;
}

export interface WatchlistItem {
  id: string;
  kind: "team" | "player";
  addedAt: string;
}

export interface Alert {
  id: string;
  kind: "road_trip" | "back_to_back" | "fatigue" | "injury" | "prediction";
  severity: "info" | "watch" | "high";
  title: string;
  body: string;
  teamId?: string;
  playerId?: string;
  gameId?: string;
  date: string;
  meta: DataMeta;
}
