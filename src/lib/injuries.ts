import { rngFor, clamp } from "./rand";
import type { Game, InjuryStatus, Player } from "./types";

const REASONS = [
  "Ankle sprain",
  "Left knee soreness",
  "Illness",
  "Right hamstring tightness",
  "Lower back spasms",
  "Foot contusion",
  "Concussion protocol",
  "Load management",
  "Calf strain",
  "Wrist sprain",
];

/**
 * Deterministic injury report per team/game.
 *
 * Mock data: the same game always produces the same report so predictions,
 * backtests and UI stay consistent. Real deployments replace this with a
 * balldontlie / SportsDataIO injuries feed (see /status).
 */
export function injuriesForGame(game: Game, teamId: string, players: Player[]): InjuryStatus[] {
  const rng = rngFor(`injuries:${game.id}:${teamId}`);
  const roster = players.filter((p) => p.teamId === teamId);
  if (roster.length === 0) return [];
  const updates: InjuryStatus[] = [];

  for (const player of roster) {
    const roll = rng();
    const outChance = player.starter ? 0.055 : 0.035;
    if (roll < outChance) {
      updates.push({
        playerId: player.id,
        teamId,
        gameId: game.id,
        status: "out",
        reason: REASONS[Math.floor(rng() * REASONS.length)],
        updatedAt: new Date().toISOString(),
        provenance: "mock",
      });
    } else if (roll < outChance + 0.03) {
      updates.push({
        playerId: player.id,
        teamId,
        gameId: game.id,
        status: "questionable",
        reason: REASONS[Math.floor(rng() * REASONS.length)],
        updatedAt: new Date().toISOString(),
        provenance: "mock",
      });
    }
  }
  return updates;
}

/** Points-per-game value of a player, used to translate absences into a spread. */
export function playerValue(player: Player): number {
  const minutesShare = clamp(player.minutesPerGame / 36, 0, 1.2);
  return (player.pointsPer36 * minutesShare) / 3 + player.bpm * 0.55;
}

/** Net points lost by a team for a given game (positive = weakened). */
export function injuryImpact(
  game: Game,
  teamId: string,
  players: Player[],
): { points: number; out: InjuryStatus[]; questionable: InjuryStatus[] } {
  const report = injuriesForGame(game, teamId, players);
  const byId = new Map(players.map((p) => [p.id, p]));
  let points = 0;
  const out: InjuryStatus[] = [];
  const questionable: InjuryStatus[] = [];

  for (const item of report) {
    const player = byId.get(item.playerId);
    if (!player) continue;
    const value = playerValue(player);
    if (item.status === "out") {
      points += value;
      out.push(item);
    } else if (item.status === "questionable") {
      points += value * 0.45;
      questionable.push(item);
    }
  }

  return { points: Math.round(points * 10) / 10, out, questionable };
}
