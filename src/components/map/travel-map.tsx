"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Layers,
  Loader2,
  MapPin,
  Pause,
  Play,
  Share2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui";
import { FatigueGauge, MetaLine, PredictionCard, TeamMark } from "@/components/domain";
import { TEAMS, TEAM_BY_ID } from "@/lib/teams";
import { addDays, monthDayLabel, weekdayLabel } from "@/lib/time";
import { formatMiles } from "@/lib/utils";
import type { MapPayload, MapStatusFilter } from "@/lib/map";

const MapCanvas = dynamic(() => import("./map-canvas"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full w-full place-items-center bg-ink-900">
      <div className="flex items-center gap-2 text-xs text-mist-400">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Loading map…
      </div>
    </div>
  ),
});

const STATUSES: { key: MapStatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "upcoming", label: "Upcoming" },
  { key: "completed", label: "Completed" },
];

export function TravelMap({
  initialPayload,
  initialDate,
  initialTeam,
  serverToday,
}: {
  initialPayload: MapPayload;
  initialDate: string;
  initialTeam: string | null;
  serverToday: string;
}) {
  const router = useRouter();
  const [date, setDate] = useState(initialDate);
  const [teamId, setTeamId] = useState<string | null>(initialTeam);
  const [status, setStatus] = useState<MapStatusFilter>("all");
  const [showTiles, setShowTiles] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [copied, setCopied] = useState(false);
  const reduceMotion = useReducedMotion();
  const mobilePanelRef = useRef<HTMLDivElement>(null);

  const today = serverToday;
  const minDate = addDays(today, -3);
  const maxDate = addDays(today, 10);
  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => addDays(minDate, i)), [minDate]);

  // When the server's day rolls over, move the default view with it instead of
  // staying on yesterday. A user-picked date is kept until midnight.
  useEffect(() => {
    setDate(initialDate);
  }, [initialDate]);

  const { data, isFetching, isError } = useQuery<MapPayload>({
    queryKey: ["map", date, teamId],
    queryFn: async () => {
      const params = new URLSearchParams({ date });
      if (teamId) params.set("team", teamId);
      const res = await fetch(`/api/map/travel?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load travel map");
      const json = (await res.json()) as { data: MapPayload };
      return json.data;
    },
    initialData: date === initialDate && teamId === initialTeam ? initialPayload : undefined,
    refetchInterval: 20_000,
  });

  const payload = data ?? initialPayload;
  const selected = payload.teams.find((t) => t.team.id === teamId) ?? null;
  const selectedTrips = payload.trips.filter((t) => t.teamId === teamId);
  const activeTrip =
    selectedTrips.find((t) => t.trip.status === "active") ??
    selectedTrips.find((t) => t.trip.status === "upcoming") ??
    selectedTrips[0];

  useEffect(() => {
    const params = new URLSearchParams();
    if (date !== today) params.set("date", date);
    if (teamId) params.set("team", teamId);
    const query = params.toString();
    router.replace(`/map${query ? `?${query}` : ""}`, { scroll: false });
  }, [date, teamId, router, today]);

  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      setDate((current) => {
        const next = addDays(current, 1);
        if (next > maxDate) {
          setPlaying(false);
          return current;
        }
        return next;
      });
    }, 1400);
    return () => clearInterval(timer);
  }, [playing, maxDate]);

  useEffect(() => {
    if (!teamId) return;
    if (typeof window === "undefined" || window.innerWidth >= 1024) return;
    mobilePanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [teamId]);

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const tripCount = payload.trips.filter((t) => status === "all" || t.trip.status === status).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="label-xs mb-1.5 flex items-center gap-1.5">
            <MapPin className="size-3" aria-hidden /> Interactive travel map
          </p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Follow the flights</h1>
          <p className="mt-1.5 max-w-xl text-sm text-mist-400">
            {tripCount} road trips in the selected window · every route is an estimate from schedule city changes.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <MetaLine meta={payload.meta} />
          <button
            type="button"
            onClick={share}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--hairline)] bg-white/[0.03] px-2.5 text-[11px] font-semibold text-mist-300 hover:text-mist-100"
          >
            {copied ? <Check className="size-3.5 text-mint-300" aria-hidden /> : <Share2 className="size-3.5" aria-hidden />}
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-3">
          <div className="glass flex flex-wrap items-center gap-2 rounded-2xl px-3 py-2.5">
            <label className="sr-only" htmlFor="team-filter">
              Filter by team
            </label>
            <select
              id="team-filter"
              value={teamId ?? ""}
              onChange={(event) => setTeamId(event.target.value || null)}
              className="h-8 min-w-[132px] rounded-lg border border-[var(--hairline)] bg-ink-900 px-2 text-xs font-medium text-mist-200"
            >
              <option value="">All 30 teams</option>
              {TEAMS.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.abbreviation} · {team.nickname}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-1 rounded-lg border border-[var(--hairline)] bg-white/[0.02] px-1 py-0.5">
              {STATUSES.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setStatus(item.key)}
                  aria-pressed={status === item.key}
                  className={
                    status === item.key
                      ? "rounded-md bg-mint-400/15 px-2 py-1 text-[11px] font-semibold text-mint-300"
                      : "rounded-md px-2 py-1 text-[11px] font-medium text-mist-500 hover:text-mist-200"
                  }
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowTiles((v) => !v)}
                aria-pressed={showTiles}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--hairline)] bg-white/[0.03] px-2.5 text-[11px] font-semibold text-mist-300 hover:text-mist-100"
              >
                <Layers className="size-3.5" aria-hidden />
                {showTiles ? "Basemap on" : "No-token mode"}
              </button>
            </div>
          </div>

          <div className="glass relative overflow-hidden rounded-2xl">
            <div className="h-[58vh] min-h-[380px] w-full lg:h-[calc(100dvh-268px)] lg:min-h-[520px]">
              <MapCanvas
                payload={payload}
                selectedTeamId={teamId}
                onSelect={(id) => setTeamId(id)}
                showTiles={showTiles}
                statusFilter={status}
              />
            </div>

            {isFetching ? (
              <div className="absolute right-3 top-3 z-[500] flex items-center gap-1.5 rounded-lg bg-ink-950/80 px-2 py-1 text-[10px] text-mist-300">
                <Loader2 className="size-3 animate-spin" aria-hidden /> Updating
              </div>
            ) : null}

            <div className="pointer-events-none absolute bottom-3 left-3 z-[500] rounded-xl border border-[var(--hairline)] bg-ink-950/80 px-3 py-2 text-[10px] text-mist-400 backdrop-blur">
              <div className="flex items-center gap-2">
                <span className="inline-block h-px w-5 border-t-2 border-dashed border-mint-300" aria-hidden />
                Estimated route
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span className="inline-block size-2 rounded-full bg-iris-300" aria-hidden />
                Team location
              </div>
              <p className="mt-1 text-[9px] text-mist-600">No live flight tracking.</p>
            </div>

            {isError ? (
              <div className="absolute inset-x-3 top-3 z-[500] rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-[11px] text-rose-200">
                Could not refresh travel data. Showing the last successful payload.
              </div>
            ) : null}
          </div>

          <div className="glass rounded-2xl px-3 py-2.5">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPlaying((p) => !p)}
                aria-label={playing ? "Pause timeline" : "Play timeline"}
                className="grid size-8 shrink-0 place-items-center rounded-full bg-mint-400 text-ink-950 hover:bg-mint-300"
              >
                {playing ? <Pause className="size-3.5" aria-hidden /> : <Play className="size-3.5" aria-hidden />}
              </button>
              <button
                type="button"
                onClick={() => setDate((d) => addDays(d, -1))}
                aria-label="Previous day"
                className="grid size-7 place-items-center rounded-md text-mist-400 hover:text-mist-100"
              >
                <ChevronLeft className="size-4" aria-hidden />
              </button>
              <label htmlFor="timeline" className="sr-only">
                Travel timeline date
              </label>
              <input
                id="timeline"
                type="range"
                min={0}
                max={days.length - 1}
                step={1}
                value={Math.max(0, days.indexOf(date))}
                onChange={(event) => setDate(days[Number(event.target.value)] ?? date)}
                className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-white/10 accent-mint-400"
              />
              <button
                type="button"
                onClick={() => setDate((d) => addDays(d, 1))}
                aria-label="Next day"
                className="grid size-7 place-items-center rounded-md text-mist-400 hover:text-mist-100"
              >
                <ChevronRight className="size-4" aria-hidden />
              </button>
              <div className="w-[92px] shrink-0 text-right">
                <p className="num text-[11px] font-semibold text-mist-200">
                  {weekdayLabel(date)} {monthDayLabel(date)}
                </p>
                <p className="text-[9px] text-mist-500">{date}</p>
              </div>
            </div>
            <div className="mt-1.5 flex justify-between px-9 text-[9px] text-mist-600">
              {[0, 4, 8, days.length - 1].map((index) => (
                <span key={index}>{monthDayLabel(days[index])}</span>
              ))}
            </div>
          </div>

          {selected ? (
            <motion.div
              ref={mobilePanelRef}
              initial={reduceMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
              className="glass scroll-mt-24 rounded-2xl p-4 lg:hidden"
            >
              <PanelContent
                selected={selected}
                activeTrip={activeTrip}
                payload={payload}
                onClose={() => setTeamId(null)}
              />
            </motion.div>
          ) : null}
        </div>

        <aside>
          <div className="glass hidden h-full rounded-2xl p-4 lg:block">
            <PanelContent
              selected={selected}
              activeTrip={activeTrip}
              payload={payload}
              onClose={() => setTeamId(null)}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}

function PanelContent({
  selected,
  activeTrip,
  payload,
  onClose,
}: {
  selected: MapPayload["teams"][number] | null;
  activeTrip: MapPayload["trips"][number] | undefined;
  payload: MapPayload;
  onClose: () => void;
}) {
  if (!selected) {
    const busiest = [...payload.trips]
      .sort((a, b) => b.trip.totalMiles - a.trip.totalMiles)
      .slice(0, 5);
    return (
      <div>
        <p className="label-xs">Trip detail</p>
        <p className="mt-2 text-sm font-semibold text-mist-200">Select a team on the map</p>
        <p className="mt-1 text-[11px] leading-relaxed text-mist-500">
          Click any marker or route to see the itinerary, miles, fatigue and the projection for the next game.
        </p>
        <div className="mt-4 space-y-1.5">
          <p className="label-xs mb-1">Longest trips in view</p>
          {busiest.map(({ teamId, trip }) => {
            const team = TEAM_BY_ID[teamId];
            return (
              <div key={trip.id} className="flex items-center gap-2 rounded-lg bg-white/[0.03] px-2 py-1.5">
                <TeamMark team={team} size="xs" />
                <span className="text-[11px] font-medium text-mist-300">{team.abbreviation}</span>
                <span className="ml-auto num text-[10px] text-mist-500">{formatMiles(trip.totalMiles)}</span>
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-[10px] leading-relaxed text-mist-600">
          Routes are great-circle estimates between airports. Neutral-site and international games use the venue city.
        </p>
      </div>
    );
  }

  const { team, metrics, nextGame } = selected;
  const trip = activeTrip?.trip ?? null;
  const prediction = activeTrip?.prediction ?? null;
  const opponent = nextGame
    ? TEAM_BY_ID[nextGame.homeTeamId === team.id ? nextGame.awayTeamId : nextGame.homeTeamId]
    : null;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2.5">
        <TeamMark team={team} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-mist-50">{team.name}</p>
          <p className="text-[10px] uppercase tracking-[0.12em] text-mist-500">
            {team.arena.name} · {team.city}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close team panel"
          className="grid size-7 place-items-center rounded-md text-mist-500 hover:text-mist-100"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--hairline)] bg-white/[0.02] px-3 py-2">
        <FatigueGauge value={metrics.fatigueIndex} band={metrics.fatigueBand} size={104} />
        <div className="space-y-1 text-right">
          <Badge tone={metrics.status === "back_to_back" ? "danger" : metrics.status === "road_trip" ? "amber" : "mint"}>
            {metrics.statusLabel}
          </Badge>
          <p className="text-[10px] text-mist-500">{metrics.miles7.toLocaleString()} mi · 7 days</p>
          <p className="text-[10px] text-mist-500">{metrics.timeZones7} time zones</p>
          <p className="num text-[10px] text-mist-400">
            Road {metrics.roadRecord.wins}-{metrics.roadRecord.losses}
          </p>
        </div>
      </div>

      {trip ? (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="label-xs">Itinerary</p>
            <Badge tone={trip.status === "active" ? "mint" : "iris"}>{trip.status}</Badge>
          </div>
          <ol className="space-y-2 border-l border-dashed border-[var(--hairline-strong)] pl-3">
            {trip.stops.map((stop, index) => (
              <li key={stop.gameId} className="relative">
                <span
                  className={
                    index === 0
                      ? "absolute -left-[15.5px] top-1 size-2 rounded-full bg-mint-300"
                      : "absolute -left-[15.5px] top-1 size-2 rounded-full border border-[var(--hairline-strong)] bg-ink-850"
                  }
                  aria-hidden
                />
                <p className="text-[12px] font-medium text-mist-200">{stop.city}</p>
                <p className="text-[10px] text-mist-500">
                  {weekdayLabel(stop.date)} {monthDayLabel(stop.date)}
                  {stop.backToBack ? " · back-to-back" : ""}
                  {stop.altitude ? " · altitude" : ""}
                </p>
              </li>
            ))}
          </ol>
          <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl border border-[var(--hairline)] bg-white/[0.02] p-2.5 text-center">
            <div>
              <p className="num text-sm font-semibold text-mist-100">{trip.totalMiles.toLocaleString()}</p>
              <p className="text-[9px] uppercase tracking-wider text-mist-500">miles</p>
            </div>
            <div>
              <p className="num text-sm font-semibold text-mist-100">{trip.timeZonesCrossed}</p>
              <p className="text-[9px] uppercase tracking-wider text-mist-500">zones</p>
            </div>
            <div>
              <p className="num text-sm font-semibold text-mist-100">{trip.backToBacks}</p>
              <p className="text-[9px] uppercase tracking-wider text-mist-500">B2B</p>
            </div>
          </div>
        </div>
      ) : (
        <p className="rounded-lg border border-[var(--hairline)] px-3 py-2 text-[11px] text-mist-500">
          No road trip in this window — the team is home.
        </p>
      )}

      {nextGame ? (
        <div>
          <p className="label-xs mb-1.5">Next game</p>
          <div className="flex items-center justify-between rounded-xl border border-[var(--hairline)] bg-white/[0.02] px-3 py-2">
            <div>
              <p className="text-[12px] font-semibold text-mist-100">
                {nextGame.homeTeamId === team.id ? "vs" : "@"} {opponent?.nickname}
              </p>
              <p className="text-[10px] text-mist-500">
                {weekdayLabel(nextGame.date)} {monthDayLabel(nextGame.date)} · {nextGame.venueType}
              </p>
            </div>
            <Link
              href={`/games/${nextGame.id}`}
              className="rounded-lg bg-white/[0.06] px-2 py-1 text-[10px] font-semibold text-mist-200 hover:bg-white/[0.1]"
            >
              Preview
            </Link>
          </div>
        </div>
      ) : null}

      {prediction && activeTrip?.game ? (
        <div>
          <p className="label-xs mb-1.5">Projection</p>
          <PredictionCard prediction={prediction} game={activeTrip.game} compact />
        </div>
      ) : null}

      <Link
        href={`/teams/${team.id}`}
        className="flex items-center justify-center rounded-xl border border-[var(--hairline)] bg-white/[0.03] px-3 py-2 text-[11px] font-semibold text-mist-200 hover:bg-white/[0.07]"
      >
        Open {team.nickname} team page
      </Link>
    </div>
  );
}
