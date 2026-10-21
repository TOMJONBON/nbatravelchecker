import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, Info, Plane, ShieldAlert } from "lucide-react";
import { getPlayerDetail, getTeamMetrics } from "@/lib/data";
import { MIN_SPLIT_SAMPLE } from "@/lib/player-impact";
import { TEAM_BY_ID } from "@/lib/teams";
import { monthDayLabel } from "@/lib/time";
import { cn, pct } from "@/lib/utils";
import { Badge, Card, CardBody, CardHeader, Divider, PageHeader } from "@/components/ui";
import { MetaLine, ProvenanceBadge, TeamMark } from "@/components/domain";
import { SplitBars } from "@/components/charts";
import { WatchButton } from "@/components/watch-button";
import { FadeIn } from "@/components/motion";
import type { Split } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getPlayerDetail(id, "all");
  return { title: detail ? detail.player.name : "Player" };
}

const seasonLinksFor = (detail: { seasons: { id: string; label: string }[] }) => [
  { key: "all", label: "All games" },
  { key: "current", label: detail.seasons[0]?.label ?? "Current" },
  { key: "previous", label: detail.seasons[1]?.label ?? "Previous" },
];

export default async function PlayerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ season?: string }>;
}) {
  const { id } = await params;
  const { season = "all" } = await searchParams;
  const detail = await getPlayerDetail(id, season);
  if (!detail) notFound();

  const { player, team, impact, seasonId, recentLogs } = detail;
  const teamMetrics = await getTeamMetrics(team.id);
  const lowSample = impact.games < 30;

  const groups: { title: string; subtitle: string; splits: Split[] }[] = [
    { title: "Back-to-back", subtitle: "Second game in two nights vs rested", splits: impact.splits.backToBack },
    { title: "Miles in prior 7 days", subtitle: "Schedule-derived flight distance", splits: impact.splits.miles },
    { title: "Rest days", subtitle: "Full days between games", splits: impact.splits.rest },
    { title: "Time zones", subtitle: "Absolute zone changes in prior 7 days", splits: impact.splits.timeZones },
    { title: "Altitude", subtitle: "Games at 4,000 ft or higher", splits: impact.splits.altitude },
    { title: "Home / road", subtitle: "Location split", splits: impact.splits.location },
  ];

  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb" className="text-[11px] text-mist-500">
        <Link href="/teams" className="hover:text-mist-200">
          Teams
        </Link>
        <span className="mx-1.5">/</span>
        <Link href={`/teams/${team.id}`} className="hover:text-mist-200">
          {team.nickname}
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-mist-300">{player.name}</span>
      </nav>

      <FadeIn>
        <Card className="relative overflow-hidden">
          <div
            className="absolute inset-0 opacity-[0.1]"
            style={{
              background: `radial-gradient(700px 260px at 15% 0%, ${team.colors.primary}, transparent 65%)`,
            }}
            aria-hidden
          />
          <div className="relative flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="flex items-center gap-4">
              <div
                className="grid size-16 place-items-center rounded-2xl text-xl font-black text-white shadow-lg"
                style={{ background: `linear-gradient(145deg, ${team.colors.primary}, ${team.colors.secondary})` }}
                aria-hidden
              >
                {player.number}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="outline">{player.position}</Badge>
                  <span className="text-[11px] text-mist-400">
                    {team.name} · {player.age} yrs · {Math.floor(player.heightIn / 12)}'{player.heightIn % 12}"
                  </span>
                </div>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight text-mist-50 sm:text-3xl">{player.name}</h1>
                <p className="mt-1 text-xs text-mist-400">
                  {player.statsKnown
                    ? `${player.minutesPerGame} min · ${player.pointsPer36} pts/36`
                    : `${player.heightIn ? `${Math.floor(player.heightIn / 12)}'${player.heightIn % 12}" · ` : ""}#${player.number}`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="label-xs">Travel impact</p>
                <p className="num text-3xl font-semibold text-mist-50">{impact.travelImpactScore}</p>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-mint-300">{impact.impactLabel}</p>
                <p className="mt-1 text-[10px] text-mist-500">{impact.games} games in sample</p>
                <div className="mt-2 flex justify-end">
                  <WatchButton kind="player" id={player.id} label="Watch" name={player.name} teamId={player.teamId} />
                </div>
              </div>
              <div className="relative size-20">
                <svg viewBox="0 0 36 36" className="size-20 -rotate-90">
                  <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
                  <circle
                    cx="18"
                    cy="18"
                    r="15"
                    fill="none"
                    stroke={impact.travelImpactScore >= 65 ? "#fb7185" : impact.travelImpactScore >= 50 ? "#ffcb6b" : "#52e5b0"}
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={`${(impact.travelImpactScore / 100) * 94.2} 94.2`}
                  />
                </svg>
              </div>
            </div>
          </div>
          <div className="relative flex flex-wrap items-center justify-between gap-3 border-t border-[var(--hairline)] px-5 py-2.5">
            <MetaLine meta={detail.meta} />
            <div className="flex items-center gap-1 rounded-lg border border-[var(--hairline)] bg-white/[0.02] p-0.5">
              {seasonLinksFor(detail).map((option) => (
                <Link
                  key={option.key}
                  href={`/players/${player.id}?season=${option.key}`}
                  className={cn(
                    "rounded-md px-2 py-1 text-[10px] font-semibold",
                    (option.key === "all" && seasonId === "all") ||
                      (option.key === "current" && seasonId === detail.seasons[0]?.id) ||
                      (option.key === "previous" && seasonId === detail.seasons[1]?.id)
                      ? "bg-white/[0.08] text-mist-100"
                      : "text-mist-500 hover:text-mist-200",
                  )}
                >
                  {option.label}
                </Link>
              ))}
            </div>
          </div>
        </Card>
      </FadeIn>

      {lowSample ? (
        <div className="flex items-start gap-2 rounded-xl border border-amber-300/25 bg-amber-300/[0.06] px-3 py-2.5 text-[11px] text-amber-200">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <p>
            Small sample: {impact.games} games. Splits with n &lt; {MIN_SPLIT_SAMPLE} are descriptive only, and the adjusted
            model requires at least 30 games.
          </p>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Travel impact explained"
              subtitle="What the adjusted model says, with uncertainty."
              action={<ProvenanceBadge meta={detail.meta} compact />}
            />
            <CardBody className="space-y-2">
              <ul className="space-y-1.5 text-[12px] leading-relaxed text-mist-300">
                {impact.explanation.map((line, index) => (
                  <li key={index} className="flex gap-2">
                    <span className="mt-1.5 size-1 shrink-0 rounded-full bg-mint-400" aria-hidden />
                    {line}
                  </li>
                ))}
              </ul>
              <Divider className="my-3" />
              <p className="text-[11px] leading-relaxed text-mist-500">
                The score combines the fitted back-to-back, mileage, time-zone and altitude coefficients into a single
                0–100 sensitivity estimate. It is not an injury-risk score.
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Performance by travel condition" subtitle={`Season: ${seasonId === "all" ? "all games" : seasonId}`} />
            <CardBody className="grid gap-5 sm:grid-cols-2">
              {groups.map((group) => (
                <div key={group.title}>
                  <div className="mb-1 flex items-baseline justify-between">
                    <p className="label-xs">{group.title}</p>
                    <span className="text-[9px] text-mist-600">{group.subtitle}</span>
                  </div>
                  <SplitBars splits={group.splits.filter((s) => s.n > 0)} height={150} />
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {group.splits.map((split) => (
                      <span
                        key={split.key}
                        className={cn(
                          "rounded border px-1.5 py-0.5 text-[9px]",
                          split.n >= MIN_SPLIT_SAMPLE
                            ? "border-[var(--hairline)] text-mist-400"
                            : "border-amber-300/25 text-amber-200/80",
                        )}
                        title={split.n < MIN_SPLIT_SAMPLE ? "Small sample" : "Adequate sample"}
                      >
                        {split.label}: n={split.n}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Split table" subtitle="Per-game means with 95% confidence intervals for points." />
            <CardBody className="px-0 pb-2">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-[11px]">
                  <thead>
                    <tr className="text-left text-[9px] uppercase tracking-wider text-mist-600">
                      <th className="px-5 py-1.5 font-semibold">Split</th>
                      <th className="px-2 py-1.5 text-right font-semibold">n</th>
                      <th className="px-2 py-1.5 text-right font-semibold">PTS</th>
                      <th className="px-2 py-1.5 text-right font-semibold">±95%</th>
                      <th className="px-2 py-1.5 text-right font-semibold">MIN</th>
                      <th className="px-2 py-1.5 text-right font-semibold">FG%</th>
                      <th className="px-2 py-1.5 text-right font-semibold">3P%</th>
                      <th className="px-2 py-1.5 text-right font-semibold">TOV</th>
                      <th className="px-5 py-1.5 text-right font-semibold">+/-</th>
                    </tr>
                  </thead>
                  <tbody>
                    {impact.splits.backToBack.concat(
                      impact.splits.miles,
                      impact.splits.rest,
                      impact.splits.timeZones,
                      impact.splits.altitude,
                      impact.splits.location,
                    ).map((split) => (
                      <tr key={split.key} className={cn("border-t border-[var(--hairline)]", split.n < MIN_SPLIT_SAMPLE && "text-mist-500")}>
                        <td className="px-5 py-1.5">
                          {split.label}
                          {split.n < MIN_SPLIT_SAMPLE ? (
                            <span className="ml-1.5 text-[9px] text-amber-200/70" title="Small sample">
                              low n
                            </span>
                          ) : null}
                        </td>
                        <td className="num px-2 py-1.5 text-right">{split.n}</td>
                        <td className="num px-2 py-1.5 text-right font-semibold text-mist-200">{split.pts.toFixed(1)}</td>
                        <td className="num px-2 py-1.5 text-right text-mist-500">±{split.ci.toFixed(1)}</td>
                        <td className="num px-2 py-1.5 text-right">{split.min.toFixed(1)}</td>
                        <td className="num px-2 py-1.5 text-right">{pct(split.fgPct, 1)}</td>
                        <td className="num px-2 py-1.5 text-right">{pct(split.fg3Pct, 1)}</td>
                        <td className="num px-2 py-1.5 text-right">{split.tov.toFixed(1)}</td>
                        <td className="num px-5 py-1.5 text-right">
                          {detail.mode === "live" ? "—" : `${split.plusMinus > 0 ? "+" : ""}${split.plusMinus.toFixed(1)}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Recent games" subtitle="Travel context for the last appearances." />
            <CardBody className="px-0 pb-2">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-[11px]">
                  <thead>
                    <tr className="text-left text-[9px] uppercase tracking-wider text-mist-600">
                      <th className="px-5 py-1.5 font-semibold">Date</th>
                      <th className="px-2 py-1.5 font-semibold">Opp</th>
                      <th className="px-2 py-1.5 text-right font-semibold">MIN</th>
                      <th className="px-2 py-1.5 text-right font-semibold">PTS</th>
                      <th className="px-2 py-1.5 text-right font-semibold">7d mi</th>
                      <th className="px-2 py-1.5 text-right font-semibold">B2B</th>
                      <th className="px-5 py-1.5 text-right font-semibold">+/-</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentLogs.map((log) => (
                      <tr key={log.gameId} className="border-t border-[var(--hairline)]">
                        <td className="px-5 py-1.5 text-mist-400">{monthDayLabel(log.date)}</td>
                        <td className="px-2 py-1.5 text-mist-300">
                          {log.home ? "vs" : "@"} {TEAM_BY_ID[log.opponentId]?.abbreviation}
                        </td>
                        <td className="num px-2 py-1.5 text-right">{log.minutes}</td>
                        <td className="num px-2 py-1.5 text-right font-semibold text-mist-200">{log.points}</td>
                        <td className="num px-2 py-1.5 text-right text-mist-500">{log.miles7.toLocaleString()}</td>
                        <td className="px-2 py-1.5 text-right">
                          {log.backToBack ? <span className="text-rose-300">yes</span> : <span className="text-mist-600">—</span>}
                        </td>
                        <td className="num px-5 py-1.5 text-right">
                          {detail.mode === "live" ? "—" : `${log.plusMinus > 0 ? "+" : ""}${log.plusMinus}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader title="Adjusted model" subtitle="OLS on points per 36 minutes" />
            <CardBody className="space-y-2">
              {impact.model ? (
                <>
                  <div className="flex items-center justify-between rounded-lg bg-white/[0.03] px-2.5 py-2">
                    <span className="text-[11px] text-mist-400">Sample</span>
                    <span className="num text-[11px] font-semibold text-mist-200">{impact.model.n} games</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-white/[0.03] px-2.5 py-2">
                    <span className="text-[11px] text-mist-400">R²</span>
                    <span className="num text-[11px] font-semibold text-mist-200">{impact.model.r2.toFixed(3)}</span>
                  </div>
                  <Divider className="my-2" />
                  <ul className="space-y-2">
                    {impact.model.coefficients
                      .filter((c) => c.key !== "intercept")
                      .map((coefficient) => (
                        <li key={coefficient.key}>
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-[11px] text-mist-300">{coefficient.label}</span>
                            <span className="num text-[11px] font-semibold text-mist-100">
                              {coefficient.estimate > 0 ? "+" : ""}
                              {coefficient.estimate.toFixed(2)}
                            </span>
                          </div>
                          <p className="text-[9px] text-mist-600">
                            {coefficient.ci === 0 && coefficient.estimate === 0
                              ? "no games in this condition — coefficient not estimated"
                              : `±${coefficient.ci.toFixed(2)} (95% CI) · ${coefficient.unit}${
                                  Math.abs(coefficient.estimate) <= coefficient.ci
                                    ? " · not distinguishable from zero"
                                    : ""
                                }`}
                          </p>
                        </li>
                      ))}
                  </ul>
                  <Divider className="my-2" />
                  <p className="text-[10px] leading-relaxed text-mist-500">{impact.model.note}</p>
                  <p className="text-[9px] text-mist-600">Controls: {impact.model.controls.join(", ")}.</p>
                </>
              ) : (
                <div className="flex items-start gap-2 text-[11px] text-mist-400">
                  <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  <p>
                    Not enough games for an adjusted model (needs 30). Descriptive splits are shown, but they confound
                    opponent quality and minutes.
                  </p>
                </div>
              )}
            </CardBody>
          </Card>

          <Card className="border-amber-300/20">
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  <ShieldAlert className="size-4 text-amber-300" aria-hidden />
                  Caveats
                </span>
              }
              subtitle="Read before drawing conclusions."
            />
            <CardBody>
              <ul className="space-y-2 text-[11px] leading-relaxed text-mist-400">
                {impact.caveats.map((caveat) => (
                  <li key={caveat} className="flex gap-2">
                    <span className="mt-1.5 size-1 shrink-0 rounded-full bg-amber-300/70" aria-hidden />
                    {caveat}
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Team context" subtitle="Travel profile for the roster." />
            <CardBody className="space-y-2">
              <div className="flex items-center gap-2.5">
                <TeamMark team={team} size="sm" />
                <div>
                  <p className="text-xs font-semibold text-mist-200">{team.nickname}</p>
                  <p className="text-[10px] text-mist-500">{team.arena.name}</p>
                </div>
              </div>
              <Divider />
              <div className="flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1.5 text-mist-500">
                  <Plane className="size-3" aria-hidden /> Team 7d travel
                </span>
                <span className="num font-semibold text-mist-200">
                  {teamMetrics ? `${teamMetrics.miles7.toLocaleString()} mi` : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-mist-500">Team fatigue</span>
                <span className="num font-semibold text-mist-200">
                  {teamMetrics ? `${teamMetrics.fatigueIndex}/100` : "—"}
                </span>
              </div>
              <Link
                href={`/teams/${team.id}`}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-[var(--hairline)] bg-white/[0.03] px-3 py-2 text-[11px] font-semibold text-mist-200 hover:bg-white/[0.07]"
              >
                <ArrowLeft className="size-3" aria-hidden />
                Back to {team.nickname}
              </Link>
            </CardBody>
          </Card>
        </aside>
      </div>
    </div>
  );
}
