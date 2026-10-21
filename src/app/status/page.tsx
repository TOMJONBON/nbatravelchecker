import Link from "next/link";
import { Activity, CheckCircle2, CircleSlash, Database, KeyRound, RefreshCw } from "lucide-react";
import { getStatus } from "@/lib/data";
import { skillScore } from "@/lib/model";
import { pct } from "@/lib/utils";
import { Badge, Card, CardBody, CardHeader, Divider, PageHeader, Stat } from "@/components/ui";
import { MetaLine, ProvenanceBadge } from "@/components/domain";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Data status",
  description: "Live state of every data source, model health and API endpoints.",
};

const ENDPOINTS = [
  { path: "/api/teams", description: "All teams with travel metrics and next game" },
  { path: "/api/teams/bos/travel", description: "Team travel metrics, trips and legs" },
  { path: "/api/games?date=YYYY-MM-DD", description: "Games for a league date" },
  { path: "/api/predictions?date=YYYY-MM-DD", description: "Projections plus model report" },
  { path: "/api/players/bos-p1/travel-impact?season=all", description: "Player splits and adjusted model" },
  { path: "/api/map/travel?date=YYYY-MM-DD&team=bos", description: "Map payload: teams, trips, routes" },
  { path: "/api/status", description: "This page as JSON" },
];

export default async function StatusPage() {
  const status = await getStatus();
  const mockCount = status.status.filter((s) => s.mode === "mock").length;
  const liveCount = status.status.filter((s) => s.mode === "live").length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operations"
        title="Data source status"
        description="What is connected, what is estimated, and what is synthetic — plus the health of the prediction model."
      >
        <MetaLine meta={status.meta} />
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Sources live" value={liveCount} hint={`${mockCount} in mock mode`} tone={liveCount > 0 ? "mint" : "amber"} />
        <Stat label="Mode" value={status.mode === "live" ? "Live" : "Mock"} hint={status.mode === "live" ? "ESPN public API" : "Synthetic fallback"} tone={status.mode === "live" ? "mint" : "amber"} />
        <Stat label="Teams" value={status.counts.teams} hint="Static seed data" />
        <Stat label="Games in dataset" value={status.counts.games.toLocaleString()} hint="Mock calendar" />
        <Stat label="Predictions" value={status.counts.predictions.toLocaleString()} hint={`${status.counts.records} graded`} />
      </div>

      <Card>
        <CardHeader
          title="Providers"
          subtitle="Keys are read server-side only and never shipped to the browser."
          action={<Badge tone={status.mode === "live" ? "mint" : "amber"}>{status.mode === "live" ? "Live mode" : "Mock fallback"}</Badge>}
        />
        <CardBody className="px-0 pb-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-[11px]">
              <thead>
                <tr className="text-left text-[9px] uppercase tracking-wider text-mist-600">
                  <th className="px-5 py-2 font-semibold">Source</th>
                  <th className="px-2 py-2 font-semibold">Category</th>
                  <th className="px-2 py-2 font-semibold">Configured</th>
                  <th className="px-2 py-2 font-semibold">Mode</th>
                  <th className="px-2 py-2 font-semibold">Last checked</th>
                  <th className="px-5 py-2 font-semibold">Notes</th>
                </tr>
              </thead>
              <tbody>
                {status.status.map((source) => (
                  <tr key={source.id} className="border-t border-[var(--hairline)] align-top">
                    <td className="px-5 py-2.5">
                      <p className="font-medium text-mist-200">{source.name}</p>
                      {source.envVar ? (
                        <p className="mt-0.5 flex items-center gap-1 font-mono text-[9px] text-mist-600">
                          <KeyRound className="size-2.5" aria-hidden />
                          {source.envVar}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-2 py-2.5 text-mist-400">{source.category}</td>
                    <td className="px-2 py-2.5">
                      {source.configured ? (
                        <span className="inline-flex items-center gap-1 text-emerald-300">
                          <CheckCircle2 className="size-3" aria-hidden /> yes
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-mist-500">
                          <CircleSlash className="size-3" aria-hidden /> no
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2.5">
                      <ProvenanceBadge
                        meta={{
                          provenance: source.mode,
                          source: source.name,
                          updatedAt: source.lastChecked,
                        }}
                        compact
                      />
                    </td>
                    <td className="num px-2 py-2.5 text-mist-500">{source.lastChecked.slice(11, 19)} UTC</td>
                    <td className="max-w-[320px] px-5 py-2.5 text-mist-500">{source.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
        <div className="border-t border-[var(--hairline)] px-5 py-2.5">
          <p className="text-[10px] text-mist-500">
            Mode is never upgraded automatically: a provider must answer successfully before a widget can show Live.
          </p>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <Activity className="size-4 text-mint-300" aria-hidden />
                Model health
              </span>
            }
            subtitle={`${status.report.modelVersion} · ${status.report.games} graded games · season ${status.season.current}`}
          />
          <CardBody className="grid grid-cols-2 gap-3">
            <Stat label="Accuracy" value={pct(status.report.accuracy, 1)} hint={`baseline ${pct(status.report.baselineAccuracy, 1)}`} />
            <Stat
              label="Skill score"
              value={`${skillScore(status.report) > 0 ? "+" : ""}${skillScore(status.report)}%`}
              hint="Brier vs baseline"
              tone={skillScore(status.report) > 0 ? "mint" : "danger"}
            />
            <Stat label="Brier" value={status.report.brier.toFixed(4)} hint={`baseline ${status.report.baselineBrier.toFixed(4)}`} />
            <Stat label="Log loss" value={status.report.logLoss.toFixed(4)} hint="Lower is better" />
            <Stat
              label="Live ledger"
              value={status.ledger.graded > 0 ? pct(status.ledger.accuracy ?? 0, 1) : "—"}
              hint={`${status.ledger.graded}/${status.ledger.entries} graded · ${status.ledger.storage}`}
            />
            <Stat
              label="Offseason mode"
              value={status.season.offseason ? "Yes" : "No"}
              hint={status.season.offseason ? `Showing ${status.season.current}` : `Fit ${status.season.fit}`}
            />
          </CardBody>
          <div className="border-t border-[var(--hairline)] px-5 py-3">
            <p className="label-xs mb-1.5">Fitted coefficients</p>
            <p className="num text-[10px] leading-relaxed text-mist-400">
              Elo {status.coefficients.elo.toFixed(4)} · home {status.coefficients.home.toFixed(2)} · rest{" "}
              {status.coefficients.rest.toFixed(2)} · B2B {status.coefficients.b2b.toFixed(2)} · miles/1k{" "}
              {status.coefficients.miles.toFixed(3)} · zones {status.coefficients.tz.toFixed(2)} · altitude{" "}
              {status.coefficients.altitude.toFixed(2)} · injury {status.coefficients.injury.toFixed(2)}
            </p>
            <p className="mt-1 text-[10px] text-mist-500">
              Fitted on {status.season.fit}, evaluated out-of-sample · window {status.report.windowStart} →{" "}
              {status.report.windowEnd}
            </p>
          </div>
        </Card>

        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <RefreshCw className="size-4 text-iris-300" aria-hidden />
                How live updates work
              </span>
            }
            subtitle={status.mode === "live" ? "Live via ESPN · refreshing every 20 seconds" : "Synthetic fallback is active"}
          />
          <CardBody className="space-y-2 text-[11px] leading-relaxed text-mist-400">
            <p>
              Scores, period and clock come from ESPN&apos;s scoreboard and are polled every 15&nbsp;s; the UI refreshes
              every 20&nbsp;s and pauses when the tab is hidden. Injuries refresh every 60&nbsp;s, schedules every 10
              minutes, rosters every 60 minutes and player logs every 10 minutes.
            </p>
            <p>
              If a refresh fails, the last good payload is served (stale-on-error). If the feed cannot be reached at all,
              the app falls back to the synthetic engine, the banner switches to Mock, and no widget claims to be live.
            </p>
            <p className="text-mist-500">
              Public endpoints are not a production contract: for commercial use, swap the adapter in{" "}
              <code className="text-mist-300">src/lib/providers/espn.ts</code> for a licensed provider.
            </p>
            <Divider />
            <p className="flex items-center gap-1.5 text-[10px] text-mist-500">
              <Database className="size-3" aria-hidden />
              No database is required; predictions are recomputed from the current data on each refresh.
            </p>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="API endpoints" subtitle="All JSON, cached for 15–60 seconds, all rate limited." />
        <CardBody className="space-y-1">
          {ENDPOINTS.map((endpoint) => (
            <div key={endpoint.path} className="flex flex-col gap-0.5 rounded-lg px-2 py-1.5 hover:bg-white/[0.03] sm:flex-row sm:items-center sm:justify-between">
              <code className="font-mono text-[11px] text-mint-300">{endpoint.path}</code>
              <span className="text-[10px] text-mist-500">{endpoint.description}</span>
            </div>
          ))}
        </CardBody>
        <div className="border-t border-[var(--hairline)] px-5 py-2.5">
          <p className="text-[10px] text-mist-500">
            Try the{" "}
            <Link href="/api/status" className="underline decoration-dotted hover:text-mist-300">
              status endpoint
            </Link>{" "}
            directly. Responses include a `meta` block with provenance and last-updated time.
          </p>
        </div>
      </Card>
    </div>
  );
}
