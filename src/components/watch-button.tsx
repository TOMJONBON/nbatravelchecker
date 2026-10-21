"use client";

import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWatched, useWatchlist, type WatchKind } from "@/store/watchlist";

export function WatchButton({
  kind,
  id,
  label,
  name,
  teamId,
  className,
}: {
  kind: WatchKind;
  id: string;
  label?: string;
  name?: string;
  teamId?: string;
  className?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const watched = useWatched(kind, id);
  const toggle = useWatchlist((state) => state.toggle);

  useEffect(() => setMounted(true), []);

  const active = mounted && watched;

  return (
    <button
      type="button"
      onClick={() => toggle(kind, id, { name, teamId })}
      aria-pressed={active}
      aria-label={active ? `Remove ${label ?? id} from watchlist` : `Add ${label ?? id} to watchlist`}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-semibold transition-colors",
        active
          ? "border-amber-300/40 bg-amber-300/10 text-amber-200"
          : "border-[var(--hairline)] bg-white/[0.03] text-mist-300 hover:text-mist-100",
        className,
      )}
    >
      <Star className={cn("size-3.5", active && "fill-current")} aria-hidden />
      {label ? (active ? "Watching" : "Watch") : null}
    </button>
  );
}
