import Link from "next/link";
import { getDataset, getPredictionsForDate } from "@/lib/data";
import { calibrationError, sampleWarning, skillScore } from "@/lib/model";
import { addDays, longDateLabel, monthDayLabel, todayISO, weekdayLabel } from "@/lib/time";
import { pct } from "@/lib/utils";
import { Badge, Card, CardBody, CardHeader, Divider, EmptyState, PageHeader, Stat } from "@/components/ui";
import { MetaLine, PredictionCard, ProvenanceBadge } from "@/components/domain";
import { CalibrationChart } from "@/components/charts";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Predictions",
  description: "Transparent game projections with factor attribution, baseline comparison and calibration.",
};

const MODEL_NOTE =
  "Probabilities are a normal approximation around a projected margin. They are illustrative and not betting advice.";

export default async function PredictionsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const sp = await searchParams;
  const today = todayISO();
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;
  const ds = await getDataset();
  const payload = await getPredictionsForDate(date);
  const report = payload.report;
  const skill = skillScore(report);
  const warning = sampleWarning(report.games);

  const dayOptions = [addDays(today, -1), today, addDays(today, 1), addDays(today, 2), addDays(today, 3)];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Model output"
        title="Predictions, with the receipts"
        description="Each projection blends team strength with rest, travel, altitude and availability — and is scored against an Elo-only baseline over every completed game in the demo season."
      >
        <MetaLine meta={payload.meta} />
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2">
        {dayOptions.map((option) => {
          const active = option === date;
          const count = ds.games.filter((g) => g.date === option).length;
          return (
            <Link
              key={option}
              href={`/predictions?date=${option}`}
              aria-current={active ? "page" : undefined}
              className={
                active
                  ? "rounded-xl border border-mint-400/40 bg-mint-400/10 px-3 py-1.5 text-[11px] font-semibold text-mint-200"
                  : "rounded-xl border border-[var(--hairline)] bg-white/[0.02] px-3 py-1.5 text-[11px] font-medium text-mist-400 hover:text-mist-100"
              }
            >
              {option === today ? "Today" : option === addDays(today, -1) ? "Yesterday" : weekdayLabel(option)}{" "}
              <span className="text-mist-500">· {count}</span>
            </Link>
          );
        })}
      </div>

      <section aria-label="Model performance" className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader
            title="Model vs baseline"
            subtitle={`${report.modelVersion} · ${report.games} completed games (${report.windowStart} → ${report.windowEnd})`}
            action={<Badge tone={skill > 0 ? "mint" : "danger"}>{skill > 0 ? "+" : ""}{skill}% skill</Badge>}
          />
          <CardBody className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Winner accuracy" value={pct(report.accuracy, 1)} hint={`Baseline ${pct(report.baselineAccuracy, 1)}`} tone="mint" />
            <Stat label="Brier score" value={report.brier.toFixed(4)} hint={`Baseline ${report.baselineBrier.toFixed(4)} · lower is better`} />
            <Stat label="Log loss" value={report.logLoss.toFixed(4)} hint="Penalises confident mistakes" />
            <Stat label="Calibration error" value={`${calibrationError(report)} pts`} hint={`${report.calibration.length} probability buckets`} />
          </CardBody>
          <Divider />
          <CardBody className="pt-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="label-xs">Calibration</p>
              <p className="text-[10px] text-mist-500">Predicted home win % vs observed</p>
            </div>
            <CalibrationChart report={report} height={200} />
          </CardBody>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--hairline)] px-5 py-2.5">
            <ProvenanceBadge meta={payload.meta} />
            <p className="text-[10px] text-mist-500">
              {skill < 0
                ? `On the holdout season the fatigue terms did not beat Elo alone (${skill}% skill) — reported as-is.`
                : warning ?? "Sample size is adequate for a rough skill estimate."}
            </p>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Live ledger"
            subtitle="Pre-game snapshots captured since deployment, graded after the final buzzer."
            action={<Badge tone={payload.ledger.storage === "file" ? "mint" : "amber"}>{payload.ledger.storage}</Badge>}
          />
          <CardBody className="space-y-2">
            {payload.ledger.graded > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                <Stat label="Graded" value={payload.ledger.graded} hint={`${payload.ledger.entries} captured`} />
                <Stat label="Accuracy" value={pct(payload.ledger.accuracy ?? 0, 1)} />
                <Stat label="Brier" value={(payload.ledger.brier ?? 0).toFixed(3)} />
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-[var(--hairline-strong)] px-3 py-3 text-[11px] text-mist-400">
                {payload.ledger.entries > 0
                  ? `${payload.ledger.entries} projections captured — none have finished yet.`
                  : "No projections captured yet. The ledger fills as games approach."}
              </p>
            )}
            <p className="text-[10px] leading-relaxed text-mist-500">{payload.ledger.note}</p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Recent graded games" subtitle="Most recent predictions vs results." />
          <CardBody className="space-y-1">
            {report.recent.slice(0, 8).map((row) => (
              <div key={row.gameId} className="flex items-center gap-2 rounded-lg px-1 py-1.5">
                <span
                  className={`num grid size-5 shrink-0 place-items-center rounded text-[9px] font-bold ${
                    row.winnerCorrect ? "bg-mint-400/15 text-mint-300" : "bg-rose-400/10 text-rose-300"
                  }`}
                >
                  {row.winnerCorrect ? "✓" : "✕"}
                </span>
                <span className="w-11 shrink-0 text-[10px] text-mist-500">{monthDayLabel(row.date)}</span>
                <span className="min-w-0 flex-1 truncate text-[11px] text-mist-300">
                  {row.awayTeamId.toUpperCase()} @ {row.homeTeamId.toUpperCase()}
                </span>
                <span className="num text-[11px] text-mist-200">
                  {row.actualAwayScore}–{row.actualHomeScore}
                </span>
                <span className="num w-9 text-right text-[10px] text-mist-500">{pct(row.homeWinProbability, 0)}</span>
              </div>
            ))}
          </CardBody>
          <div className="border-t border-[var(--hairline)] px-5 py-2.5">
            <p className="text-[10px] leading-relaxed text-mist-500">{MODEL_NOTE}</p>
          </div>
        </Card>
      </section>

      <section aria-labelledby="slate">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <p className="label-xs mb-1">{longDateLabel(date)}</p>
            <h2 id="slate" className="text-lg font-semibold tracking-tight">
              {payload.games.length} game{payload.games.length === 1 ? "" : "s"} · {payload.predictions.length} projections
            </h2>
          </div>
          <Link href={`/predictions?date=${addDays(date, 1)}`} className="text-[11px] font-semibold text-mint-300 hover:text-mint-200">
            Next day →
          </Link>
        </div>

        {payload.games.length === 0 ? (
          <EmptyState
            title="No games on this date"
            description="The demo calendar has no games scheduled here. Try today or tomorrow."
            action={
              <Link href="/predictions" className="text-xs font-semibold text-mint-300">
                Back to today
              </Link>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {payload.predictions.map((prediction) => {
              const game = payload.games.find((g) => g.id === prediction.gameId);
              if (!game) return null;
              return <PredictionCard key={prediction.gameId} prediction={prediction} game={game} />;
            })}
          </div>
        )}
      </section>

      <Card className="border-amber-300/20 bg-amber-300/[0.04]">
        <CardBody className="pt-4 text-[11px] leading-relaxed text-amber-100/80">
          <strong className="font-semibold text-amber-100">Not betting advice.</strong> Projections are derived from
          synthetic data in this demo and intentionally avoid false precision: probabilities are rounded, confidence is
          bucketed, and the model is graded against a baseline on every completed game. Past accuracy does not guarantee
          future results.
        </CardBody>
      </Card>
    </div>
  );
}
