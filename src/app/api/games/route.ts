import { getDataset } from "@/lib/data";
import { badRequest, guard, json } from "@/lib/api";
import { todayISO } from "@/lib/time";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const blocked = guard(request);
  if (blocked) return blocked;

  const url = new URL(request.url);
  const date = url.searchParams.get("date") ?? todayISO();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return badRequest("date must be YYYY-MM-DD");

  const ds = await getDataset();
  const games = ds.games.filter((g) => (date === "all" ? true : g.date === date));
  return json({
    data: games.map((game) => ({
      ...game,
      prediction: ds.predictions[game.id] ?? null,
      homeTeam: ds.metrics[game.homeTeamId] ? { id: game.homeTeamId } : null,
    })),
    meta: ds.meta,
  });
}
