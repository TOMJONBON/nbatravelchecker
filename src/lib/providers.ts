import type { DataSourceStatus } from "./types";

/**
 * Provider registry. Every external dependency is optional: with no keys the
 * app runs on the synthetic engine and says so. `provenance` is never upgraded
 * without a successful, authenticated call.
 */
interface Config {
  id: string;
  name: string;
  category: DataSourceStatus["category"];
  envVar?: string;
  mode: DataSourceStatus["mode"];
  note: string;
  live?: boolean;
}

const CONFIGS: Config[] = [
  {
    id: "synthetic",
    name: "Synthetic engine (built-in)",
    category: "schedule",
    mode: "mock",
    note: "Deterministic schedule, scores, injuries and rosters. Active whenever no live provider is configured.",
  },
  {
    id: "balldontlie",
    name: "balldontlie",
    category: "schedule",
    envVar: "BALLDONTLIE_API_KEY",
    mode: "mock",
    note: "Adapter scaffolded (teams/games). With a key, requests are attempted and fall back to mock on error. Not exercised in this demo.",
  },
  {
    id: "sportsdataio",
    name: "SportsDataIO",
    category: "schedule",
    envVar: "SPORTSDATAIO_API_KEY",
    mode: "mock",
    note: "Paid provider for schedules, scores and injuries. Adapter not enabled in this build.",
  },
  {
    id: "sportradar",
    name: "Sportradar",
    category: "scores",
    envVar: "SPORTRADAR_API_KEY",
    mode: "mock",
    note: "Enterprise provider. Adapter not enabled in this build.",
  },
  {
    id: "odds",
    name: "The Odds API",
    category: "odds",
    envVar: "ODDS_API_KEY",
    mode: "mock",
    note: "Odds are an optional prediction input; none are consumed in the MVP.",
  },
  {
    id: "geo",
    name: "Static venue + airport coordinates",
    category: "geo",
    mode: "estimated",
    note: "30 arenas and airports with great-circle routing. No live flight or ADS-B data is used anywhere in the app.",
  },
  {
    id: "tiles",
    name: "OpenStreetMap raster tiles",
    category: "geo",
    envVar: "NEXT_PUBLIC_MAP_TILE_URL",
    mode: "live",
    note: "Basemap tiles load from the configured tile server in the browser. A no-tile vector mode is available offline.",
  },
  {
    id: "model",
    name: "Elo + fatigue model",
    category: "derived",
    mode: "mock",
    note: "Derived locally from the schedule. Backtested in-app against an Elo-only baseline.",
  },
];

export function providerStatuses(now = new Date()): DataSourceStatus[] {
  return CONFIGS.map((config) => ({
    id: config.id,
    name: config.name,
    category: config.category,
    configured: config.envVar ? Boolean(process.env[config.envVar]) : true,
    mode: config.envVar && !process.env[config.envVar] ? "mock" : config.mode,
    lastChecked: now.toISOString(),
    latencyMs: config.id === "tiles" ? null : 0,
    note: config.note,
    envVar: config.envVar,
  }));
}

export function isLiveConfigured(): boolean {
  return Boolean(
    process.env.BALLDONTLIE_API_KEY ||
      process.env.SPORTSDATAIO_API_KEY ||
      process.env.SPORTRADAR_API_KEY,
  );
}

export function forceMock(): boolean {
  return process.env.FORCE_MOCK_DATA === "true";
}
