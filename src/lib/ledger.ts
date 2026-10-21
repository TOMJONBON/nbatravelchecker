/**
 * Prediction ledger.
 *
 * Records the first pre-game projection for each upcoming game, then grades it
 * once the game is final. This is what turns "backtested on last season" into
 * "graded since deployment".
 *
 * Storage is a JSONL file (no database in this build). On read-only hosts the
 * write fails and the ledger degrades to in-memory for that process only — the
 * report says which mode is active.
 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { clamp } from "./rand";
import type { Game } from "./types";

export interface LedgerEntry {
  gameId: string;
  date: string;
  capturedAt: string;
  homeWinProbability: number;
  predictedWinnerId: string;
  projectedMargin: number;
  modelVersion: string;
}

export interface LedgerReport {
  entries: number;
  graded: number;
  accuracy: number | null;
  brier: number | null;
  logLoss: number | null;
  firstCapturedAt: string | null;
  lastGradedAt: string | null;
  storage: "file" | "memory";
  note: string;
}

const LEDGER_PATH =
  process.env.PREDICTION_LEDGER_PATH ??
  path.join(process.env.VERCEL ? os.tmpdir() : process.cwd(), ".data", "predictions.jsonl");

let loaded = false;
let storage: "file" | "memory" = "file";
const entries: LedgerEntry[] = [];
const keys = new Set<string>();

function keyOf(entry: Pick<LedgerEntry, "gameId" | "modelVersion">): string {
  return `${entry.gameId}|${entry.modelVersion}`;
}

async function load(): Promise<void> {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await fs.readFile(LEDGER_PATH, "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const entry = JSON.parse(trimmed) as LedgerEntry;
        if (!entry.gameId || typeof entry.homeWinProbability !== "number") continue;
        const key = keyOf(entry);
        if (keys.has(key)) continue;
        keys.add(key);
        entries.push(entry);
      } catch {
        // Ignore a corrupt line rather than losing the whole ledger.
      }
    }
  } catch {
    // No file yet — fine.
  }
}

/** Persist new pre-game projections. Duplicate game/model pairs are ignored. */
export async function recordPredictions(incoming: LedgerEntry[]): Promise<void> {
  await load();
  const fresh = incoming.filter((entry) => !keys.has(keyOf(entry)));
  if (fresh.length === 0) return;

  for (const entry of fresh) {
    keys.add(keyOf(entry));
    entries.push(entry);
  }

  try {
    await fs.mkdir(path.dirname(LEDGER_PATH), { recursive: true });
    await fs.appendFile(LEDGER_PATH, fresh.map((entry) => JSON.stringify(entry)).join("\n") + "\n", "utf8");
    storage = "file";
  } catch (error) {
    storage = "memory";
    console.warn("[ledger] cannot persist predictions:", error instanceof Error ? error.message : error);
  }
}

export async function readLedger(): Promise<LedgerEntry[]> {
  await load();
  return entries;
}

function logLoss(probability: number, outcome: number): number {
  const p = clamp(probability, 1e-6, 1 - 1e-6);
  return -(outcome * Math.log(p) + (1 - outcome) * Math.log(1 - p));
}

/** Pure grading function, exported for tests. */
export function gradeEntries(entriesToGrade: LedgerEntry[], games: Game[]): Omit<LedgerReport, "storage" | "entries" | "note"> {
  const finals = new Map(
    games
      .filter((game) => game.status === "final" && game.homeScore !== null && game.awayScore !== null)
      .map((game) => [game.id, game]),
  );

  let graded = 0;
  let correct = 0;
  let brierSum = 0;
  let lossSum = 0;
  let firstCapturedAt: string | null = null;
  let lastGradedAt: string | null = null;

  for (const entry of entriesToGrade) {
    if (!firstCapturedAt || entry.capturedAt < firstCapturedAt) firstCapturedAt = entry.capturedAt;
    const game = finals.get(entry.gameId);
    if (!game) continue;
    const homeWon = (game.homeScore ?? 0) > (game.awayScore ?? 0);
    const winner = homeWon ? game.homeTeamId : game.awayTeamId;
    const outcome = homeWon ? 1 : 0;
    graded += 1;
    if (entry.predictedWinnerId === winner) correct += 1;
    brierSum += (entry.homeWinProbability - outcome) ** 2;
    lossSum += logLoss(entry.homeWinProbability, outcome);
    if (!lastGradedAt || game.date > lastGradedAt) lastGradedAt = game.date;
  }

  return {
    graded,
    accuracy: graded > 0 ? correct / graded : null,
    brier: graded > 0 ? brierSum / graded : null,
    logLoss: graded > 0 ? lossSum / graded : null,
    firstCapturedAt,
    lastGradedAt,
  };
}

export async function ledgerReport(games: Game[]): Promise<LedgerReport> {
  const all = await readLedger();
  const graded = gradeEntries(all, games);
  return {
    ...graded,
    entries: all.length,
    storage,
    note:
      storage === "file"
        ? "First pre-game projection per game, persisted to disk and graded after the final buzzer."
        : "Read-only filesystem: the ledger is in memory for this process only.",
  };
}
