"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Bell, Star, Trash2 } from "lucide-react";
import { Badge, Card, CardBody, CardHeader, EmptyState } from "@/components/ui";
import { AlertItem, FatigueChip, TeamMark, TravelStatusChip } from "@/components/domain";
import { useWatchlist } from "@/store/watchlist";
import { TEAM_BY_ID } from "@/lib/teams";
import type { Alert, Game, TeamTravelMetrics } from "@/lib/types";

export interface WatchTeam {
  teamId: string;
  metrics: TeamTravelMetrics;
  nextGame: Game | null;
  opponentId: string | null;
}

export interface WatchPlayer {
  id: string;
  name: string;
  teamId: string;
  position: string;
  minutesPerGame: number;
  statsKnown?: boolean;
}

export function WatchlistView({
  teams,
  players,
  alerts,
}: {
  teams: WatchTeam[];
  players: WatchPlayer[];
  alerts: Alert[];
}) {
  const items = useWatchlist((state) => state.items);
  const remove = useWatchlist((state) => state.remove);
  const clear = useWatchlist((state) => state.clear);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const watchedTeams = useMemo(
    () => (mounted ? items.filter((item) => item.kind === "team") : []),
    [items, mounted],
  );
  const watchedPlayers = useMemo(
    () => (mounted ? items.filter((item) => item.kind === "player") : []),
    [items, mounted],
  );

  const watchedTeamIds = new Set(watchedTeams.map((item) => item.id));
  const playerTeamIds = new Set(
    watchedPlayers
      .map((item) => players.find((p) => p.id === item.id)?.teamId ?? item.teamId)
      .filter(Boolean) as string[],
  );
  const relevantIds = new Set([...watchedTeamIds, ...playerTeamIds]);

  const filteredAlerts = alerts.filter((alert) => alert.teamId && relevantIds.has(alert.teamId));
  const hasItems = watchedTeams.length + watchedPlayers.length > 0;

  if (!mounted) {
    return <div className="h-40 animate-pulse rounded-2xl bg-white/[0.04]" aria-hidden />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[11px] text-mist-500">
          <Star className="size-3.5" aria-hidden />
          <span>
            {watchedTeams.length} team{watchedTeams.length === 1 ? "" : "s"} · {watchedPlayers.length} player
            {watchedPlayers.length === 1 ? "" : "s"} watched
          </span>
          <Badge tone="outline">Stored in this browser only</Badge>
        </div>
        {hasItems ? (
          <button
            type="button"
            onClick={clear}
            className="inline-flex items-center gap-1 rounded-lg border border-[var(--hairline)] px-2 py-1 text-[10px] font-semibold text-mist-400 hover:text-rose-300"
          >
            <Trash2 className="size-3" aria-hidden />
            Clear all
          </button>
        ) : null}
      </div>

      {!hasItems ? (
        <EmptyState
          title="Your watchlist is empty"
          description="Star teams and players to pin their travel alerts, back-to-backs and fatigue spikes here."
          icon={<Star className="size-6" />}
          action={
            <Link href="/teams" className="rounded-xl bg-mint-400 px-4 py-2 text-xs font-bold text-ink-950">
              Browse teams
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {watchedTeams.map((entry) => {
            const data = teams.find((t) => t.teamId === entry.id);
            const team = TEAM_BY_ID[entry.id];
            if (!data || !team) return null;
            const opponent = data.opponentId ? TEAM_BY_ID[data.opponentId] : null;
            return (
              <Card key={entry.id} className="card-hover">
                <div className="flex items-start gap-3 p-4">
                  <TeamMark team={team} size="md" />
                  <div className="min-w-0 flex-1">
                    <Link href={`/teams/${team.id}`} className="text-sm font-semibold text-mist-100 hover:text-mint-200">
                      {team.name}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <TravelStatusChip metrics={data.metrics} />
                      <FatigueChip band={data.metrics.fatigueBand} value={data.metrics.fatigueIndex} />
                    </div>
                    <p className="mt-1.5 text-[10px] text-mist-500">
                      {data.nextGame && opponent
                        ? `Next: ${data.nextGame.homeTeamId === team.id ? "vs" : "@"} ${opponent.abbreviation} · ${data.nextGame.date}`
                        : "No upcoming game"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove("team", team.id)}
                    aria-label={`Remove ${team.name} from watchlist`}
                    className="grid size-7 place-items-center rounded-md text-mist-500 hover:text-rose-300"
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </button>
                </div>
                <div className="flex items-center justify-between border-t border-[var(--hairline)] px-4 py-2 text-[10px] text-mist-500">
                  <span>
                    {data.metrics.miles7.toLocaleString()} mi · {data.metrics.timeZones7} zones · {data.metrics.restDays}d rest
                  </span>
                  <Link href={`/teams/${team.id}`} className="font-semibold text-mint-300">
                    Details →
                  </Link>
                </div>
              </Card>
            );
          })}

          {watchedPlayers.map((entry) => {
            const player = players.find((p) => p.id === entry.id);
            const team = TEAM_BY_ID[player?.teamId ?? entry.teamId ?? ""] ?? null;
            const name = player?.name ?? entry.name ?? "Player";
            if (!team) return null;
            return (
              <Card key={entry.id} className="card-hover">
                <div className="flex items-start gap-3 p-4">
                  <TeamMark team={team} size="md" />
                  <div className="min-w-0 flex-1">
                    <Link href={`/players/${entry.id}`} className="text-sm font-semibold text-mist-100 hover:text-mint-200">
                      {name}
                    </Link>
                    <p className="text-[10px] text-mist-500">
                      {player ? `${player.position} · ` : ""}
                      {team.abbreviation}
                      {player && player.statsKnown ? ` · ${player.minutesPerGame} mpg` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove("player", entry.id)}
                    aria-label={`Remove ${name} from watchlist`}
                    className="grid size-7 place-items-center rounded-md text-mist-500 hover:text-rose-300"
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </button>
                </div>
                <div className="flex items-center justify-between border-t border-[var(--hairline)] px-4 py-2 text-[10px] text-mist-500">
                  <span>Travel splits, rest buckets and confidence intervals</span>
                  <Link href={`/players/${entry.id}`} className="font-semibold text-mint-300">
                    Impact →
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Bell className="size-4 text-amber-300" aria-hidden />
              Alerts for your watchlist
            </span>
          }
          subtitle="In-app only in this MVP. Email and push delivery are stretch features."
          action={<Badge tone="outline">{filteredAlerts.length}</Badge>}
        />
        <CardBody className="space-y-2">
          {filteredAlerts.slice(0, 10).map((alert) => (
            <AlertItem key={alert.id} alert={alert} team={alert.teamId ? TEAM_BY_ID[alert.teamId] : undefined} />
          ))}
          {filteredAlerts.length === 0 ? (
            <p className="py-6 text-center text-xs text-mist-500">
              {hasItems
                ? "No alerts for your teams right now — check back after the next schedule update."
                : "Watch a team to start receiving alerts."}
            </p>
          ) : null}
        </CardBody>
      </Card>
    </div>
  );
}
