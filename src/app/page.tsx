import Link from "next/link";
import {
  Activity,
  ArrowRight,
  CalendarDays,
  Gauge,
  PlaneTakeoff,
  Radio,
  Route,
  Sparkles,
} from "lucide-react";
import { getDataset } from "@/lib/data";
import { skillScore, sampleWarning } from "@/lib/model";
import { longDateLabel } from "@/lib/time";
import { TEAM_BY_ID } from "@/lib/teams";
import { pct } from "@/lib/utils";
import { Badge, Card, CardBody, CardHeader, Divider, SectionHeading, Stat } from "@/components/ui";
import {
  AlertItem,
  FatigueChip,
  MetaLine,
  PredictionCard,
  ProvenanceBadge,
  TeamLink,
  TravelStatusChip,
} from "@/components/domain";
import { RoadTripCard } from "@/components/road-trip-card";
import { FadeIn } from "@/components/motion";

export const dynamic = "force-dynamic";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const ds = await getDataset();
  const today = ds.today;
  const todayGames = ds.games.filter((g) => g.date === today);
  const live = todayGames.filter((g) => g.status === "live");
  const upcoming = todayGames.filter((g) => g.status === "scheduled");
  const metrics = Object.values(ds.metrics);
  const travelling = metrics.filter((m) => ["traveling", "road_trip", "back_to_back"].includes(m.status));
  const avgFatigue = Math.round(metrics.reduce((s, m) => s + m.fatigueIndex, 0) / metrics.length);
  const leaders = [...metrics].sort((a, b) => b.fatigueIndex - a.fatigueIndex).slice(0, 6);

  const trips = Object.values(ds.schedules)
    .flatMap((s) => s.trips)
    .filter((t) => t.status === "active" || (t.status === "upcoming" && t.startDate <= addDaysShort(today, 6)))
    .sort((a, b) => (a.startDate < b.startDate ? -1 : 1))
    .slice(0, 3);

  const slate = (upcoming.length > 0 ? upcoming : todayGames).slice(0, 4);
  const meta = ds.meta;

  return (
    <div className="space-y-8">
      <FadeIn>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="label-xs mb-2 flex items-center gap-2">
              <CalendarDays className="size-3" aria-hidden />
              League pulse · {longDateLabel(today)}
            </p>
            <h1 className="max-w-2xl text-3xl font-semibold leading-[1.1] tracking-tight sm:text-[2.6rem]">
              Where the league is <span className="text-gradient">moving</span>.
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-mist-400">
              {travelling.length} teams are on the road or in transit. {todayGames.length} games on the board,{" "}
              {live.length} in progress.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <MetaLine meta={meta} />
            <Link
              href="/map"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-mint-400 px-3.5 text-xs font-bold text-ink-950 transition-colors hover:bg-mint-300"
            >
              Open travel map
              <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </div>
        </div>
      </FadeIn>

      <section aria-label="League summary" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Games today" value={todayGames.length} hint={`${upcoming.length} upcoming · ${live.length} live`} />
        <Stat label="Live now" value={live.length} tone={live.length > 0 ? "mint" : "default"} hint={ds.mode === "live" ? "ESPN scoreboard" : "Simulated scores"} />
        <Stat
          label="Teams travelling"
          value={travelling.length}
          hint={travelling.slice(0, 2).map((t) => TEAM_BY_ID[t.teamId].abbreviation).join(" · ") || "—"}
        />
        <Stat
          label="Avg fatigue"
          value={`${avgFatigue}`}
          tone={avgFatigue >= 60 ? "amber" : avgFatigue >= 40 ? "default" : "mint"}
          hint="0–100 Travel Fatigue Index"
        />
        <Stat
          label="Model hit rate"
          value={pct(ds.report.accuracy, 1)}
          hint={`${ds.report.games} backtested games`}
        />
        <Stat
          label="Skill vs baseline"
          value={`${skillScore(ds.report) > 0 ? "+" : ""}${skillScore(ds.report)}%`}
          tone={skillScore(ds.report) > 0.5 ? "mint" : skillScore(ds.report) >= -1.5 ? "default" : "danger"}
          hint={Math.abs(skillScore(ds.report)) < 1.5 ? "Within noise of Elo-only" : "Brier vs Elo-only"}
        />
      </section>

      {live.length > 0 ? (
        <FadeIn>
          <Card className="border-rose-400/20 bg-rose-400/[0.04]">
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  <Radio className="size-4 text-rose-300" aria-hidden />
                  Live right now
                </span>
              }
              subtitle={
                ds.mode === "live"
                  ? "Real scores and clock from ESPN, refreshed every 20 seconds."
                  : "Scores advance with tipoff time — simulated, not real feeds."
              }
              action={<Badge tone="danger">{live.length} live</Badge>}
            />
            <CardBody className="grid gap-2 sm:grid-cols-2">
              {live.map((game) => {
                const away = TEAM_BY_ID[game.awayTeamId];
                const home = TEAM_BY_ID[game.homeTeamId];
                return (
                  <Link
                    key={game.id}
                    href={`/games/${game.id}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-[var(--hairline)] bg-ink-950/40 px-3 py-2.5 transition-colors hover:border-rose-300/30"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-xs font-medium text-mist-200">
                        {away.abbreviation} @ {home.abbreviation}
                      </span>
                      <span className="text-[10px] text-rose-300">{game.period} {game.clock}</span>
                    </div>
                    <span className="num text-sm font-bold text-mist-50">
                      {game.awayScore}–{game.homeScore}
                    </span>
                  </Link>
                );
              })}
            </CardBody>
          </Card>
        </FadeIn>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-8">
          <section aria-labelledby="slate-heading">
            <SectionHeading
              eyebrow="Live projections"
              title={slate.length > 0 && slate[0].date === today ? "Tonight's slate" : "Next games"}
              description="Winner, projected score and confidence from the Elo + fatigue model. Every card exposes its factors."
              action={
                <Link href="/predictions" className="text-xs font-semibold text-mint-300 hover:text-mint-200">
                  All predictions →
                </Link>
              }
            />
            <div className="grid gap-4 sm:grid-cols-2">
              {slate.map((game) => {
                const prediction = ds.predictions[game.id];
                if (!prediction) return null;
                return (
                  <PredictionCard key={game.id} game={game} prediction={prediction} />
                );
              })}
            </div>
            {slate.length === 0 ? (
              <Card className="px-5 py-10 text-center text-sm text-mist-400">
                No games scheduled in the current window. The mock calendar may have ended.
              </Card>
            ) : null}
          </section>

          <section aria-labelledby="trips-heading">
            <SectionHeading
              eyebrow="On the road"
              title="Road trips in motion"
              description="Consecutive road games grouped into trips. Miles and time zones are schedule estimates."
              action={
                <Link href="/map" className="text-xs font-semibold text-mint-300 hover:text-mint-200">
                  Map view →
                </Link>
              }
            />
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {trips.map((trip) => {
                const team = TEAM_BY_ID[trip.teamId];
                const metricsForTeam = ds.metrics[trip.teamId];
                const lastStop = trip.stops[trip.stops.length - 1];
                const prediction = lastStop ? ds.predictions[lastStop.gameId] : null;
                return (
                  <RoadTripCard
                    key={trip.id}
                    trip={trip}
                    team={team}
                    metrics={metricsForTeam}
                    prediction={prediction}
                  />
                );
              })}
            </div>
            {trips.length === 0 ? (
              <Card className="px-5 py-8 text-center text-sm text-mist-400">
                No active or imminent road trips in the next week.
              </Card>
            ) : null}
          </section>

          <section aria-labelledby="fatigue-heading">
            <SectionHeading
              eyebrow="Fatigue watch"
              title="Most travelled teams"
              description="Weighted index: miles, time zones, back-to-backs, rest, altitude, density and minutes."
              action={
                <Link href="/teams" className="text-xs font-semibold text-mint-300 hover:text-mint-200">
                  All 30 teams →
                </Link>
              }
            />
            <Card>
              <div className="divide-y divide-[var(--hairline)]">
                {leaders.map((m, index) => {
                  const team = TEAM_BY_ID[m.teamId];
                  return (
                    <div key={m.teamId} className="flex items-center gap-3 px-4 py-3">
                      <span className="num w-4 text-[11px] text-mist-600">{index + 1}</span>
                      <TeamLink team={team} size="sm" className="w-36 shrink-0" />
                      <div className="hidden min-w-0 flex-1 sm:block">
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${m.fatigueIndex}%`,
                              background:
                                m.fatigueIndex >= 65 ? "#fb7185" : m.fatigueIndex >= 45 ? "#ffcb6b" : "#52e5b0",
                            }}
                          />
                        </div>
                        <p className="mt-1 text-[10px] text-mist-500">
                          {m.miles7.toLocaleString()} mi · {m.timeZones7} zones · {m.backToBacks7} B2B ·{" "}
                          {m.restDays}d rest
                        </p>
                      </div>
                      <div className="ml-auto flex items-center gap-2">
                        <TravelStatusChip metrics={m} />
                        <FatigueChip band={m.fatigueBand} value={m.fatigueIndex} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </section>
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  <Activity className="size-4 text-amber-300" aria-hidden />
                  Travel feed
                </span>
              }
              subtitle="Derived alerts for trips, back-to-backs and fatigue."
            />
            <CardBody className="space-y-2">
              {ds.alerts
                .filter((a) => a.severity !== "info")
                .slice(0, 4)
                .map((alert) => (
                  <AlertItem key={alert.id} alert={alert} team={alert.teamId ? TEAM_BY_ID[alert.teamId] : undefined} />
                ))}
              {ds.alerts.filter((a) => a.severity !== "info").length === 0 ? (
                <p className="py-6 text-center text-xs text-mist-500">No elevated alerts right now.</p>
              ) : null}
              <Link
                href="/watchlist"
                className="mt-1 flex items-center justify-between rounded-lg px-1 py-1 text-[11px] font-semibold text-mist-400 hover:text-mint-300"
              >
                Personalise alerts with a watchlist
                <ArrowRight className="size-3" aria-hidden />
              </Link>
            </CardBody>
            <div className="border-t border-[var(--hairline)] px-5 py-2.5">
              <ProvenanceBadge meta={meta} />
            </div>
          </Card>

          <Card>
            <CardHeader title="Tonight's travel board" subtitle="Every team's state, compact." />
            <CardBody className="space-y-1.5">
              {[...metrics]
                .sort((a, b) => TEAM_BY_ID[a.teamId].abbreviation.localeCompare(TEAM_BY_ID[b.teamId].abbreviation))
                .slice(0, 8)
                .map((m) => {
                  const team = TEAM_BY_ID[m.teamId];
                  const next = m.nextGame;
                  const opponent = next
                    ? TEAM_BY_ID[next.homeTeamId === team.id ? next.awayTeamId : next.homeTeamId]
                    : null;
                  return (
                    <Link
                      key={m.teamId}
                      href={`/teams/${team.id}`}
                      className="flex items-center gap-2 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-white/[0.04]"
                    >
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: team.colors.primary }}
                        aria-hidden
                      />
                      <span className="w-9 text-[11px] font-bold text-mist-300">{team.abbreviation}</span>
                      <span className="min-w-0 flex-1 truncate text-[11px] text-mist-500">
                        {m.status === "home" || m.status === "rest_day" ? team.city : m.trip?.cities.at(-1) ?? team.city}
                        {opponent ? ` · vs ${opponent.abbreviation}` : ""}
                      </span>
                      <span className="num text-[11px] text-mist-400">{m.fatigueIndex}</span>
                    </Link>
                  );
                })}
              <Divider className="my-2" />
              <div className="flex items-center justify-between text-[10px] text-mist-500">
                <span className="flex items-center gap-1">
                  <Gauge className="size-3" aria-hidden /> Avg {avgFatigue}/100
                </span>
                <span className="flex items-center gap-1">
                  <PlaneTakeoff className="size-3" aria-hidden /> {travelling.length} travelling
                </span>
              </div>
            </CardBody>
          </Card>

          <Card className="border-mint-400/20 bg-gradient-to-b from-mint-400/[0.06] to-transparent">
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  <Sparkles className="size-4 text-mint-300" aria-hidden />
                  How this works
                </span>
              }
              subtitle="Short version of the methodology."
            />
            <CardBody className="space-y-2 text-[11px] leading-relaxed text-mist-400">
              <p>
                Travel is reconstructed from schedule city changes and great-circle airport distances. It is{" "}
                <strong className="text-mist-200">estimated</strong>, not tracked.
              </p>
              <p>
                Projections combine Elo strength, home court, rest, back-to-backs, 7-day mileage, time zones, altitude and
                modelled injuries — then compare against an Elo-only baseline.
              </p>
              <Link href="/methodology" className="inline-flex items-center gap-1 font-semibold text-mint-300 hover:text-mint-200">
                Read the methodology
                <ArrowRight className="size-3" aria-hidden />
              </Link>
            </CardBody>
            <div className="border-t border-[var(--hairline)] px-5 py-2.5">
              <p className="flex items-center gap-1.5 text-[10px] text-mist-500">
                <Route className="size-3" aria-hidden />
                {sampleWarning(ds.report.games) ?? `${ds.report.games} games backtested · window ${ds.report.windowStart} → ${ds.report.windowEnd}`}
              </p>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function addDaysShort(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
