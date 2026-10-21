import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight, CircleDot } from "lucide-react";
import { Badge, Card } from "./ui";
import { cn, formatMiles, pct, signed } from "@/lib/utils";
import { relativeTime } from "@/lib/time";
import { TEAM_BY_ID } from "@/lib/teams";
import type {
  Alert,
  DataMeta,
  Game,
  Prediction,
  Team,
  TeamTravelMetrics,
  TravelStatus,
} from "@/lib/types";

const PROVENANCE: Record<
  DataMeta["provenance"],
  { label: string; dot: string; text: string; ring: string; title: string }
> = {
  live: {
    label: "Live",
    dot: "bg-emerald-400",
    text: "text-emerald-300",
    ring: "border-emerald-400/25 bg-emerald-400/8",
    title: "Fetched from a live provider moments ago.",
  },
  cached: {
    label: "Cached",
    dot: "bg-sky-400",
    text: "text-sky-300",
    ring: "border-sky-400/25 bg-sky-400/8",
    title: "Served from cache; may lag the provider.",
  },
  estimated: {
    label: "Estimated",
    dot: "bg-amber-300",
    text: "text-amber-200",
    ring: "border-amber-300/25 bg-amber-300/8",
    title: "Derived from schedules and coordinates — not measured.",
  },
  mock: {
    label: "Mock",
    dot: "bg-fuchsia-400",
    text: "text-fuchsia-300",
    ring: "border-fuchsia-400/25 bg-fuchsia-400/8",
    title: "Synthetic demo data. Not real NBA data.",
  },
};

export function ProvenanceBadge({
  meta,
  compact = false,
  className,
}: {
  meta: DataMeta;
  compact?: boolean;
  className?: string;
}) {
  const style = PROVENANCE[meta.provenance];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em]",
        style.ring,
        style.text,
        className,
      )}
      title={`${style.title} Source: ${meta.source}`}
    >
      <span className={cn("size-1.5 rounded-full", style.dot)} aria-hidden />
      {style.label}
      {!compact ? (
        <span className="font-medium normal-case tracking-normal text-mist-500" suppressHydrationWarning>
          · {relativeTime(meta.updatedAt)}
        </span>
      ) : null}
    </span>
  );
}

export function MetaLine({ meta, className }: { meta: DataMeta; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2 text-[11px] text-mist-500", className)}>
      <ProvenanceBadge meta={meta} />
      <span className="truncate" title={meta.source}>
        {meta.source}
      </span>
    </div>
  );
}

export function TeamMark({
  team,
  size = "md",
  className,
}: {
  team: Team;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}) {
  const sizes = {
    xs: "size-6 text-[9px]",
    sm: "size-8 text-[10px]",
    md: "size-10 text-[11px]",
    lg: "size-14 text-sm",
  } as const;
  return (
    <span
      className={cn(
        "inline-grid shrink-0 place-items-center rounded-xl font-extrabold tracking-tight text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.18)]",
        sizes[size],
        className,
      )}
      style={{
        background: `linear-gradient(145deg, ${team.colors.primary} 0%, ${team.colors.secondary} 130%)`,
      }}
      aria-label={team.name}
    >
      {team.abbreviation}
    </span>
  );
}

export function TeamLink({
  team,
  size = "sm",
  showCity = false,
  className,
}: {
  team: Team;
  size?: "xs" | "sm" | "md";
  showCity?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={`/teams/${team.id}`}
      className={cn("group inline-flex min-w-0 items-center gap-2.5", className)}
    >
      <TeamMark team={team} size={size} />
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-mist-100 group-hover:text-mint-300">
          {team.nickname}
        </span>
        {showCity ? <span className="block truncate text-[11px] text-mist-500">{team.city}</span> : null}
      </span>
    </Link>
  );
}

const BAND_COLOR: Record<TeamTravelMetrics["fatigueBand"], string> = {
  fresh: "#52e5b0",
  manageable: "#a3e635",
  elevated: "#ffcb6b",
  high: "#fb923c",
  severe: "#fb7185",
};

const BAND_LABEL: Record<TeamTravelMetrics["fatigueBand"], string> = {
  fresh: "Fresh",
  manageable: "Manageable",
  elevated: "Elevated",
  high: "High",
  severe: "Severe",
};

export function fatigueTone(band: TeamTravelMetrics["fatigueBand"]): string {
  return BAND_COLOR[band];
}

export function FatigueChip({
  band,
  value,
  className,
}: {
  band: TeamTravelMetrics["fatigueBand"];
  value: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "num inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
        className,
      )}
      style={{
        color: BAND_COLOR[band],
        borderColor: `${BAND_COLOR[band]}44`,
        backgroundColor: `${BAND_COLOR[band]}14`,
      }}
    >
      <span className="size-1.5 rounded-full" style={{ backgroundColor: BAND_COLOR[band] }} aria-hidden />
      {value} · {BAND_LABEL[band]}
    </span>
  );
}

export function FatigueGauge({
  value,
  band,
  size = 132,
  label,
}: {
  value: number;
  band: TeamTravelMetrics["fatigueBand"];
  size?: number;
  label?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const length = Math.PI * 50;
  const dash = (clamped / 100) * length;
  return (
    <div
      className="relative inline-flex flex-col items-center"
      style={{ width: size }}
      role="img"
      aria-label={`${label ?? "Travel fatigue"}: ${clamped} out of 100, ${BAND_LABEL[band]}`}
    >
      <svg viewBox="0 0 120 70" className="w-full">
        <path d="M 10 60 A 50 50 0 0 1 110 60" fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth="9" strokeLinecap="round" />
        <path
          d="M 10 60 A 50 50 0 0 1 110 60"
          fill="none"
          stroke={BAND_COLOR[band]}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${length}`}
          style={{ transition: "stroke-dasharray 600ms cubic-bezier(0.2,0.8,0.2,1)" }}
        />
      </svg>
      <div className="absolute inset-x-0 top-[34%] flex flex-col items-center">
        <span className="num text-xl font-semibold tracking-tight text-mist-50 sm:text-2xl">{clamped}</span>
        <span className="text-[9px] font-semibold uppercase tracking-[0.12em]" style={{ color: BAND_COLOR[band] }}>
          {BAND_LABEL[band]}
        </span>
      </div>
      {label ? <span className="mt-1 text-[11px] text-mist-500">{label}</span> : null}
    </div>
  );
}

export function ConfidenceChip({
  confidence,
  probability,
  className,
}: {
  confidence: Prediction["confidence"];
  probability: number;
  className?: string;
}) {
  const tone = confidence === "high" ? "mint" : confidence === "medium" ? "amber" : "neutral";
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <Badge tone={tone}>{confidence} confidence</Badge>
      <span className="num text-[11px] text-mist-500">{pct(probability, 0)} win prob.</span>
    </span>
  );
}

export function LiveDot({ className }: { className?: string }) {
  return (
    <span className={cn("relative inline-flex size-2", className)} aria-hidden>
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-70" />
      <span className="relative inline-flex size-2 rounded-full bg-rose-400" />
    </span>
  );
}

export function StatusChip({ game }: { game: Game }) {
  if (game.status === "live") {
    return (
      <Badge tone="danger" className="gap-1.5">
        <LiveDot /> Live · {game.period} {game.clock}
      </Badge>
    );
  }
  if (game.status === "final") return <Badge tone="outline">Final</Badge>;
  if (game.status === "postponed") return <Badge tone="amber">Postponed</Badge>;
  return <Badge tone="neutral">{game.date}</Badge>;
}

export function ScoreLine({ game, size = "md" }: { game: Game; size?: "sm" | "md" | "lg" }) {
  const home = TEAM_BY_ID[game.homeTeamId];
  const away = TEAM_BY_ID[game.awayTeamId];
  const showScore = game.status === "live" || game.status === "final";
  const text = size === "lg" ? "text-3xl" : size === "sm" ? "text-lg" : "text-2xl";

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <TeamMark team={away} size={size === "lg" ? "md" : "sm"} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-mist-100">{away.abbreviation}</p>
          <p className="truncate text-[10px] text-mist-500">away</p>
        </div>
      </div>
      <div className={cn("num text-center font-semibold tracking-tight", text)}>
        {showScore ? (
          <span>
            <span className={cn(game.awayScore !== null && game.homeScore !== null && game.awayScore > game.homeScore && "text-mint-300")}>
              {game.awayScore}
            </span>
            <span className="mx-1.5 text-mist-600">–</span>
            <span className={cn(game.homeScore !== null && game.awayScore !== null && game.homeScore > game.awayScore && "text-mint-300")}>
              {game.homeScore}
            </span>
          </span>
        ) : (
          <span className="text-sm text-mist-400">{game.status === "postponed" ? "PPD" : "vs"}</span>
        )}
      </div>
      <div className="flex min-w-0 items-center justify-end gap-2 text-right">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-mist-100">{home.abbreviation}</p>
          <p className="truncate text-[10px] text-mist-500">home</p>
        </div>
        <TeamMark team={home} size={size === "lg" ? "md" : "sm"} />
      </div>
    </div>
  );
}

export function FactorBars({ prediction, limit = 5 }: { prediction: Prediction; limit?: number }) {
  const factors = prediction.factors.slice(0, limit);
  const max = Math.max(...factors.map((f) => Math.abs(f.impact)), 1);
  return (
    <ul className="space-y-2">
      {factors.map((factor) => {
        const width = Math.max(3, (Math.abs(factor.impact) / max) * 50);
        const positive = factor.impact > 0;
        return (
          <li key={factor.key} className="grid grid-cols-[104px_1fr_48px] items-center gap-2 text-[11px]">
            <span className="truncate text-mist-400" title={factor.detail}>
              {factor.label}
            </span>
            <span className="relative h-1.5 rounded-full bg-white/[0.05]">
              <span
                className="absolute top-0 h-full rounded-full"
                style={{
                  width: `${width}%`,
                  left: positive ? "50%" : undefined,
                  right: positive ? undefined : "50%",
                  background: positive ? "#52e5b0" : "#7d92ff",
                }}
              />
              <span className="absolute left-1/2 top-[-2px] h-2.5 w-px bg-white/20" />
            </span>
            <span className={cn("num text-right font-semibold", positive ? "text-mint-300" : "text-iris-300")}>
              {signed(factor.impact)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function PredictionCard({
  prediction,
  game,
  compact = false,
}: {
  prediction: Prediction;
  game: Game;
  compact?: boolean;
}) {
  const home = TEAM_BY_ID[prediction.homeTeamId];
  const away = TEAM_BY_ID[prediction.awayTeamId];
  const homePct = Math.round(prediction.homeWinProbability * 100);
  const favourite = prediction.predictedWinnerId === home.id ? home : away;

  return (
    <Card className="card-hover overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 pt-3.5 pb-2">
        <div className="flex items-center gap-2 text-[11px] text-mist-500">
          <CircleDot className="size-3 text-mist-600" aria-hidden />
          <span className="truncate">{game.neutralSite?.city ?? home.city}</span>
          <span aria-hidden>·</span>
          <span>{game.venueType === "team" ? "Home" : "Neutral"}</span>
        </div>
        <ConfidenceChip confidence={prediction.confidence} probability={prediction.homeWinProbability} />
      </div>

      <div className="px-4">
        <div className="space-y-2">
          {[away, home].map((team) => {
            const isHome = team.id === home.id;
            const score = isHome ? prediction.projectedHomeScore : prediction.projectedAwayScore;
            const isFavourite = team.id === prediction.predictedWinnerId;
            return (
              <div key={team.id} className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <TeamMark team={team} size="sm" />
                  <div className="min-w-0">
                    <p className={cn("truncate text-sm font-semibold", isFavourite ? "text-mist-50" : "text-mist-300")}>
                      {team.nickname}
                    </p>
                    <p className="text-[10px] uppercase tracking-wider text-mist-500">
                      {isHome ? "home" : "away"}
                      {isFavourite ? " · model pick" : ""}
                    </p>
                  </div>
                </div>
                <span className="num text-lg font-semibold text-mist-100">{score}</span>
              </div>
            );
          })}
        </div>

        <div className="mt-3">
          <div className="flex items-center justify-between text-[10px] text-mist-500">
            <span>{away.abbreviation} {100 - homePct}%</span>
            <span>{home.abbreviation} {homePct}%</span>
          </div>
          <div className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
            <span style={{ width: `${100 - homePct}%`, background: away.colors.primary }} />
            <span style={{ width: `${homePct}%`, background: home.colors.primary }} />
          </div>
          <p className="mt-1.5 text-[11px] text-mist-400">
            Projected margin {signed(prediction.projectedMargin)} · {favourite.abbreviation} favoured
          </p>
        </div>
      </div>

      {!compact ? (
        <div className="mt-3 border-t border-[var(--hairline)] px-4 py-3">
          <p className="label-xs mb-2">Why this prediction</p>
          <FactorBars prediction={prediction} limit={3} />
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-2 border-t border-[var(--hairline)] px-4 py-2.5">
        <ProvenanceBadge meta={prediction.meta} />
        <Link
          href={`/games/${game.id}`}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-mint-300 hover:text-mint-200"
        >
          Game detail
          <ArrowUpRight className="size-3" aria-hidden />
        </Link>
      </div>
    </Card>
  );
}

const STATUS_TONE: Record<TravelStatus, "mint" | "amber" | "iris" | "neutral" | "danger"> = {
  home: "mint",
  traveling: "iris",
  road_trip: "amber",
  back_to_back: "danger",
  rest_day: "neutral",
};

export function TravelStatusChip({ metrics }: { metrics: TeamTravelMetrics }) {
  return (
    <Badge tone={STATUS_TONE[metrics.status]} title={metrics.statusDetail}>
      {metrics.statusLabel}
    </Badge>
  );
}

export function AlertItem({ alert, team }: { alert: Alert; team?: Team }) {
  const tone =
    alert.severity === "high" ? "danger" : alert.severity === "watch" ? "amber" : "neutral";
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[var(--hairline)] bg-white/[0.02] p-3">
      {team ? <TeamMark team={team} size="sm" /> : null}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Badge tone={tone}>{alert.kind.replace("_", " ")}</Badge>
          <span className="text-[10px] text-mist-500">{alert.date}</span>
        </div>
        <p className="mt-1 text-sm font-medium text-mist-100">{alert.title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-mist-400">{alert.body}</p>
      </div>
      <ProvenanceBadge meta={alert.meta} compact />
    </div>
  );
}

export function MilesPill({ miles }: { miles: number }) {
  return (
    <span className="num inline-flex items-center gap-1 rounded-md border border-[var(--hairline)] bg-white/[0.03] px-1.5 py-0.5 text-[10px] font-medium text-mist-300">
      {formatMiles(miles)}
    </span>
  );
}

export function KeyValue({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="text-xs text-mist-500">{label}</span>
      <span className="num text-xs font-semibold text-mist-200">{value}</span>
    </div>
  );
}
