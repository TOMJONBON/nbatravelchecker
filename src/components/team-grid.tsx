"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { Badge } from "@/components/ui";
import { FatigueChip, TeamMark, TravelStatusChip } from "@/components/domain";
import { cn, formatMiles } from "@/lib/utils";
import { TEAMS } from "@/lib/teams";
import type { Game, TeamTravelMetrics } from "@/lib/types";

export interface TeamGridItem {
  teamId: string;
  metrics: TeamTravelMetrics;
  nextGame: Game | null;
  predictionProbability: number | null;
  opponentId: string | null;
}

type SortKey = "fatigue" | "road" | "wins" | "name";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "fatigue", label: "Fatigue" },
  { key: "road", label: "Road record" },
  { key: "wins", label: "Overall" },
  { key: "name", label: "A–Z" },
];

export function TeamGrid({ items }: { items: TeamGridItem[] }) {
  const [query, setQuery] = useState("");
  const [conference, setConference] = useState<"all" | "East" | "West">("all");
  const [sort, setSort] = useState<SortKey>("fatigue");

  const filtered = useMemo(() => {
    const list = items.filter((item) => {
      const team = TEAMS.find((t) => t.id === item.teamId)!;
      if (conference !== "all" && team.conference !== conference) return false;
      if (!query) return true;
      const haystack = `${team.name} ${team.city} ${team.abbreviation}`.toLowerCase();
      return haystack.includes(query.toLowerCase());
    });

    return list.sort((a, b) => {
      if (sort === "fatigue") return b.metrics.fatigueIndex - a.metrics.fatigueIndex;
      if (sort === "road") {
        const aw = a.metrics.roadRecord;
        const bw = b.metrics.roadRecord;
        return bw.winPct - aw.winPct || bw.wins - aw.wins;
      }
      if (sort === "wins") {
        const aw = a.metrics.homeRecord.wins + a.metrics.roadRecord.wins;
        const bw = b.metrics.homeRecord.wins + b.metrics.roadRecord.wins;
        return bw - aw;
      }
      const teamA = TEAMS.find((t) => t.id === a.teamId)!;
      const teamB = TEAMS.find((t) => t.id === b.teamId)!;
      return teamA.name.localeCompare(teamB.name);
    });
  }, [items, query, conference, sort]);

  return (
    <div>
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-mist-500" aria-hidden />
          <label className="sr-only" htmlFor="team-search">
            Search teams
          </label>
          <input
            id="team-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search teams, cities…"
            className="h-9 w-full rounded-xl border border-[var(--hairline)] bg-white/[0.03] pl-9 pr-3 text-xs text-mist-100 placeholder:text-mist-600 focus:border-mint-400/50"
          />
        </div>

        <div className="flex items-center gap-1 rounded-xl border border-[var(--hairline)] bg-white/[0.02] p-0.5">
          {(["all", "East", "West"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setConference(value)}
              aria-pressed={conference === value}
              className={cn(
                "rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-colors",
                conference === value ? "bg-white/[0.08] text-mist-100" : "text-mist-500 hover:text-mist-200",
              )}
            >
              {value === "all" ? "All" : value}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 rounded-xl border border-[var(--hairline)] bg-white/[0.02] px-2">
          <SlidersHorizontal className="size-3 text-mist-500" aria-hidden />
          <label className="sr-only" htmlFor="team-sort">
            Sort teams
          </label>
          <select
            id="team-sort"
            value={sort}
            onChange={(event) => setSort(event.target.value as SortKey)}
            className="h-9 bg-transparent text-[11px] font-medium text-mist-300 focus:outline-none"
          >
            {SORTS.map((option) => (
              <option key={option.key} value={option.key} className="bg-ink-900">
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--hairline-strong)] px-6 py-12 text-center text-sm text-mist-400">
          No teams match “{query}”.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map(({ teamId, metrics, nextGame, opponentId }) => {
            const team = TEAMS.find((t) => t.id === teamId)!;
            const wins = metrics.homeRecord.wins + metrics.roadRecord.wins;
            const losses = metrics.homeRecord.losses + metrics.roadRecord.losses;
            return (
              <Link
                key={teamId}
                href={`/teams/${teamId}`}
                className="glass card-hover group relative flex flex-col overflow-hidden rounded-2xl p-4"
              >
                <span
                  className="absolute inset-x-0 top-0 h-px opacity-70"
                  style={{ background: `linear-gradient(90deg, transparent, ${team.colors.primary}, transparent)` }}
                  aria-hidden
                />
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <TeamMark team={team} size="md" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-mist-50 group-hover:text-mint-200">{team.name}</p>
                      <p className="text-[10px] uppercase tracking-[0.12em] text-mist-500">
                        {team.conference} · {team.division}
                      </p>
                    </div>
                  </div>
                  <TravelStatusChip metrics={metrics} />
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div>
                    <p className="label-xs">Record</p>
                    <p className="num text-lg font-semibold text-mist-100">
                      {wins}-{losses}
                    </p>
                  </div>
                  <div>
                    <p className="label-xs">Road</p>
                    <p className="num text-lg font-semibold text-mist-100">
                      {metrics.roadRecord.wins}-{metrics.roadRecord.losses}
                    </p>
                  </div>
                  <div>
                    <p className="label-xs">7d miles</p>
                    <p className="num text-lg font-semibold text-mist-100">{formatMiles(metrics.miles7)}</p>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="flex items-center justify-between">
                    <span className="label-xs">Fatigue index</span>
                    <FatigueChip band={metrics.fatigueBand} value={metrics.fatigueIndex} />
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${metrics.fatigueIndex}%`,
                        background:
                          metrics.fatigueIndex >= 65 ? "#fb7185" : metrics.fatigueIndex >= 45 ? "#ffcb6b" : "#52e5b0",
                      }}
                    />
                  </div>
                </div>

                <div className="mt-auto flex items-center justify-between border-t border-[var(--hairline)] pt-2.5 text-[10px] text-mist-500">
                  <span className="truncate">
                    {nextGame
                      ? `${nextGame.homeTeamId === teamId ? "vs" : "@"} ${TEAMS.find((t) => t.id === opponentId)?.abbreviation ?? "TBD"} · ${nextGame.date.slice(5)}`
                      : "No upcoming game"}
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-1">
                    <Badge tone="outline">{metrics.restDays}d rest</Badge>
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
