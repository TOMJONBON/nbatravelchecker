import { getDataset } from "@/lib/data";
import { PLAYERS } from "@/lib/players";
import { TEAMS } from "@/lib/teams";
import { PageHeader } from "@/components/ui";
import { MetaLine } from "@/components/domain";
import { WatchlistView, type WatchPlayer, type WatchTeam } from "@/components/watchlist-view";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Watchlist",
  description: "Favourite teams and players with in-app travel alerts.",
};

export default async function WatchlistPage() {
  const ds = await getDataset();

  const teams: WatchTeam[] = TEAMS.map((team) => {
    const metrics = ds.metrics[team.id];
    const nextGame = metrics.nextGame;
    return {
      teamId: team.id,
      metrics,
      nextGame,
      opponentId: nextGame
        ? nextGame.homeTeamId === team.id
          ? nextGame.awayTeamId
          : nextGame.homeTeamId
        : null,
    };
  });

  const players: WatchPlayer[] =
    ds.mode === "mock"
      ? PLAYERS.map((player) => ({
          id: player.id,
          name: player.name,
          teamId: player.teamId,
          position: player.position,
          minutesPerGame: player.minutesPerGame,
          statsKnown: true,
        }))
      : [];

  return (
    <div>
      <PageHeader
        eyebrow="Personalise"
        title="Watchlist & alerts"
        description="Track the teams and players you care about. Alerts are computed from schedule and fatigue signals, and stay in this browser."
      >
        <MetaLine meta={ds.meta} />
      </PageHeader>

      <WatchlistView teams={teams} players={players} alerts={ds.alerts} />
    </div>
  );
}
