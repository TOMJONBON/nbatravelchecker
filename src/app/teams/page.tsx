import Link from "next/link";
import { getDataset } from "@/lib/data";
import { TEAMS } from "@/lib/teams";
import { PageHeader } from "@/components/ui";
import { MetaLine } from "@/components/domain";
import { TeamGrid, type TeamGridItem } from "@/components/team-grid";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Teams",
  description: "All 30 NBA teams with fatigue, road records and upcoming travel.",
};

export default async function TeamsPage() {
  const ds = await getDataset();
  const items: TeamGridItem[] = TEAMS.map((team) => {
    const metrics = ds.metrics[team.id];
    const nextGame = metrics.nextGame;
    const opponentId = nextGame
      ? nextGame.homeTeamId === team.id
        ? nextGame.awayTeamId
        : nextGame.homeTeamId
      : null;
    const prediction = nextGame ? ds.predictions[nextGame.id] : null;
    return {
      teamId: team.id,
      metrics,
      nextGame,
      opponentId,
      predictionProbability: prediction ? prediction.homeWinProbability : null,
    };
  });

  const meta = ds.meta;

  return (
    <div>
      <PageHeader
        eyebrow="League directory"
        title="All 30 teams"
        description="Fatigue is a 0–100 travel index. Road records use only games played away from home in the current season."
      >
        <MetaLine meta={meta} />
      </PageHeader>

      <div className="mb-6 flex flex-wrap gap-2 text-[11px] text-mist-500">
        <span className="rounded-full border border-[var(--hairline)] px-2.5 py-1">
          {TEAMS.length} teams
        </span>
        <span className="rounded-full border border-[var(--hairline)] px-2.5 py-1">
          {Object.values(ds.metrics).reduce((s, m) => s + m.miles7, 0).toLocaleString()} mi flown league-wide (7d)
        </span>
        <span className="rounded-full border border-[var(--hairline)] px-2.5 py-1">
          {Object.values(ds.metrics).filter((m) => m.fatigueIndex >= 60).length} teams above 60 fatigue
        </span>
        <Link href="/compare" className="rounded-full border border-mint-400/30 px-2.5 py-1 text-mint-300 hover:bg-mint-400/10">
          Compare two teams →
        </Link>
      </div>

      <TeamGrid items={items} />
    </div>
  );
}
