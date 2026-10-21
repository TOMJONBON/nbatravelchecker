"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type WatchKind = "team" | "player";

export interface WatchEntry {
  kind: WatchKind;
  id: string;
  addedAt: string;
  /** Display metadata captured at add time (needed for live rosters). */
  name?: string;
  teamId?: string;
}

interface WatchState {
  items: WatchEntry[];
  toggle: (kind: WatchKind, id: string, meta?: { name?: string; teamId?: string }) => void;
  remove: (kind: WatchKind, id: string) => void;
  clear: () => void;
}

/**
 * Watchlist persistence is local-only (localStorage). No account, no server
 * storage, no tracking — see the privacy note on /methodology.
 */
export const useWatchlist = create<WatchState>()(
  persist(
    (set) => ({
      items: [],
      toggle: (kind, id, meta) =>
        set((state) => {
          const exists = state.items.some((item) => item.kind === kind && item.id === id);
          if (exists) {
            return { items: state.items.filter((item) => !(item.kind === kind && item.id === id)) };
          }
          return {
            items: [...state.items, { kind, id, addedAt: new Date().toISOString(), name: meta?.name, teamId: meta?.teamId }],
          };
        }),
      remove: (kind, id) =>
        set((state) => ({ items: state.items.filter((item) => !(item.kind === kind && item.id === id)) })),
      clear: () => set({ items: [] }),
    }),
    { name: "nbatt-watchlist-v1" },
  ),
);

export function useWatched(kind: WatchKind, id: string): boolean {
  return useWatchlist((state) => state.items.some((item) => item.kind === kind && item.id === id));
}
