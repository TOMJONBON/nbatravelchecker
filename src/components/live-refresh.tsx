"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

function timeLabel(iso?: string): string | null {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone: "America/New_York",
    }).format(new Date(iso));
  } catch {
    return null;
  }
}

/**
 * Keeps server components fresh without a page reload.
 *
 * Every `intervalSeconds` it calls `router.refresh()`, which re-runs the server
 * data layer (15s cache) and streams a new RSC payload into the page. The
 * countdown pauses in hidden tabs and resets when the tab regains focus.
 */
export function LiveRefresher({
  mode,
  updatedAt,
  intervalSeconds = 20,
}: {
  mode: "live" | "mock";
  updatedAt?: string;
  intervalSeconds?: number;
}) {
  const router = useRouter();
  const [seconds, setSeconds] = useState(intervalSeconds);
  const [refreshing, setRefreshing] = useState(false);

  // Countdown only; no side effects inside the state updater.
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "hidden") return;
      setSeconds((current) => (current > 0 ? current - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // When the countdown reaches zero, refresh the server components.
  useEffect(() => {
    if (seconds > 0) return;
    if (document.visibilityState === "hidden") {
      setSeconds(intervalSeconds);
      return;
    }
    setRefreshing(true);
    router.refresh();
    setSeconds(intervalSeconds);
    const timeout = setTimeout(() => setRefreshing(false), 1200);
    return () => clearTimeout(timeout);
  }, [seconds, intervalSeconds, router]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      setRefreshing(true);
      router.refresh();
      setSeconds(intervalSeconds);
      setTimeout(() => setRefreshing(false), 1200);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [router, intervalSeconds]);

  const live = mode === "live";
  const stamp = timeLabel(updatedAt);

  return (
    <button
      type="button"
      onClick={() => {
        setRefreshing(true);
        router.refresh();
        setSeconds(intervalSeconds);
        setTimeout(() => setRefreshing(false), 1200);
      }}
      title={
        live
          ? `Live feed · auto-refreshing every ${intervalSeconds}s${stamp ? ` · data as of ${stamp} ET` : ""}`
          : `Synthetic fallback · auto-refreshing every ${intervalSeconds}s`
      }
      className={cn(
        "hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold sm:inline-flex",
        live
          ? "border-mint-400/30 bg-mint-400/10 text-mint-300"
          : "border-amber-300/30 bg-amber-300/10 text-amber-200",
      )}
    >
      <span className="relative flex size-1.5" aria-hidden>
        {live ? (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint-300 opacity-60" />
        ) : null}
        <span className={cn("relative inline-flex size-1.5 rounded-full", live ? "bg-mint-300" : "bg-amber-300")} />
      </span>
      {live ? "Live" : "Mock"}
      {stamp ? <span className="hidden text-mist-400 xl:inline">· {stamp} ET</span> : null}
      <span className="text-mist-500">· {refreshing ? "updating" : `${seconds}s`}</span>
      <RefreshCw className={cn("size-3", refreshing && "animate-spin")} aria-hidden />
    </button>
  );
}
