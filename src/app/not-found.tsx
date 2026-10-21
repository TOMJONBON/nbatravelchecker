import Link from "next/link";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="grid size-14 place-items-center rounded-2xl border border-[var(--hairline)] bg-white/[0.03] text-mist-400">
        <Compass className="size-7" aria-hidden />
      </div>
      <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-mist-500">404 · off the map</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-mist-50">This route doesn&apos;t exist</h1>
      <p className="mt-2 max-w-sm text-sm text-mist-400">
        The team, player or game you were looking for may have left the demo dataset.
      </p>
      <div className="mt-5 flex gap-2">
        <Link href="/" className="rounded-xl bg-mint-400 px-4 py-2 text-xs font-bold text-ink-950">
          Back to dashboard
        </Link>
        <Link
          href="/teams"
          className="rounded-xl border border-[var(--hairline)] px-4 py-2 text-xs font-semibold text-mist-200"
        >
          Browse teams
        </Link>
      </div>
    </div>
  );
}
