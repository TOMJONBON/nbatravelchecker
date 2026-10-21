import Link from "next/link";
import { ArrowRight, Mountain, Plane, Timer, CalendarClock } from "lucide-react";
import { Badge, Card } from "./ui";
import { TeamMark } from "./domain";
import { cn, formatMiles, signed } from "@/lib/utils";
import { monthDayLabel, weekdayLabel } from "@/lib/time";
import type { Prediction, RoadTrip, Team, TeamTravelMetrics } from "@/lib/types";
import { TEAM_BY_ID } from "@/lib/teams";

const STATUS_TONE = {
  active: "mint",
  upcoming: "iris",
  completed: "neutral",
} as const;

export function RoadTripCard({  trip,
  team,
  metrics,
  prediction,
  className,
}: {
  trip: RoadTrip;
  team: Team;
  metrics: TeamTravelMetrics;
  prediction?: Prediction | null;
  className?: string;
}) {
  return (
    <Card className={cn("card-hover flex flex-col overflow-hidden", className)}>
      <div className="flex items-start justify-between gap-3 px-4 pt-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <TeamMark team={team} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-mist-100">{team.nickname}</p>
            <p className="text-[10px] uppercase tracking-[0.12em] text-mist-500">
              {trip.singleGame ? "Single-game trip" : `${trip.gameIds.length}-game road trip`}
            </p>
          </div>
        </div>
        <Badge tone={STATUS_TONE[trip.status]}>{trip.status}</Badge>
      </div>

      <div className="mt-3 flex-1 px-4">
        <ol className="relative space-y-2.5 border-l border-dashed border-[var(--hairline-strong)] pl-3.5">
          {trip.stops.map((stop, index) => (
            <li key={stop.gameId} className="relative">
              <span
                className={cn(
                  "absolute -left-[17px] top-1.5 size-2 rounded-full border",
                  index === 0 ? "border-mint-300 bg-mint-300" : "border-[var(--hairline-strong)] bg-ink-850",
                )}
                aria-hidden
              />
              <div className="flex items-baseline justify-between gap-2">
                <p className="truncate text-[13px] font-medium text-mist-200">
                  {stop.city}
                  {stop.altitude ? <Mountain className="ml-1 inline size-3 text-amber-300" aria-label="Altitude game" /> : null}
                </p>
                <span className="num shrink-0 text-[10px] text-mist-500">
                  {weekdayLabel(stop.date)} {monthDayLabel(stop.date)}
                </span>
              </div>
              {stop.backToBack ? (
                <p className="text-[10px] font-semibold uppercase tracking-wider text-rose-300/80">back-to-back</p>
              ) : null}
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2 border-t border-[var(--hairline)] px-4 py-3">
        <Metric icon={<Plane className="size-3" />} label="Miles" value={trip.totalMiles.toLocaleString()} />
        <Metric icon={<Timer className="size-3" />} label="Zones" value={String(trip.timeZonesCrossed)} />
        <Metric icon={<CalendarClock className="size-3" />} label="B2Bs" value={String(trip.backToBacks)} />
        <Metric icon={<Mountain className="size-3" />} label="Altitude" value={String(trip.altitudeGames)} />
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-[var(--hairline)] px-4 py-2.5">
        <p className="num text-[11px] text-mist-400">
          Road {metrics.roadRecord.wins}-{metrics.roadRecord.losses}
          {trip.status !== "completed" ? (
            <span className="text-mist-500"> · {formatMiles(trip.totalMiles)}</span>
          ) : null}
        </p>
        {prediction ? (
          <Link
            href={`/games/${prediction.gameId}`}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-mint-300 hover:text-mint-200"
          >
            {TEAM_BY_ID[prediction.predictedWinnerId]?.abbreviation ?? ""} {signed(prediction.projectedMargin)}
            <ArrowRight className="size-3" aria-hidden />
          </Link>
        ) : (
          <Link href={`/teams/${team.id}`} className="text-[11px] font-semibold text-mist-400 hover:text-mist-200">
            Team page
          </Link>
        )}
      </div>
    </Card>
  );
}

/** Dates for each stop come from the trip itself (mock schedules). */

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div>
      <p className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-mist-500">
        {icon}
        {label}
      </p>
      <p className="num mt-0.5 text-sm font-semibold text-mist-100">{value}</p>
    </div>
  );
}
