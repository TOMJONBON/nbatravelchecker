import { getStatus } from "@/lib/data";
import { guard, json } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const blocked = guard(request);
  if (blocked) return blocked;

  const status = await getStatus();
  return json(
    {
      data: status,
      ok: status.mode === "live",
    },
    { cacheSeconds: 15 },
  );
}
