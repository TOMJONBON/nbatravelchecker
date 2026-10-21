import { getMapData } from "@/lib/data";
import { todayISO } from "@/lib/time";
import { TEAM_BY_ID } from "@/lib/teams";
import { TravelMap } from "@/components/map/travel-map";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Travel map",
  description: "Interactive map of estimated NBA team travel with filters, timeline and trip details.",
};

export default async function MapPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; team?: string }>;
}) {
  const sp = await searchParams;
  const today = todayISO();
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;
  const team = sp.team && TEAM_BY_ID[sp.team] ? sp.team : null;
  const payload = await getMapData(date, team ?? undefined);

  return (
    <TravelMap initialPayload={payload} initialDate={date} initialTeam={team} serverToday={today} />
  );
}
