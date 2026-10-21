"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Route error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="grid size-14 place-items-center rounded-2xl border border-rose-400/30 bg-rose-400/10 text-rose-300">
        <AlertTriangle className="size-7" aria-hidden />
      </div>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight text-mist-50">Something broke on the road</h1>
      <p className="mt-2 max-w-md text-sm text-mist-400">
        The dataset or a provider call failed. You can retry — if the mock engine is at fault, the dashboard will still
        render with the previous payload.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-5 rounded-xl bg-mint-400 px-4 py-2 text-xs font-bold text-ink-950"
      >
        Try again
      </button>
      {error.digest ? <p className="mt-3 font-mono text-[10px] text-mist-600">digest {error.digest}</p> : null}
    </div>
  );
}
