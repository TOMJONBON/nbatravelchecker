import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Mountain, Plane, PlaneTakeoff, Timer } from "lucide-react";
import { getTeamDetail } from "@/lib/data";
import { getTeam } from "@/lib/teams";
import { formatTipoff, monthDayLabel, weekdayLabel } from "@/lib/time";
import { formatMiles, pct, recordLabel, signed } from "@/lib/utils";
import { TEAM_BY_ID } from "@/lib/teams";
import { Badge, Card, CardBody, CardHeader, Divider, EmptyState, PageHeader, Stat } from "@/components/ui";
import {
  FatigueChip,
  FatigueGauge,
  MetaLine,
  PredictionCard,
  ProvenanceBadge,
  TeamMark,
  TravelStatusChip,
} from "@/components/domain";
import { RoadTripCard } from "@/components/road-trip-card";
import { WatchButton } from "@/components/watch-button";
import { FatigueTrendChart, SplitBars } from "@/components/charts";
import { MIN_SPLIT_SAMPLE } from "@/lib/player-impact";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const team = getTeam(id);
  return { title: team ? team.name : "Team" };
}

export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getTeamDetail(id);
  const team = getTeam(id);
  if (!detail || !team) notFound();

  const { metrics, schedule, record, home, away, splits, trips, upcoming, recent, rosterSummaries, trend } = detail;
  const meta = detail.meta;

  const legForGame = (gameId: string) => schedule.legs.find((leg) => leg.gameId === gameId) ?? null;
  const activeTrip = trips.find((trip) => trip.status === "active") ?? trips.find((trip) => trip.status === "upcoming") ?? null;

  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb" className="text-[11px] text-mist-500">
        <Link href="/teams" className="hover:text-mist-200">
          Teams
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-mist-300">{team.nickname}</span>
      </nav>

      <Card className="relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{
            background: `radial-gradient(900px 320px at 12% 0%, ${team.colors.primary}, transparent 60%), radial-gradient(600px 240px at 85% 20%, ${team.colors.secondary}, transparent 60%)`,
          }}
          aria-hidden
        />
        <div className="relative flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex items-start gap-4">
            <TeamMark team={team} size="lg" />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-mist-400">{team.conference}ern Conference</span>
                <TravelStatusChip metrics={metrics} />
                <WatchButton kind="team" id={team.id} label="Watch" name={team.name} teamId={team.id} />
              </div>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-mist-50 sm:text-3xl">{team.name}</h1>
              <p className="mt-1 text-sm text-mist-400">
                {team.arena.name} · {team.city} · {team.arena.altitudeFt.toLocaleString()} ft
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-mist-400">
                <Badge tone="outline">
                  {record.wins}-{record.losses} · {pct(record.winPct, 1)}
                </Badge>
                <Badge tone="outline">Road {recordLabel(away.wins, away.losses)}</Badge>
                <Badge tone="outline">Home {recordLabel(home.wins, home.losses)}</Badge>
                {metrics.backToBacks7 > 0 ? <Badge tone="amber">{metrics.backToBacks7} B2B / 7d</Badge> : null}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-5 sm:pr-2">
            <div className="text-right">
              <p className="label-xs">7-day travel</p>
              <p className="num mt-1 text-xl font-semibold text-mist-100">{formatMiles(metrics.miles7)}</p>
              <p className="mt-0.5 text-[10px] text-mist-500">
                {metrics.timeZones7} zones · {metrics.games7} games
              </p>
              <Divider className="my-2" />
              <p className="label-xs">Rest before next</p>
              <p className="num mt-0.5 text-sm font-semibold text-mist-200">{metrics.restDays} days</p>
            </div>
            <FatigueGauge value={metrics.fatigueIndex} band={metrics.fatigueBand} size={128} label="Travel fatigue" />
          </div>
        </div>
        <div className="relative flex flex-wrap items-center justify-between gap-2 border-t border-[var(--hairline)] px-5 py-2.5">
          <MetaLine meta={meta} />
          <p className="text-[10px] text-mist-500">{metrics.statusDetail}</p>
        </div>
      </Card>

      <section aria-label="Season splits" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Road record" value={`${away.wins}-${away.losses}`} hint={`${pct(away.winPct, 1)} win rate`} tone={away.winPct >= 0.5 ? "mint" : "default"} />
        <Stat label="Home record" value={`${home.wins}-${home.losses}`} hint={`${pct(home.winPct, 1)} win rate`} />
        <Stat label="Miles · 14 days" value={metrics.miles14.toLocaleString()} hint={`${metrics.altitudeGames7} altitude games (7d)`} />
        <Stat
          label="Points for / against"
          value={`${(record.pointsFor / Math.max(1, record.games)).toFixed(1)}`}
          hint={`${(record.pointsAgainst / Math.max(1, record.games)).toFixed(1)} allowed per game`}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Fatigue trend"
              subtitle="Index reconstructed for each date from the trailing 7 and 14 day windows."
              action={<Badge tone="outline">13 days back · 7 ahead</Badge>}
            />
            <CardBody>
              <FatigueTrendChart data={trend} />
            </CardBody>
            <div className="border-t border-[var(--hairline)] px-5 py-2.5">
              <ProvenanceBadge meta={meta} />
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Upcoming itinerary"
              subtitle="Flights are assumed the day before each game when the city changes."
            />
            <CardBody className="px-0 pb-2">
              {upcoming.length === 0 ? (
                <p className="px-5 py-6 text-center text-xs text-mist-500">No upcoming games in the current window.</p>
              ) : (
                <ol className="divide-y divide-[var(--hairline)]">
                  {upcoming.map((game) => {
                    const isHome = game.homeTeamId === team.id;
                    const opponent = TEAM_BY_ID[isHome ? game.awayTeamId : game.homeTeamId];
                    const leg = legForGame(game.id);
                    const b2b = metrics.restDays === 0 && game.id === upcoming[0]?.id;
                    return (
                      <li key={game.id} className="flex items-center gap-3 px-5 py-3">
                        <div className="w-12 shrink-0">
                          <p className="text-[10px] uppercase tracking-wider text-mist-500">{weekdayLabel(game.date)}</p>
                          <p className="num text-[11px] font-semibold text-mist-300">{monthDayLabel(game.date)}</p>
                        </div>
                        <span
                          className={`inline-flex size-7 shrink-0 items-center justify-center rounded-lg text-[9px] font-bold text-white`}
                          style={{ background: opponent.colors.primary }}
                          aria-hidden
                        >
                          {opponent.abbreviation}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[12px] font-medium text-mist-200">
                            {isHome ? "vs" : "at"} {opponent.name}
                            {game.neutralSite ? <span className="text-amber-200"> · {game.neutralSite.city}</span> : null}
                          </p>
                          <p className="flex flex-wrap items-center gap-x-2 text-[10px] text-mist-500">
                            <span>{formatTipoff(game.tipoff)}</span>
                            {leg ? (
                              <span className="inline-flex items-center gap-1">
                                <Plane className="size-2.5" aria-hidden />
                                {formatMiles(leg.miles)} from {leg.from.code} · {leg.timeZoneShift === 0 ? "same zone" : `${leg.timeZoneShift > 0 ? "+" : ""}${leg.timeZoneShift}h`}
                              </span>
                            ) : (
                              <span>No city change</span>
                            )}
                            {b2b ? <span className="font-semibold text-rose-300">back-to-back</span> : null}
                            {game.homeTeamId !== team.id && TEAM_BY_ID[game.homeTeamId].arena.altitudeFt >= 4000 ? (
                              <span className="inline-flex items-center gap-1 text-amber-200">
                                <Mountain className="size-2.5" aria-hidden /> altitude
                              </span>
                            ) : null}
                          </p>
                        </div>
                        <Link href={`/games/${game.id}`} className="shrink-0 text-[11px] font-semibold text-mint-300 hover:text-mint-200">
                          Preview
                        </Link>
                      </li>
                    );
                  })}
                </ol>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Travel splits" subtitle="Win rate and scoring by rest, location, altitude and back-to-backs." />
            <CardBody className="grid gap-4 sm:grid-cols-2 [&>*]:min-w-0">
              <SplitTable title="Location" rows={splits.location} />
              <SplitTable title="Rest days" rows={splits.rest} />
              <SplitTable title="Altitude" rows={splits.altitude} />
              <SplitTable title="Back-to-back" rows={splits.backToBack} />
            </CardBody>
            <div className="border-t border-[var(--hairline)] px-5 py-2.5">
              <p className="text-[10px] text-mist-500">
                Splits use completed games only. Early-season samples are small — treat differences as noise until n ≥ 10.
              </p>
            </div>
          </Card>

          <Card>
            <CardHeader title="Recent results" subtitle="Last 10 completed games." />
            <CardBody className="px-0 pb-2">
              <ul className="divide-y divide-[var(--hairline)]">
                {recent.map((game) => {
                  const isHome = game.homeTeamId === team.id;
                  const opponent = TEAM_BY_ID[isHome ? game.awayTeamId : game.homeTeamId];
                  const own = (isHome ? game.homeScore : game.awayScore) ?? 0;
                  const opp = (isHome ? game.awayScore : game.homeScore) ?? 0;
                  const won = own > opp;
                  return (
                    <li key={game.id} className="flex items-center gap-3 px-5 py-2.5">
                      <span
                        className={`num grid size-5 place-items-center rounded text-[10px] font-bold ${won ? "bg-mint-400/15 text-mint-300" : "bg-rose-400/10 text-rose-300"}`}
                      >
                        {won ? "W" : "L"}
                      </span>
                      <span className="text-[11px] text-mist-500">{monthDayLabel(game.date)}</span>
                      <span className="min-w-0 flex-1 truncate text-[12px] text-mist-300">
                        {isHome ? "vs" : "@"} {opponent.nickname}
                      </span>
                      <span className="num text-[12px] font-semibold text-mist-200">
                        {own}–{opp}
                      </span>
                    </li>
                  );
                })}
              </ul>
              {recent.length === 0 ? <p className="px-5 py-6 text-center text-xs text-mist-500">No completed games yet.</p> : null}
            </CardBody>
          </Card>
        </div>

        <aside className="space-y-6">
          {activeTrip ? (
            <RoadTripCard
              trip={activeTrip}
              team={team}
              metrics={metrics}
              prediction={
                activeTrip.stops.length > 0
                  ? detail.predictions.find((p) => p.gameId === activeTrip.stops[activeTrip.stops.length - 1].gameId) ?? null
                  : null
              }
            />
          ) : null}

          <Card>
            <CardHeader title="Fatigue components" subtitle={`Index ${metrics.fatigueIndex}/100 · weighted inputs`} />
            <CardBody className="space-y-2">
              {metrics.components.map((component) => (
                <div key={component.key}>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-mist-400">{component.label}</span>
                    <span className="num font-semibold text-mist-200">{component.points.toFixed(1)}</span>
                  </div>
                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="h-full rounded-full bg-mint-400/70"
                      style={{ width: `${component.normalized * 100}%` }}
                    />
                  </div>
                  <p className="mt-0.5 text-[9px] text-mist-600">
                    weight {component.weight} · {component.detail}
                  </p>
                </div>
              ))}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Roster"
              subtitle={
                detail.mode === "live"
                  ? "Live roster · open a player for travel splits"
                  : "2025-26 sample · adjusted for minutes and opponent"
              }
              action={<Badge tone="outline">{rosterSummaries.length}</Badge>}
            />
            <CardBody className="space-y-1">
              {rosterSummaries
                .slice()
                .sort((a, b) => (b.impact?.travelImpactScore ?? -1) - (a.impact?.travelImpactScore ?? -1))
                .slice(0, 9)
                .map(({ player, impact }) => (
                  <Link
                    key={player.id}
                    href={`/players/${player.id}`}
                    className="flex items-center gap-2 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-white/[0.04]"
                  >
                    <span className="grid size-6 shrink-0 place-items-center rounded-md bg-white/[0.06] text-[9px] font-bold text-mist-300">
                      {player.position}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-mist-200">{player.name}</span>
                    <span className="num text-[10px] text-mist-500">
                      {player.statsKnown ? `${player.minutesPerGame}m` : `#${player.number}`}
                    </span>
                    {impact ? (
                      <span
                        className={`num rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                          impact.travelImpactScore >= 60 ? "bg-rose-400/10 text-rose-300" : "bg-mint-400/10 text-mint-300"
                        }`}
                        title={impact.impactLabel}
                      >
                        {impact.travelImpactScore}
                      </span>
                    ) : (
                      <span className="text-[10px] text-mist-500" aria-hidden>
                        →
                      </span>
                    )}
                  </Link>
                ))}
            </CardBody>
            <div className="border-t border-[var(--hairline)] px-5 py-2.5">
              <p className="text-[10px] text-mist-500">
                {detail.mode === "live"
                  ? "Travel-impact scores are fitted per player from real game logs on the player page."
                  : "Score 0–100, higher = larger estimated travel sensitivity."}
              </p>
            </div>
          </Card>

          <section aria-labelledby="predictions-heading">
            <h2 id="predictions-heading" className="label-xs mb-2">
              Upcoming projections
            </h2>
            <div className="space-y-3">
              {detail.predictions.slice(0, 2).map((prediction) => {
                const game = upcoming.find((g) => g.id === prediction.gameId);
                if (!game) return null;
                return <PredictionCard key={prediction.gameId} game={game} prediction={prediction} compact />;
              })}
              {detail.predictions.length === 0 ? (
                <EmptyState title="No projections" description="Upcoming games will appear here once scheduled." />
              ) : null}
            </div>
          </section>

          <Card>
            <CardHeader title="Trip difficulty" subtitle="Ranked by total estimated miles." />
            <CardBody className="space-y-1.5">
              {trips
                .filter((trip) => trip.status !== "completed")
                .slice(0, 4)
                .map((trip) => (
                  <div key={trip.id} className="flex items-center justify-between rounded-lg bg-white/[0.03] px-2.5 py-1.5">
                    <div className="min-w-0">
                      <p className="truncate text-[11px] font-medium text-mist-200">
                        {trip.cities.join(" → ")}
                      </p>
                      <p className="text-[10px] text-mist-500">
                        {monthDayLabel(trip.startDate)}–{monthDayLabel(trip.endDate)}
                      </p>
                    </div>
                    <span className="num ml-2 shrink-0 text-[10px] font-semibold text-mist-300">
                      {formatMiles(trip.totalMiles)}
                    </span>
                  </div>
                ))}
              {trips.filter((t) => t.status !== "completed").length === 0 ? (
                <p className="py-4 text-center text-[11px] text-mist-500">No scheduled road trips.</p>
              ) : null}
            </CardBody>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function SplitTable({
  title,
  rows,
}: {
  title: string;
  rows: { key: string; label: string; games: number; wins: number; losses: number; winPct: number; pointsFor: number; pointsAgainst: number }[];
}) {
  const ordered = rows.slice().sort((a, b) => a.key.localeCompare(b.key));
  if (ordered.length === 0) {
    return (
      <div>
        <p className="label-xs mb-1.5">{title}</p>
        <p className="text-[11px] text-mist-500">No completed games.</p>
      </div>
    );
  }
  return (
    <div className="min-w-0">
      <p className="label-xs mb-1.5">{title}</p>
      <table className="w-full table-fixed text-[11px]">
        <colgroup>
          <col style={{ width: "36%" }} />
          <col style={{ width: "16%" }} />
          <col style={{ width: "16%" }} />
          <col style={{ width: "16%" }} />
          <col style={{ width: "16%" }} />
        </colgroup>
        <thead>
          <tr className="text-left text-[9px] uppercase tracking-wider text-mist-600">
            <th className="pb-1 font-semibold">Split</th>
            <th className="pb-1 text-right font-semibold">W-L</th>
            <th className="pb-1 text-right font-semibold">Win%</th>
            <th className="pb-1 text-right font-semibold">PPG</th>
            <th className="pb-1 text-right font-semibold">OPP</th>
          </tr>
        </thead>
        <tbody>
          {ordered.map((row) => (
            <tr key={row.key} className="border-t border-[var(--hairline)]">
              <td className="truncate py-1 pr-1 text-mist-300" title={row.label}>{row.label}</td>
              <td className="num py-1 text-right text-mist-200">
                {row.wins}-{row.losses}
              </td>
              <td className="num py-1 text-right text-mist-300">{pct(row.winPct, 0)}</td>
              <td className="num py-1 text-right text-mist-300">{(row.pointsFor / Math.max(1, row.games)).toFixed(1)}</td>
              <td className="num py-1 text-right text-mist-500">{(row.pointsAgainst / Math.max(1, row.games)).toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {ordered.some((row) => row.games > 0 && row.games < MIN_SPLIT_SAMPLE) ? (
        <p className="mt-1 text-[9px] text-amber-200/70">Small samples (n &lt; {MIN_SPLIT_SAMPLE}) — interpret cautiously.</p>
      ) : null}
    </div>
  );
}
