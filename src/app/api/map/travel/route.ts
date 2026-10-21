import { getMapData } from "@/lib/data";
import { badRequest, guard, json } from "@/lib/api";
import { todayISO } from "@/lib/time";
import { TEAM_BY_ID } from "@/lib/teams";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const blocked = guard(request);
  if (blocked) return blocked;

  const url = new URL(request.url);
  const date = url.searchParams.get("date") ?? todayISO();
  const team = url.searchParams.get("team") ?? undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return badRequest("date must be YYYY-MM-DD");
  if (team && !TEAM_BY_ID[team]) return badRequest(`Unknown team: ${team}`);

  const payload = await getMapData(date, team);
  return json({ data: payload, meta: payload.meta }, { cacheSeconds: 15 });
}
