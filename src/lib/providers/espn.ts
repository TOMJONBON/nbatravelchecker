/**
 * ESPN public NBA endpoints — the app's live data source.
 *
 * No API key is required, but these are public, undocumented endpoints: they
 * can change without notice and their terms of use are ESPN's, not ours. The
 * adapter is defensive (timeouts, retries, stale-on-error) and every consumer
 * falls back to the synthetic engine if a refresh fails.
 *
 * Nothing here is scraped HTML: only JSON endpoints used by ESPN's own clients.
 */
import { TEAM_BY_ID } from "@/lib/teams";
import { isoDateIn } from "@/lib/time";
import { espnYearFor } from "@/lib/seasons";
import type { Game, InjuryStatus, Player, Team } from "@/lib/types";

const SITE = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba";
const COMMON = "https://site.api.espn.com/apis/common/v3/sports/basketball/nba";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) NBA-Travel-Tracker/1.0";

/** ESPN team id → our team id (stable since 2002). */
export const ESPN_TO_TEAM: Record<string, string> = {
  "1": "atl",
  "2": "bos",
  "3": "nop",
  "4": "chi",
  "5": "cle",
  "6": "dal",
  "7": "den",
  "8": "det",
  "9": "gsw",
  "10": "hou",
  "11": "ind",
  "12": "lac",
  "13": "lal",
  "14": "mia",
  "15": "mil",
  "16": "min",
  "17": "bkn",
  "18": "nyk",
  "19": "orl",
  "20": "phi",
  "21": "phx",
  "22": "por",
  "23": "sac",
  "24": "sas",
  "25": "okc",
  "26": "uta",
  "27": "was",
  "28": "tor",
  "29": "mem",
  "30": "cha",
};

export const TEAM_TO_ESPN: Record<string, string> = Object.fromEntries(
  Object.entries(ESPN_TO_TEAM).map(([espn, team]) => [team, espn]),
);

/** Our season id → ESPN season year (2026-27 → 2027). */
export function seasonYear(seasonId: string): number {
  return espnYearFor(seasonId);
}

export function teamFromEspn(id: string | number | undefined | null): string | undefined {
  if (id === undefined || id === null) return undefined;
  return ESPN_TO_TEAM[String(id)];
}

const NEUTRAL_VENUES: Record<string, { city: string; lat: number; lon: number }> = {
  "Arena CDMX": { city: "Mexico City, MX", lat: 19.4042, lon: -99.0907 },
  "Mexico City Arena": { city: "Mexico City, MX", lat: 19.4042, lon: -99.0907 },
  "Accor Arena": { city: "Paris, FR", lat: 48.8385, lon: 2.3789 },
  "Etihad Arena": { city: "Abu Dhabi, AE", lat: 24.4672, lon: 54.3672 },
  "T-Mobile Arena": { city: "Las Vegas, NV", lat: 36.1027, lon: -115.1782 },
  "Sphere": { city: "Las Vegas, NV", lat: 36.1204, lon: -115.1614 },
};

// ─── HTTP with TTL cache, retries and stale-on-error ────────────────────────

interface CacheEntry {
  data: unknown;
  storedAt: number;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<unknown>>();
const health = new Map<
  string,
  { lastOk: number | null; lastError: string | null; latencyMs: number | null; requests: number; failures: number }
>();

function noteRequest(key: string, latencyMs: number, error?: string): void {
  const current = health.get(key) ?? {
    lastOk: null,
    lastError: null,
    latencyMs: null,
    requests: 0,
    failures: 0,
  };
  current.requests += 1;
  if (error) {
    current.lastError = error;
    current.failures += 1;
  } else {
    current.lastOk = Date.now();
    current.lastError = null;
    current.latencyMs = latencyMs;
  }
  health.set(key, current);
}

export function espnHealth(): Array<{
  key: string;
  lastOk: number | null;
  lastError: string | null;
  latencyMs: number | null;
  requests: number;
  failures: number;
}> {
  return [...health.entries()].map(([key, value]) => ({ key, ...value }));
}

async function fetchJson<T>(url: string, timeoutMs = 9000): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const started = Date.now();
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": UA, Accept: "application/json" },
        signal: AbortSignal.timeout(timeoutMs),
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = (await response.json()) as T;
      noteRequest(url, Date.now() - started);
      return data;
    } catch (error) {
      lastError = error;
      noteRequest(url, Date.now() - started, error instanceof Error ? error.message : String(error));
      if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 350));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function cached<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<{ data: T; cached: boolean; fetchedAt: number }> {
  const now = Date.now();
  const entry = cache.get(key) as CacheEntry | undefined;
  if (entry && entry.expiresAt > now) {
    return { data: entry.data as T, cached: true, fetchedAt: entry.storedAt };
  }

  const existing = inflight.get(key) as Promise<T> | undefined;
  if (existing) {
    const data = await existing;
    return { data, cached: false, fetchedAt: now };
  }

  const promise = loader()
    .then((data) => {
      cache.set(key, { data, storedAt: Date.now(), expiresAt: Date.now() + ttlMs });
      return data;
    })
    .catch((error) => {
      // Serve stale data rather than failing the page.
      if (entry) return entry.data as T;
      throw error;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, promise);
  const data = await promise;
  return { data, cached: false, fetchedAt: Date.now() };
}

export function clearEspnCache(): void {
  cache.clear();
}

// ─── Parsing helpers (exported for tests) ───────────────────────────────────

export function parseScore(score: unknown): number | null {
  if (score === null || score === undefined) return null;
  if (typeof score === "number") return Number.isFinite(score) ? score : null;
  if (typeof score === "string") {
    const value = Number(score);
    return Number.isFinite(value) ? value : null;
  }
  if (typeof score === "object" && score !== null && "value" in score) {
    const value = Number((score as { value?: unknown }).value);
    return Number.isFinite(value) ? value : null;
  }
  return null;
}

interface EspnStatus {
  clock?: number;
  displayClock?: string;
  period?: number;
  type?: { name?: string; state?: string; completed?: boolean; description?: string; detail?: string };
}

export function mapGameStatus(status: EspnStatus | undefined): {
  status: Game["status"];
  period: string | null;
  clock: string | null;
} {
  const typeName = status?.type?.name ?? "";
  const state = status?.type?.state ?? "";
  if (typeName.includes("POSTPONED") || typeName.includes("CANCELED")) {
    return { status: "postponed", period: null, clock: null };
  }
  if (state === "in") {
    const period = status?.period ?? 0;
    return {
      status: "live",
      period: period > 4 ? "OT" : `Q${period || 1}`,
      clock: status?.displayClock ?? null,
    };
  }
  if (state === "post" || status?.type?.completed) {
    return { status: "final", period: "Final", clock: null };
  }
  return { status: "scheduled", period: null, clock: null };
}

export function mapInjuryStatus(status: string | undefined): InjuryStatus["status"] {
  switch ((status ?? "").toLowerCase()) {
    case "out":
      return "out";
    case "doubtful":
      return "doubtful";
    case "questionable":
      return "questionable";
    case "day-to-day":
    case "day to day":
      return "questionable";
    case "probable":
      return "probable";
    default:
      return "questionable";
  }
}

export function normalizePosition(position: string | undefined): Player["position"] {
  switch ((position ?? "").toUpperCase()) {
    case "PG":
    case "SG":
    case "G":
      return "G";
    case "SF":
    case "PF":
    case "F":
      return "F";
    case "C":
      return "C";
    case "G-F":
      return "G-F";
    case "F-C":
      return "F-C";
    default:
      return "F";
  }
}

export interface RawGamelog {
  eventId: string;
  date: string;
  opponentTeamId: string | null;
  home: boolean;
  minutes: number;
  points: number;
  rebounds: number;
  assists: number;
  fgPct: number | null;
  fg3Pct: number | null;
  turnovers: number;
  teamId: string | null;
  seasonType: string;
}

export interface EspnGamelogPayload {
  labels?: string[];
  seasonTypes?: Array<{
    displayName?: string;
    categories?: Array<{
      displayName?: string;
      type?: string;
      events?: Array<{ eventId?: string; stats?: string[] }>;
    }>;
  }>;
  events?: Record<
    string,
    {
      gameDate?: string;
      atVs?: string;
      opponent?: { id?: string };
      homeTeamId?: string;
      awayTeamId?: string;
      team?: { id?: string };
    }
  >;
}

export function parseGamelog(payload: EspnGamelogPayload): RawGamelog[] {
  const labels = (payload.labels ?? []).map((label) => label.toUpperCase());
  const index = (name: string) => labels.indexOf(name);
  const minIdx = index("MIN");
  const ptsIdx = index("PTS");
  const rebIdx = index("REB");
  const astIdx = index("AST");
  const fgIdx = index("FG%");
  const fg3Idx = index("3P%");
  const toIdx = index("TO");

  const rows: RawGamelog[] = [];
  for (const seasonType of payload.seasonTypes ?? []) {
    for (const category of seasonType.categories ?? []) {
      if (category.type !== "event") continue;
      for (const event of category.events ?? []) {
        const eventId = event.eventId;
        const stats = event.stats ?? [];
        if (!eventId || stats.length === 0) continue;
        const meta = payload.events?.[eventId];
        const minutes = minIdx >= 0 ? Number(stats[minIdx]) : NaN;
        if (!Number.isFinite(minutes) || minutes <= 0) continue;

        const teamId = teamFromEspn(meta?.team?.id) ?? null;
        const opponentTeamId = teamFromEspn(meta?.opponent?.id) ?? null;
        const home = (meta?.atVs ?? "").toLowerCase() === "vs";
        const date = meta?.gameDate ? isoDateIn(new Date(meta.gameDate)) : "";

        rows.push({
          eventId,
          date,
          opponentTeamId,
          home,
          minutes,
          points: ptsIdx >= 0 ? Number(stats[ptsIdx]) || 0 : 0,
          rebounds: rebIdx >= 0 ? Number(stats[rebIdx]) || 0 : 0,
          assists: astIdx >= 0 ? Number(stats[astIdx]) || 0 : 0,
          fgPct: fgIdx >= 0 ? Number(stats[fgIdx]) || null : null,
          fg3Pct: fg3Idx >= 0 ? Number(stats[fg3Idx]) || null : null,
          turnovers: toIdx >= 0 ? Number(stats[toIdx]) || 0 : 0,
          teamId,
          seasonType: seasonType.displayName ?? category.displayName ?? "",
        });
      }
    }
  }
  return rows;
}

// ─── Schedules ──────────────────────────────────────────────────────────────

interface EspnCompetitor {
  id?: string;
  homeAway?: string;
  score?: unknown;
  team?: { id?: string; abbreviation?: string; displayName?: string };
}

interface EspnEvent {
  id?: string;
  date?: string;
  name?: string;
  seasonType?: { name?: string };
  competitions?: Array<{
    venue?: { fullName?: string; address?: { city?: string; state?: string; country?: string } };
    neutralSite?: boolean;
    competitors?: EspnCompetitor[];
    status?: EspnStatus;
  }>;
}

export function mapEventToGame(event: EspnEvent, seasonId: string): Game | null {
  const competition = event.competitions?.[0];
  const id = event.id;
  if (!competition || !id || !event.date) return null;

  const home = competition.competitors?.find((c) => c.homeAway === "home");
  const away = competition.competitors?.find((c) => c.homeAway === "away");
  const homeTeamId = teamFromEspn(home?.team?.id);
  const awayTeamId = teamFromEspn(away?.team?.id);
  if (!homeTeamId || !awayTeamId) return null;

  const { status, period, clock } = mapGameStatus(competition.status);
  const venueName = competition.venue?.fullName ?? "";
  const neutral = Boolean(competition.neutralSite);
  const international = Boolean(competition.venue?.address?.country && competition.venue.address.country !== "USA");
  const venueType: Game["venueType"] = neutral ? (international ? "international" : "neutral") : "team";

  const neutralVenue = NEUTRAL_VENUES[venueName];
  const homeTeam: Team = TEAM_BY_ID[homeTeamId];
  const neutralSite =
    neutral && venueType !== "team"
      ? {
          name: venueName || "Neutral site",
          city:
            neutralVenue?.city ??
            [competition.venue?.address?.city, competition.venue?.address?.state].filter(Boolean).join(", "),
          lat: neutralVenue?.lat ?? homeTeam.arena.lat,
          lon: neutralVenue?.lon ?? homeTeam.arena.lon,
          note: international
            ? "International neutral-site game. Venue coordinates are approximated."
            : "Neutral-site game: no home-court advantage is applied.",
          utcOffset: Math.round((neutralVenue?.lon ?? homeTeam.arena.lon) / 15),
        }
      : undefined;

  const date = isoDateIn(new Date(event.date));
  const seasonType = (event.seasonType?.name ?? "").toLowerCase().includes("playoff")
    ? "playoffs"
    : (event.seasonType?.name ?? "").toLowerCase().includes("preseason")
      ? "preseason"
      : "regular";

  return {
    id,
    seasonId,
    date,
    tipoff: new Date(event.date).toISOString(),
    homeTeamId,
    awayTeamId,
    status,
    homeScore: parseScore(home?.score),
    awayScore: parseScore(away?.score),
    period,
    clock,
    venueType,
    neutralSite,
    seasonType,
  };
}

export async function fetchTeamSchedule(teamId: string, seasonId: string): Promise<Game[]> {
  const espnId = TEAM_TO_ESPN[teamId];
  const year = seasonYear(seasonId);
  if (!espnId || !year) return [];
  const { data } = await cached(`schedule:${teamId}:${seasonId}`, 10 * 60_000, async () =>
    fetchJson<{ events?: EspnEvent[] }>(`${SITE}/teams/${espnId}/schedule?season=${year}`),
  );
  return (data.events ?? [])
    .map((event) => mapEventToGame(event, seasonId))
    .filter((game): game is Game => Boolean(game))
    .filter((game) => game.seasonType === "regular" || game.seasonType === "playoffs");
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await fn(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

export async function fetchSeasonSchedule(seasonId: string): Promise<Game[]> {
  const teamIds = Object.keys(TEAM_TO_ESPN);
  const byTeam = await mapLimit(teamIds, 6, (teamId) => fetchTeamSchedule(teamId, seasonId).catch(() => []));
  const seen = new Map<string, Game>();
  for (const games of byTeam) {
    for (const game of games) {
      if (!seen.has(game.id)) seen.set(game.id, game);
    }
  }
  return [...seen.values()].sort((a, b) => (a.tipoff < b.tipoff ? -1 : 1));
}

// ─── Live scoreboard ────────────────────────────────────────────────────────

export interface LivePatch {
  status: Game["status"];
  homeScore: number | null;
  awayScore: number | null;
  period: string | null;
  clock: string | null;
  detail: string | null;
}

export async function fetchScoreboard(dateISO: string): Promise<Map<string, LivePatch>> {
  const espnDate = dateISO.replaceAll("-", "");
  const { data } = await cached(`scoreboard:${espnDate}`, 15_000, async () =>
    fetchJson<{ events?: EspnEvent[] }>(`${SITE}/scoreboard?dates=${espnDate}`),
  );
  const map = new Map<string, LivePatch>();
  for (const event of data.events ?? []) {
    const competition = event.competitions?.[0];
    if (!event.id || !competition) continue;
    const { status, period, clock } = mapGameStatus(competition.status);
    const home = competition.competitors?.find((c) => c.homeAway === "home");
    const away = competition.competitors?.find((c) => c.homeAway === "away");
    map.set(event.id, {
      status,
      homeScore: parseScore(home?.score),
      awayScore: parseScore(away?.score),
      period,
      clock,
      detail: competition.status?.type?.detail ?? null,
    });
  }
  return map;
}

// ─── Injuries ───────────────────────────────────────────────────────────────

interface EspnInjuryPayload {
  injuries?: Array<{
    id?: string;
    displayName?: string;
    injuries?: Array<{
      status?: string;
      shortComment?: string;
      longComment?: string;
      date?: string;
      athlete?: { id?: string; displayName?: string };
    }>;
  }>;
}

export async function fetchInjuries(): Promise<InjuryStatus[]> {
  const { data } = await cached("injuries", 60_000, async () =>
    fetchJson<EspnInjuryPayload>(`${SITE}/injuries`),
  );
  const out: InjuryStatus[] = [];
  for (const team of data.injuries ?? []) {
    const teamId = teamFromEspn(team.id);
    if (!teamId) continue;
    for (const injury of team.injuries ?? []) {
      const playerId = injury.athlete?.id;
      if (!playerId) continue;
      out.push({
        playerId,
        teamId,
        status: mapInjuryStatus(injury.status),
        reason: (injury.shortComment || injury.longComment || injury.status || "Listed").slice(0, 180),
        updatedAt: injury.date ? new Date(injury.date).toISOString() : new Date().toISOString(),
        provenance: "live",
      });
    }
  }
  return out;
}

// ─── Rosters ────────────────────────────────────────────────────────────────

interface EspnAthlete {
  id?: string;
  fullName?: string;
  displayName?: string;
  jersey?: string;
  height?: number;
  age?: number;
  position?: { abbreviation?: string };
  headshot?: { href?: string };
}

export async function fetchRoster(teamId: string): Promise<Player[]> {
  const espnId = TEAM_TO_ESPN[teamId];
  if (!espnId) return [];
  const { data } = await cached(`roster:${teamId}`, 60 * 60_000, async () =>
    fetchJson<{ athletes?: EspnAthlete[] }>(`${SITE}/teams/${espnId}/roster`),
  );
  return (data.athletes ?? [])
    .filter((athlete) => athlete.id)
    .map((athlete) => ({
      id: String(athlete.id),
      espnId: String(athlete.id),
      teamId,
      name: athlete.fullName ?? athlete.displayName ?? `Player ${athlete.id}`,
      position: normalizePosition(athlete.position?.abbreviation),
      number: Number(athlete.jersey) || 0,
      age: athlete.age ?? 0,
      heightIn: athlete.height ?? 78,
      minutesPerGame: 0,
      pointsPer36: 0,
      usage: 0,
      bpm: 0,
      starter: false,
      statsKnown: false,
      headshot: athlete.headshot?.href,
    }));
}

export interface GamelogResult {
  logs: RawGamelog[];
  /** When the underlying payload was actually fetched (may be cached). */
  fetchedAt: number;
}

export async function fetchPlayerGamelog(
  athleteId: string,
  seasonId: string,
): Promise<GamelogResult> {
  const year = seasonYear(seasonId);
  if (!year) return { logs: [], fetchedAt: Date.now() };
  const { data, fetchedAt } = await cached(`gamelog:${athleteId}:${seasonId}`, 10 * 60_000, async () =>
    fetchJson<EspnGamelogPayload>(`${COMMON}/athletes/${athleteId}/gamelog?season=${year}`),
  );
  return { logs: parseGamelog(data), fetchedAt };
}

/** Fetch gamelogs for the given seasons and concatenate, de-duplicated by event id. */
export async function fetchPlayerHistory(
  athleteId: string,
  seasons: { current: string; previous: string },
): Promise<{
  logs: RawGamelog[];
  teamIds: string[];
  teamId: string | null;
  /** Oldest of the two cached payloads — the honest age of the sample. */
  fetchedAt: number;
}> {
  const empty: GamelogResult = { logs: [], fetchedAt: Date.now() };
  const [current, previous] = await Promise.all([
    fetchPlayerGamelog(athleteId, seasons.current).catch(() => empty),
    fetchPlayerGamelog(athleteId, seasons.previous).catch(() => empty),
  ]);
  const seen = new Set<string>();
  const logs: RawGamelog[] = [];
  for (const log of [...previous.logs, ...current.logs]) {
    if (seen.has(log.eventId)) continue;
    seen.add(log.eventId);
    logs.push(log);
  }
  const teamIds = [...new Set(logs.map((log) => log.teamId).filter(Boolean) as string[])];
  const latest = [...logs]
    .filter((log) => log.teamId && log.date)
    .sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  return {
    logs,
    teamIds,
    teamId: latest?.teamId ?? teamIds[0] ?? null,
    fetchedAt: Math.min(previous.fetchedAt, current.fetchedAt),
  };
}

export const LIVE_TTL_MS = {
  scoreboard: 15_000,
  injuries: 60_000,
  schedule: 10 * 60_000,
  roster: 60 * 60_000,
  gamelog: 30 * 60_000,
};
