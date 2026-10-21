import { getPredictionsForDate } from "@/lib/data";
import { badRequest, guard, json } from "@/lib/api";
import { todayISO } from "@/lib/time";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const blocked = guard(request);
  if (blocked) return blocked;

  const url = new URL(request.url);
  const date = url.searchParams.get("date") ?? todayISO();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return badRequest("date must be YYYY-MM-DD");

  const payload = await getPredictionsForDate(date);
  return json(
    {
      data: payload.predictions.map((p) => ({
        ...p,
        game: payload.games.find((g) => g.id === p.gameId) ?? null,
      })),
      report: {
        modelVersion: payload.report.modelVersion,
        games: payload.report.games,
        accuracy: payload.report.accuracy,
        baselineAccuracy: payload.report.baselineAccuracy,
        brier: payload.report.brier,
        baselineBrier: payload.report.baselineBrier,
      },
      meta: payload.meta,
    },
    { cacheSeconds: 30 },
  );
}
