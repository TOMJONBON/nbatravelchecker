import { getTeamTravel } from "@/lib/data";
import { guard, json, notFound } from "@/lib/api";
import { TEAM_BY_ID } from "@/lib/teams";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const blocked = guard(request);
  if (blocked) return blocked;
  const { id } = await params;
  if (!TEAM_BY_ID[id]) return notFound(`Unknown team: ${id}`);
  const travel = await getTeamTravel(id);
  if (!travel || !travel.metrics) return notFound(`Unknown team: ${id}`);

  return json({
    data: {
      teamId: id,
      metrics: travel.metrics,
      trips: travel.trips,
      legs: travel.legs,
      note: "All legs are estimated from schedule city changes; no live flight data is used.",
    },
    meta: travel.meta,
  });
}
