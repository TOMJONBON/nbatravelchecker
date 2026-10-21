import { getPlayerDetail } from "@/lib/data";
import { badRequest, guard, json, notFound } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const blocked = guard(request);
  if (blocked) return blocked;

  const { id } = await params;
  const url = new URL(request.url);
  const season = url.searchParams.get("season") ?? "all";
  if (!["all", "current", "previous", "2026-27", "2025-26"].includes(season)) {
    return badRequest("season must be one of all | current | previous | 2026-27 | 2025-26");
  }

  const detail = await getPlayerDetail(id, season);
  if (!detail) return notFound(`Unknown player: ${id}`);

  return json({
    data: {
      player: detail.player,
      impact: detail.impact,
      recentLogs: detail.recentLogs,
      seasonId: detail.seasonId,
    },
    meta: detail.meta,
  });
}
