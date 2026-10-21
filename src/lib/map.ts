import type { DataMeta, Game, Prediction, RoadTrip, Team, TeamTravelMetrics } from "./types";

export interface MapTeamPoint {
  team: Team;
  metrics: TeamTravelMetrics;
  nextGame: Game | null;
}

export interface MapTrip {
  teamId: string;
  trip: RoadTrip;
  prediction: Prediction | null;
  game: Game | null;
}

export interface MapPayload {
  date: string;
  teams: MapTeamPoint[];
  trips: MapTrip[];
  meta: DataMeta;
}

export type MapStatusFilter = "all" | "active" | "upcoming" | "completed";
