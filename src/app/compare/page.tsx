import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftRight } from "lucide-react";
import { getDataset, getTeamDetail } from "@/lib/data";
import { TEAM_BY_ID } from "@/lib/teams";
import { pct } from "@/lib/utils";
import { Badge, Card, CardBody, CardHeader, Divider, PageHeader } from "@/components/ui";
import { FatigueChip, FatigueGauge, MetaLine, TeamMark, TravelStatusChip } from "@/components/domain";
import { CompareSelector } from "@/components/compare-selector";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Compare",
  description: "Compare two teams' travel load, road performance and player travel sensitivity.",
};

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ teams?: string }>;
}) {
  const sp = await searchParams;
  const parts = (sp.teams ?? "bos,den").split(",");
  const leftId = TEAM_BY_ID[parts[0]] ? parts[0] : "bos";
  const rightId = TEAM_BY_ID[parts[1]] ? parts[1] : "den";
  if (!TEAM_BY_ID[leftId] || !TEAM_BY_ID[rightId]) notFound();

  const ds = await getDataset();
  const left = TEAM_BY_ID[leftId];
  const right = TEAM_BY_ID[rightId];
  const lm = ds.metrics[leftId];
  const rm = ds.metrics[rightId];
  const [leftDetail, rightDetail] = await Promise.all([
    getTeamDetail(leftId),
    getTeamDetail(rightId),
  ]);

  const rows = [
    { label: "Fatigue index", left: lm.fatigueIndex, right: rm.fatigueIndex, higherBetter: false },
    { label: "Miles · 7 days", left: lm.miles7, right: rm.miles7, higherBetter: false, format: "miles" },
    { label: "Miles · 14 days", left: lm.miles14, right: rm.miles14, higherBetter: false, format: "miles" },
    { label: "Time zones · 7d", left: lm.timeZones7, right: rm.timeZones7, higherBetter: false },
    { label: "Back-to-backs · 7d", left: lm.backToBacks7, right: rm.backToBacks7, higherBetter: false },
    { label: "Games · 7d", left: lm.games7, right: rm.games7, higherBetter: false },
    { label: "Rest days", left: lm.restDays, right: rm.restDays, higherBetter: true },
  ];

  const recordRows = [
    {
      label: "Overall",
      left: `${lm.homeRecord.wins + lm.roadRecord.wins}-${lm.homeRecord.losses + lm.roadRecord.losses}`,
      right: `${rm.homeRecord.wins + rm.roadRecord.wins}-${rm.homeRecord.losses + rm.roadRecord.losses}`,
    },
    { label: "Road", left: `${lm.roadRecord.wins}-${lm.roadRecord.losses}`, right: `${rm.roadRecord.wins}-${rm.roadRecord.losses}` },
    { label: "Home", left: `${lm.homeRecord.wins}-${lm.homeRecord.losses}`, right: `${rm.homeRecord.wins}-${rm.homeRecord.losses}` },
    { label: "Road win %", left: pct(lm.roadRecord.winPct, 1), right: pct(rm.roadRecord.winPct, 1) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Compare mode"
        title="Two teams, one lens"
        description="Side-by-side travel load, road performance and the players most sensitive to travel in each rotation."
      >
        <MetaLine meta={ds.meta} />
      </PageHeader>

      <CompareSelector left={leftId} right={rightId} />

      <div className="grid gap-4 md:grid-cols-2">
        {[
          { team: left, metrics: lm },
          { team: right, metrics: rm },
        ].map(({ team, metrics }) => (
          <Card key={team.id} className="relative overflow-hidden">
            <span
              className="absolute inset-x-0 top-0 h-0.5"
              style={{ background: team.colors.primary }}
              aria-hidden
            />
            <div className="flex items-start justify-between gap-3 p-5">
              <div className="flex items-center gap-3">
                <TeamMark team={team} size="md" />
                <div>
                  <Link href={`/teams/${team.id}`} className="text-sm font-semibold text-mist-100 hover:text-mint-200">
                    {team.name}
                  </Link>
                  <p className="text-[10px] uppercase tracking-[0.12em] text-mist-500">
                    {team.conference} · {team.division}
                  </p>
                  <div className="mt-1.5">
                    <TravelStatusChip metrics={metrics} />
                  </div>
                </div>
              </div>
              <FatigueGauge value={metrics.fatigueIndex} band={metrics.fatigueBand} size={104} />
            </div>
            <div className="flex items-center justify-between border-t border-[var(--hairline)] px-5 py-2.5">
              <FatigueChip band={metrics.fatigueBand} value={metrics.fatigueIndex} />
              <span className="text-[10px] text-mist-500">
                {metrics.miles7.toLocaleString()} mi · {metrics.timeZones7} zones
              </span>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader
            title="Travel & rest"
            subtitle="Lower travel load is better; highlight marks the less-travelled side."
            action={<ArrowLeftRight className="size-4 text-mist-500" aria-hidden />}
          />
          <CardBody className="px-0 pb-2">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-left text-[9px] uppercase tracking-wider text-mist-600">
                  <th className="px-5 py-1.5 font-semibold">Metric</th>
                  <th className="px-2 py-1.5 text-right font-semibold">{left.abbreviation}</th>
                  <th className="px-5 py-1.5 text-right font-semibold">{right.abbreviation}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const leftWins = row.higherBetter ? row.left > row.right : row.left < row.right;
                  const rightWins = row.higherBetter ? row.right > row.left : row.right < row.left;
                  return (
                    <tr key={row.label} className="border-t border-[var(--hairline)]">
                      <td className="px-5 py-2 text-mist-400">{row.label}</td>
                      <td className={`num px-2 py-2 text-right ${leftWins ? "font-semibold text-mint-300" : "text-mist-300"}`}>
                        {row.format === "miles" ? row.left.toLocaleString() : row.left}
                      </td>
                      <td className={`num px-5 py-2 text-right ${rightWins ? "font-semibold text-mint-300" : "text-mist-300"}`}>
                        {row.format === "miles" ? row.right.toLocaleString() : row.right}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <Divider className="my-2" />
            <table className="w-full text-[11px]">
              <tbody>
                {recordRows.map((row) => (
                  <tr key={row.label} className="border-t border-[var(--hairline)]">
                    <td className="px-5 py-2 text-mist-400">{row.label}</td>
                    <td className="num px-2 py-2 text-right text-mist-200">{row.left}</td>
                    <td className="num px-5 py-2 text-right text-mist-200">{row.right}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Next trip difficulty" subtitle="Total estimated miles on the next/active trip." />
          <CardBody className="space-y-3">
            {[
              { team: left, metrics: lm },
              { team: right, metrics: rm },
            ].map(({ team, metrics }) => (
              <div key={team.id}>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[11px] text-mist-300">
                    <TeamMark team={team} size="xs" />
                    {team.abbreviation}
                  </span>
                  <span className="num text-[11px] font-semibold text-mist-200">
                    {metrics.trip ? `${metrics.trip.totalMiles.toLocaleString()} mi` : "—"}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-[10px] text-mist-500">
                  {metrics.trip ? metrics.trip.cities.join(" → ") : "No road trip scheduled"}
                </p>
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, ((metrics.trip?.totalMiles ?? 0) / 7000) * 100)}%`,
                      background: team.colors.primary,
                    }}
                  />
                </div>
              </div>
            ))}
            <Divider className="my-2" />
            <p className="text-[10px] leading-relaxed text-mist-500">
              Trip difficulty is mileage-only in this MVP. A composite difficulty score (zones, back-to-backs, altitude,
              opponent quality) is planned.
            </p>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Most travel-sensitive players"
          subtitle="2025-26 sample, adjusted for minutes and opponent quality."
        />
        <CardBody className="grid gap-4 md:grid-cols-2">
          {[leftDetail, rightDetail].map((detail) => {
            if (!detail) return null;
            const team = detail.team;
            const top = detail.rosterSummaries
              .slice()
              .sort((a, b) => (b.impact?.travelImpactScore ?? -1) - (a.impact?.travelImpactScore ?? -1))
              .slice(0, 3);
            return (
              <div key={team.id}>
                <div className="mb-2 flex items-center gap-2">
                  <TeamMark team={team} size="xs" />
                  <p className="text-[11px] font-semibold text-mist-300">{team.abbreviation}</p>
                </div>
                <ul className="space-y-1">
                  {top.map(({ player, impact }) => (
                    <li key={player.id}>
                      <Link
                        href={`/players/${player.id}`}
                        className="flex items-center gap-2 rounded-lg px-1 py-1 text-[11px] hover:bg-white/[0.04]"
                      >
                        <span className="min-w-0 flex-1 truncate text-mist-300">{player.name}</span>
                        <span className="num text-[10px] text-mist-500">
                          {player.statsKnown ? `${player.minutesPerGame}m` : `#${player.number}`}
                        </span>
                        {impact ? (
                          <span
                            className={`num rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                              impact.travelImpactScore >= 60
                                ? "bg-rose-400/10 text-rose-300"
                                : "bg-mint-400/10 text-mint-300"
                            }`}
                          >
                            {impact.travelImpactScore}
                          </span>
                        ) : (
                          <span className="text-[10px] text-mist-500">→</span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </CardBody>
        <div className="border-t border-[var(--hairline)] px-5 py-2.5">
          <p className="text-[10px] text-mist-500">
            Score 0–100: higher means the fitted model attributes more scoring swing to travel conditions.
          </p>
        </div>
      </Card>
    </div>
  );
}
