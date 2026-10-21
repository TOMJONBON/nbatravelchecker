import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertCircle, ArrowLeft, Clock, MapPin, Plane, Sparkles, Trophy } from "lucide-react";
import { getGameDetail } from "@/lib/data";
import { TEAM_BY_ID, isAltitude } from "@/lib/teams";
import { PLAYERS } from "@/lib/players";
import { formatTipoff, longDateLabel, monthDayLabel } from "@/lib/time";
import { pct, signed } from "@/lib/utils";
import { Badge, Card, CardBody, CardHeader, Divider, EmptyState, Stat } from "@/components/ui";
import {
  ConfidenceChip,
  FactorBars,
  MetaLine,
  PredictionCard,
  ProvenanceBadge,
  StatusChip,
  TeamMark,
} from "@/components/domain";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getGameDetail(id);
  return {
    title: detail
      ? `${TEAM_BY_ID[detail.game.awayTeamId].abbreviation} @ ${TEAM_BY_ID[detail.game.homeTeamId].abbreviation}`
      : "Game",
  };
}

export default async function GamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getGameDetail(id);
  if (!detail) notFound();

  const { game, home, away, homeMetrics, awayMetrics, prediction, homeInjuries, awayInjuries } = detail;
  const neutral = game.venueType !== "team";
  const meta = detail.meta;

  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb" className="text-[11px] text-mist-500">
        <Link href="/predictions" className="hover:text-mist-200">
          Predictions
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-mist-300">
          {away.abbreviation} @ {home.abbreviation}
        </span>
      </nav>

      <Card className="relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{
            background: `linear-gradient(110deg, ${away.colors.primary} 0%, transparent 42%, transparent 58%, ${home.colors.primary} 100%)`,
          }}
          aria-hidden
        />
        <div className="relative px-5 py-5 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[11px] text-mist-400">
              <Clock className="size-3" aria-hidden />
              <span>{longDateLabel(game.date)}</span>
              <span aria-hidden>·</span>
              <span>{formatTipoff(game.tipoff, neutral ? undefined : home.timezone)}</span>
            </div>
            <div className="flex items-center gap-2">
              <StatusChip game={game} />
              {neutral ? <Badge tone="amber">{game.neutralSite?.city ?? "Neutral site"}</Badge> : null}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
            <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3">
              <TeamMark team={away} size="lg" />
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold text-mist-50 sm:text-xl">{away.name}</p>
                <p className="text-[11px] text-mist-400">
                  {awayMetrics.roadRecord.wins}-{awayMetrics.roadRecord.losses} on the road
                </p>
              </div>
            </div>

            <div className="text-center">
              {game.status === "final" || game.status === "live" ? (
                <p className="num text-4xl font-semibold tracking-tight text-mist-50 sm:text-5xl">
                  {game.awayScore}
                  <span className="mx-2 text-mist-600">–</span>
                  {game.homeScore}
                </p>
              ) : (
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-mist-500">vs</p>
              )}
              <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-mist-500">
                {game.status === "final" ? "Final" : game.status === "live" ? `${game.period} ${game.clock}` : "Tipoff"}
              </p>
            </div>

            <div className="flex flex-col items-end gap-2 sm:flex-row-reverse sm:items-center sm:gap-3">
              <TeamMark team={home} size="lg" />
              <div className="min-w-0 text-right">
                <p className="truncate text-lg font-semibold text-mist-50 sm:text-xl">{home.name}</p>
                <p className="text-[11px] text-mist-400">
                  {homeMetrics.homeRecord.wins}-{homeMetrics.homeRecord.losses} at home
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--hairline)] pt-3 text-[11px] text-mist-500">
            <span className="flex items-center gap-1.5">
              <MapPin className="size-3" aria-hidden />
              {game.neutralSite?.name ?? home.arena.name} · {game.neutralSite?.city ?? home.city}
              {!neutral && isAltitude(home) ? ` · ${home.arena.altitudeFt.toLocaleString()} ft` : ""}
            </span>
            <MetaLine meta={meta} />
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          {prediction ? (
            <Card>
              <CardHeader
                title={
                  <span className="flex items-center gap-2">
                    <Sparkles className="size-4 text-mint-300" aria-hidden />
                    Projection &amp; explanation
                  </span>
                }
                subtitle={`${prediction.modelVersion} · projected margin ${signed(prediction.projectedMargin)}`}
                action={<ConfidenceChip confidence={prediction.confidence} probability={prediction.homeWinProbability} />}
              />
              <CardBody>
                <div className="flex items-center justify-between gap-4 rounded-xl border border-[var(--hairline)] bg-white/[0.02] px-4 py-3">
                  <div className="text-center">
                    <p className="label-xs">{away.abbreviation}</p>
                    <p className="num text-3xl font-semibold text-mist-100">{prediction.projectedAwayScore}</p>
                  </div>
                  <div className="flex-1 text-center">
                    <div className="mx-auto h-2 max-w-[220px] overflow-hidden rounded-full bg-white/[0.06]">
                      <div className="flex h-full">
                        <span style={{ width: `${(1 - prediction.homeWinProbability) * 100}%`, background: away.colors.primary }} />
                        <span style={{ width: `${prediction.homeWinProbability * 100}%`, background: home.colors.primary }} />
                      </div>
                    </div>
                    <p className="mt-1.5 text-[10px] text-mist-500">
                      {away.abbreviation} {pct(1 - prediction.homeWinProbability, 0)} · {home.abbreviation}{" "}
                      {pct(prediction.homeWinProbability, 0)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="label-xs">{home.abbreviation}</p>
                    <p className="num text-3xl font-semibold text-mist-100">{prediction.projectedHomeScore}</p>
                  </div>
                </div>

                <div className="mt-4">
                  <p className="label-xs mb-2">Factor attribution (points added to home margin)</p>
                  <FactorBars prediction={prediction} limit={8} />
                </div>

                <Divider className="my-4" />

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-[var(--hairline)] bg-white/[0.02] p-3">
                    <p className="label-xs mb-1">Model pick</p>
                    <p className="text-sm font-semibold text-mist-100">
                      {TEAM_BY_ID[prediction.predictedWinnerId].name}
                    </p>
                    <p className="mt-0.5 text-[10px] text-mist-500">
                      {pct(prediction.homeWinProbability, 1)} home win probability
                    </p>
                  </div>
                  <div className="rounded-xl border border-[var(--hairline)] bg-white/[0.02] p-3">
                    <p className="label-xs mb-1">Baseline (Elo only)</p>
                    <p className="text-sm font-semibold text-mist-100">
                      {TEAM_BY_ID[prediction.baseline.predictedWinnerId].name}
                    </p>
                    <p className="mt-0.5 text-[10px] text-mist-500">
                      {pct(prediction.baseline.homeWinProbability, 1)} · no fatigue terms
                    </p>
                  </div>
                </div>

                <p className="mt-3 text-[10px] leading-relaxed text-mist-500">{prediction.confidenceReason}</p>
              </CardBody>
              <div className="border-t border-[var(--hairline)] px-5 py-2.5">
                <ProvenanceBadge meta={prediction.meta} />
              </div>
            </Card>
          ) : (
            <EmptyState
              title="No projection stored for this game"
              description="This game predates the current season's prediction history, or it was postponed."
            />
          )}

          <Card>
            <CardHeader title="Travel & rest comparison" subtitle="Both teams measured at tipoff." />
            <CardBody className="px-0 pb-2">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="text-left text-[9px] uppercase tracking-wider text-mist-600">
                    <th className="px-5 py-1.5 font-semibold">Metric</th>
                    <th className="px-2 py-1.5 text-right font-semibold">{away.abbreviation}</th>
                    <th className="px-5 py-1.5 text-right font-semibold">{home.abbreviation}</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: "Fatigue index", a: awayMetrics.fatigueIndex, h: homeMetrics.fatigueIndex, lowerBetter: true },
                    { label: "Miles · 7 days", a: awayMetrics.miles7.toLocaleString(), h: homeMetrics.miles7.toLocaleString(), lowerBetter: true },
                    { label: "Miles · 14 days", a: awayMetrics.miles14.toLocaleString(), h: homeMetrics.miles14.toLocaleString(), lowerBetter: true },
                    { label: "Time zones · 7d", a: awayMetrics.timeZones7, h: homeMetrics.timeZones7, lowerBetter: true },
                    { label: "Back-to-backs · 7d", a: awayMetrics.backToBacks7, h: homeMetrics.backToBacks7, lowerBetter: true },
                    { label: "Rest days", a: awayMetrics.restDays, h: homeMetrics.restDays, lowerBetter: false },
                    { label: "Altitude games · 7d", a: awayMetrics.altitudeGames7, h: homeMetrics.altitudeGames7, lowerBetter: true },
                  ].map((row) => (
                    <tr key={row.label} className="border-t border-[var(--hairline)]">
                      <td className="px-5 py-1.5 text-mist-400">{row.label}</td>
                      <td className="num px-2 py-1.5 text-right text-mist-200">{row.a}</td>
                      <td className="num px-5 py-1.5 text-right text-mist-200">{row.h}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Availability report"
              subtitle={
                detail.mode === "live" ? "Reported by ESPN · refreshed every 60s" : "Mock injury reports — deterministic per game."
              }
            />
            <CardBody className="grid gap-4 sm:grid-cols-2">
              {[
                { team: away, injuries: awayInjuries },
                { team: home, injuries: homeInjuries },
              ].map(({ team, injuries }) => (
                <div key={team.id}>
                  <div className="mb-1.5 flex items-center gap-2">
                    <TeamMark team={team} size="xs" />
                    <p className="text-[11px] font-semibold text-mist-300">{team.abbreviation}</p>
                  </div>
                  {injuries.length === 0 ? (
                    <p className="text-[11px] text-mist-500">No absences reported.</p>
                  ) : (
                    <ul className="space-y-1">
                      {injuries.map((injury) => {
                        const player = PLAYERS.find((p) => p.id === injury.playerId);
                        return (
                          <li key={injury.playerId} className="flex items-start gap-1.5 text-[11px]">
                            <AlertCircle
                              className={injury.status === "out" ? "mt-0.5 size-3 shrink-0 text-rose-300" : "mt-0.5 size-3 shrink-0 text-amber-300"}
                              aria-hidden
                            />
                            <span className="text-mist-300">
                              {player?.name ?? injury.playerId}
                              <span className="text-mist-500"> · {injury.status} · {injury.reason}</span>
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              ))}
            </CardBody>
            <div className="border-t border-[var(--hairline)] px-5 py-2.5">
              <p className="text-[10px] text-mist-500">
                {detail.mode === "live"
                  ? "Absences are weighted with a coarse prior (out ≈ 1.4 pts, questionable ≈ 0.5); this is not a lineup model."
                  : "Availability is modelled, not reported. Real deployments replace this with a licensed injury feed."}
              </p>
            </div>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader title="Road-trip context" subtitle="Where each team is in its trip." />
            <CardBody className="space-y-3">
              {[away, home].map((team) => {
                const metrics = team.id === away.id ? awayMetrics : homeMetrics;
                return (
                  <div key={team.id} className="rounded-xl border border-[var(--hairline)] bg-white/[0.02] p-2.5">
                    <div className="flex items-center gap-2">
                      <TeamMark team={team} size="xs" />
                      <span className="text-[11px] font-semibold text-mist-200">{team.abbreviation}</span>
                      <Badge tone={metrics.status === "back_to_back" ? "danger" : metrics.status === "road_trip" ? "amber" : "mint"} className="ml-auto">
                        {metrics.statusLabel}
                      </Badge>
                    </div>
                    <p className="mt-1.5 flex items-center gap-1 text-[10px] text-mist-500">
                      <Plane className="size-2.5" aria-hidden />
                      {metrics.trip
                        ? `${metrics.trip.cities.join(" → ")} · ${metrics.trip.totalMiles.toLocaleString()} mi`
                        : "At home base"}
                    </p>
                    <Link href={`/teams/${team.id}`} className="mt-1 inline-block text-[10px] font-semibold text-mint-300">
                      Team page →
                    </Link>
                  </div>
                );
              })}
            </CardBody>
          </Card>

          {prediction ? (
            <div>
              <h2 className="label-xs mb-2">Other views</h2>
              <PredictionCard prediction={prediction} game={game} />
            </div>
          ) : null}

          <Card>
            <CardHeader title="Series context" subtitle="Recent meetings between these teams." />
            <CardBody>
              <p className="text-[11px] leading-relaxed text-mist-400">
                Series history is not modelled in this MVP. The projection uses season-long Elo plus tonight&apos;s travel,
                rest and availability.
              </p>
              <Divider className="my-3" />
              <Link href={`/compare?teams=${away.id},${home.id}`} className="text-[11px] font-semibold text-mint-300">
                Compare these teams →
              </Link>
            </CardBody>
          </Card>

          <Link
            href="/predictions"
            className="flex items-center justify-center gap-1.5 rounded-xl border border-[var(--hairline)] bg-white/[0.03] px-3 py-2 text-[11px] font-semibold text-mist-200 hover:bg-white/[0.07]"
          >
            <ArrowLeft className="size-3" aria-hidden />
            All predictions
          </Link>
        </aside>
      </div>
    </div>
  );
}
