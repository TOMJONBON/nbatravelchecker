import Link from "next/link";

const LINKS = [
  { href: "/teams", label: "Teams" },
  { href: "/predictions", label: "Predictions" },
  { href: "/compare", label: "Compare" },
  { href: "/watchlist", label: "Watchlist" },
  { href: "/methodology", label: "Methodology" },
  { href: "/status", label: "Data status" },
];

export function SiteFooter({ mode = "mock" }: { mode?: "live" | "mock" }) {
  return (
    <footer className="mt-16 border-t border-[var(--hairline)] pb-24 pt-10 lg:pb-10">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6">
        <div className="flex flex-col gap-8 md:flex-row md:justify-between">
          <div className="max-w-md">
            <div className="flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-mint-400 to-iris-400 text-[10px] font-black text-ink-950">
                NT
              </span>
              <span className="text-xs font-bold tracking-[0.16em] text-mist-200">NBA TRAVEL TRACKER</span>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-mist-500">
              {mode === "live"
                ? "Live schedules, scores and injuries come from ESPN's public NBA endpoints. Team travel is reconstructed from schedules — not tracked. Projections are informational only and are not betting advice."
                : "Synthetic fallback mode: live data is unavailable, so scores, injuries and rosters are generated. Team travel is reconstructed from schedules — not tracked."}
            </p>
            <p className="mt-2 text-[11px] leading-relaxed text-mist-600">
              Not affiliated with, endorsed by, or licensed by the NBA or its teams. No team logos or player likenesses
              are used.
            </p>
          </div>

          <nav aria-label="Footer" className="grid grid-cols-2 gap-x-10 gap-y-2 text-xs sm:grid-cols-2">
            {LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="text-mist-400 transition-colors hover:text-mint-300">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="mt-8 flex flex-col gap-2 border-t border-[var(--hairline)] pt-4 text-[10px] text-mist-600 sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} NBA Travel Tracker — demo build.</span>
          <span>
            Data provenance is labelled on every widget: Live · Cached · Estimated · Mock.{" "}
            <Link href="/status" className="underline decoration-dotted hover:text-mist-300">
              Source status
            </Link>
          </span>
        </div>
      </div>
    </footer>
  );
}
