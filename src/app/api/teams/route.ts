import { getDataset } from "@/lib/data";
import { guard, json } from "@/lib/api";
import { TEAMS } from "@/lib/teams";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const blocked = guard(request);
  if (blocked) return blocked;

  const ds = await getDataset();
  const data = TEAMS.map((team) => ({
    ...team,
    metrics: ds.metrics[team.id],
    nextGame: ds.metrics[team.id].nextGame,
    prediction: ds.metrics[team.id].nextGame
      ? ds.predictions[ds.metrics[team.id].nextGame!.id] ?? null
      : null,
  }));

  return json({
    data,
    meta: {
      ...ds.meta,
      note: "Team metadata is static (arena, airport, coordinates). Travel, records and projections are computed from the current data source.",
    },
  });
}
