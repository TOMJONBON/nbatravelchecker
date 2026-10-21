import Link from "next/link";
import { getDataset } from "@/lib/data";
import { FATIGUE_CAPS, FATIGUE_WEIGHTS } from "@/lib/fatigue";
import { MODEL_VERSION, MARGIN_SIGMA, HOME_COURT_POINTS } from "@/lib/predictions";
import { MIN_MODEL_N, MIN_SPLIT_SAMPLE } from "@/lib/player-impact";
import { PageHeader, Card, CardBody, Badge } from "@/components/ui";
import { MetaLine } from "@/components/domain";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Methodology & disclaimers",
  description: "How travel, fatigue, player splits and projections are computed — plus limitations and legal notes.",
};

const SECTIONS = [
  { id: "provenance", label: "Data provenance" },
  { id: "travel", label: "Travel estimation" },
  { id: "edge-cases", label: "Edge cases" },
  { id: "fatigue", label: "Fatigue index" },
  { id: "predictions", label: "Prediction model" },
  { id: "players", label: "Player impact" },
  { id: "limitations", label: "Limitations" },
  { id: "legal", label: "Legal & privacy" },
];

export default async function MethodologyPage() {
  const ds = await getDataset();

  return (
    <div>
      <PageHeader
        eyebrow="Transparency"
        title="Methodology & disclaimers"
        description="Every number in this app is pulled from a live feed, derived from a schedule, or synthetic. This page explains which is which."
      >
        <MetaLine
          meta={{
            provenance: ds.mode === "live" ? "live" : "mock",
            source: "documentation",
            updatedAt: ds.generatedAt,
            note: `Version 1.1 · ${ds.mode === "live" ? "live data build" : "synthetic fallback"}`,
          }}
        />
      </PageHeader>

      <div className="grid gap-8 lg:grid-cols-[200px_minmax(0,1fr)]">
        <nav aria-label="On this page" className="hidden lg:block">
          <div className="sticky top-24 space-y-1">
            <p className="label-xs mb-2">On this page</p>
            {SECTIONS.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="block rounded-lg px-2 py-1 text-[11px] text-mist-400 transition-colors hover:bg-white/[0.04] hover:text-mist-100"
              >
                {section.label}
              </a>
            ))}
          </div>
        </nav>

        <div className="max-w-3xl space-y-10 text-[13px] leading-relaxed text-mist-300">
          <section id="provenance" className="scroll-mt-24">
            <h2 className="text-lg font-semibold tracking-tight text-mist-50">1. Data provenance contract</h2>
            <p className="mt-2">
              Every widget that displays data carries a badge and a last-updated timestamp. The four states are not
              interchangeable, and the app never upgrades a label without a successful call to a licensed provider.
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {[
                { label: "Live", tone: "mint" as const, text: "Fetched from a provider within the freshness window (≤60s for scores)." },
                { label: "Cached", tone: "iris" as const, text: "Served from a cache; may lag the provider. Timestamp reflects the fetch." },
                { label: "Estimated", tone: "amber" as const, text: "Derived mathematically from schedules and coordinates — not measured." },
                { label: "Mock", tone: "neutral" as const, text: "Synthetic data generated for the demo. Not real NBA data." },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-[var(--hairline)] bg-white/[0.02] p-3">
                  <Badge tone={item.tone}>{item.label}</Badge>
                  <p className="mt-2 text-[12px] text-mist-400">{item.text}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[12px] text-mist-500">
              This deployment pulls <strong className="text-mist-300">live schedules, scores, injuries, rosters and
              player game logs from ESPN&apos;s public NBA endpoints</strong> (no key required), so those widgets are
              labelled Live. Travel geometry is Estimated. If the feed is unreachable, the app falls back to the
              synthetic engine, the banner flips to Mock, and nothing is relabelled as live. See the{" "}
              <Link href="/status" className="text-mint-300 underline decoration-dotted">
                data status page
              </Link>{" "}
              for the current state of every source.
            </p>
          </section>

          <section id="travel" className="scroll-mt-24">
            <h2 className="text-lg font-semibold tracking-tight text-mist-50">2. How travel is estimated</h2>
            <p className="mt-2">
              No flight data is licensed in this build. Travel is reconstructed from the schedule:
            </p>
            <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-[12px] text-mist-400">
              <li>A team&apos;s location changes when the next game is in a different city than the previous one.</li>
              <li>The leg distance is the great-circle distance between airport coordinates, plus a 6% routing buffer.</li>
              <li>Flights are assumed to depart the day before the game; on a back-to-back the team flies the same day.</li>
              <li>Time-zone change is the signed difference in standard UTC offsets between airports.</li>
              <li>Home games use the arena coordinates; road games use the opponent&apos;s arena coordinates.</li>
            </ol>
            <p className="mt-2 text-[12px] text-mist-400">
              Distances are rounded to whole miles. Airport-to-arena ground transfer is not modelled, and no private
              terminal, charter or crew routing is assumed. This is deliberately conservative: real charter travel differs
              in departure times, routing and ground transport.
            </p>
            <div className="mt-3 rounded-xl border border-amber-300/20 bg-amber-300/[0.05] p-3 text-[12px] text-amber-100/80">
              <strong className="font-semibold text-amber-100">Never labelled live:</strong> travel in this app is always
              <code className="mx-1 rounded bg-black/30 px-1 py-0.5 font-mono text-[11px]">Estimated</code>. No widget claims
              real-time flight tracking or ADS-B data.
            </div>
          </section>

          <section id="edge-cases" className="scroll-mt-24">
            <h2 className="text-lg font-semibold tracking-tight text-mist-50">3. Edge cases</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[560px] text-[12px]">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wider text-mist-600">
                    <th className="py-1.5 pr-3 font-semibold">Case</th>
                    <th className="py-1.5 font-semibold">Rule used here</th>
                  </tr>
                </thead>
                <tbody className="text-mist-400">
                  {[
                    ["Road trip", "Two or more consecutive games as the away team. A single away game is a one-game trip."],
                    ["Rest day", "A full calendar day with no game between two games. Rest days = day gap − 1, floored at 0."],
                    ["Back-to-back", "Games on consecutive calendar dates (rest days = 0)."],
                    ["Altitude", "Venue elevation ≥ 4,000 ft. Currently Denver (5,280 ft) and Salt Lake City (4,226 ft)."],
                    ["Time-zone direction", "Eastward travel is treated with the same magnitude as westward in the index; the signed shift is stored on each leg for future research."],
                    ["Airport-to-arena", "Not modelled — a known under-estimate of door-to-door burden."],
                    ["Neutral-site game", "Uses the neutral venue coordinates and a zero home-court term. Neither team is treated as home."],
                    ["International game", "Treated as neutral site plus a longer leg. Passport/immigration time is not modelled."],
                    ["Postponed game", "Shown as Postponed with no score and excluded from records, rest calculations and fatigue windows until replayed."],
                    ["Rescheduled game", "Appears as a new game id with a `rescheduled` flag; the original date keeps its postponement record."],
                    ["Playoffs", "Not generated in the demo calendar. The model has no playoff-specific rest or seeding adjustment."],
                  ].map(([label, rule]) => (
                    <tr key={label} className="border-t border-[var(--hairline)] align-top">
                      <td className="py-2 pr-3 font-medium text-mist-300">{label}</td>
                      <td className="py-2">{rule}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section id="fatigue" className="scroll-mt-24">
            <h2 className="text-lg font-semibold tracking-tight text-mist-50">4. Travel Fatigue Index</h2>
            <p className="mt-2">
              A deterministic 0–100 heuristic. Each input is normalised against a cap and multiplied by a fixed weight;
              weights sum to 100.
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[520px] text-[12px]">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wider text-mist-600">
                    <th className="py-1.5 pr-3 font-semibold">Input</th>
                    <th className="py-1.5 pr-3 font-semibold">Cap</th>
                    <th className="py-1.5 font-semibold">Weight</th>
                  </tr>
                </thead>
                <tbody className="text-mist-400">
                  {[
                    ["Miles flown, last 7 days", FATIGUE_CAPS.miles7, FATIGUE_WEIGHTS.miles7],
                    ["Miles flown, last 14 days", FATIGUE_CAPS.miles14, FATIGUE_WEIGHTS.miles14],
                    ["Time zones crossed, 7 days", FATIGUE_CAPS.timeZones7, FATIGUE_WEIGHTS.timeZones7],
                    ["Back-to-backs, 7 days", FATIGUE_CAPS.backToBacks7, FATIGUE_WEIGHTS.backToBacks7],
                    ["Rest deficit (0 rest = max)", 1, FATIGUE_WEIGHTS.rest],
                    ["Altitude games, 7 days", FATIGUE_CAPS.altitudeGames7, FATIGUE_WEIGHTS.altitude],
                    ["Games in 7 days", FATIGUE_CAPS.games7, FATIGUE_WEIGHTS.density],
                    ["Projected minutes load", 1, FATIGUE_WEIGHTS.minutes],
                  ].map(([label, cap, weight]) => (
                    <tr key={String(label)} className="border-t border-[var(--hairline)]">
                      <td className="py-1.5 pr-3">{label}</td>
                      <td className="num py-1.5 pr-3">{String(cap)}</td>
                      <td className="num py-1.5">{String(weight)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <pre className="mt-3 overflow-x-auto rounded-xl border border-[var(--hairline)] bg-black/30 p-3 font-mono text-[11px] text-mist-300">
{`index = Σ weightᵢ × clamp(valueᵢ / capᵢ, 0, 1)
bands: <20 fresh · <40 manageable · <60 elevated · <80 high · ≥80 severe`}
            </pre>
            <p className="mt-2 text-[12px] text-mist-400">
              The index is a scheduling heuristic, not a medical assessment or injury predictor. In live mode the
              per-player minutes component is <strong className="text-mist-300">unavailable</strong> — the public feed does
              not expose team box scores cheaply — so it is omitted and the remaining weights are renormalised to 100
              rather than injecting a constant that looks like data. The simulated fallback does model minutes.
            </p>
          </section>

          <section id="predictions" className="scroll-mt-24">
            <h2 className="text-lg font-semibold tracking-tight text-mist-50">5. Prediction model</h2>
            <p className="mt-2">
              A transparent additive margin model with a logistic link ({MODEL_VERSION}). Elo carries team strength; the
              rest is applied as explicit point adjustments:
            </p>
            <pre className="mt-3 overflow-x-auto rounded-xl border border-[var(--hairline)] bg-black/30 p-3 font-mono text-[11px] text-mist-300">
{`margin = (eloHome - eloAway) / 25
       + ${HOME_COURT_POINTS.toFixed(1)} (home; 0 at neutral sites)
       + 0.85 × (restHome - restAway), capped ±3
       + 1.4 × (awayB2B - homeB2B)
       + 0.28 × (awayMiles7 - homeMiles7)/1000, capped ±2.2
       + 0.40 × (awayZones7 - homeZones7), capped ±1.6
       + 1.1 altitude (if visitor rested ≤1 day), else 0.5
       + 0.55 × (awayInjuryPts - homeInjuryPts), capped ±6

P(home win) = Φ(margin / ${MARGIN_SIGMA})`}
            </pre>
            <p className="mt-2 text-[12px] text-mist-400">
              Elo updates use K = 18 with a 60-point home advantage and start from a mock preseason prior. Injury impact
              converts a player&apos;s points-per-36 and BPM into points lost. Probabilities are clamped to 2–98% and
              rounded; confidence is bucketed (low / medium / high) from the edge, games of evidence and lineup
              uncertainty.
            </p>
            <p className="mt-2 text-[12px] text-mist-400">
              <strong className="text-mist-300">Baseline:</strong> the same Elo-plus-home-court expression with no fatigue,
              rest or injury terms. The held-out {ds.previousSeasonId} season is graded for both, reporting accuracy, Brier
              score, log loss and a ten-bucket calibration curve. A negative skill score means the richer model lost to the
              baseline — we show it rather than hide it.
            </p>
            <p className="mt-2 text-[12px] text-mist-400">
              In live mode the coefficients are estimated by OLS on the {ds.fitSeasonId} season (margin regressed on Elo
              difference, home court, rest, back-to-backs, mileage, time zones and altitude) and evaluated out-of-sample on
              {ds.previousSeasonId}. Seasons are computed from the current date, so this rolls forward automatically. If the
              fit is rejected, hand-set defaults are used instead.
            </p>
            <p className="mt-2 text-[12px] text-mist-400">
              <strong className="text-mist-300">Live ledger.</strong> The first projection captured for each game in the
              next 48 hours is written to a local JSONL ledger and graded after the final buzzer. The predictions page
              reports that live accuracy and Brier alongside the historical backtest, so the model is judged on games it
              could not have seen.
            </p>
            <p className="mt-2 text-[12px] text-mist-500">
              Do not use this model for wagering. Published prediction models are rarely better than a well-tuned Elo
              baseline, and this one is honest about when it is not.
            </p>
          </section>

          <section id="players" className="scroll-mt-24">
            <h2 className="text-lg font-semibold tracking-tight text-mist-50">6. Player travel impact</h2>
            <p className="mt-2">
              Splits are only reported with sample sizes attached. Splits with n &lt; {MIN_SPLIT_SAMPLE} are displayed but
              flagged; the adjusted model needs at least {MIN_MODEL_N} appearances.
            </p>
            <p className="mt-2 text-[12px] text-mist-400">
              The adjusted estimate is an ordinary least squares regression of points per 36 minutes on:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[12px] text-mist-400">
              <li>back-to-back indicator</li>
              <li>thousands of miles flown in the prior 7 days</li>
              <li>absolute time zones crossed in the prior 7 days</li>
              <li>altitude-game indicator</li>
              <li>home/road indicator</li>
              <li>opponent defensive rating</li>
            </ul>
            <p className="mt-2 text-[12px] text-mist-400">
              Standard errors are classical (residual variance × (XᵀX)⁻¹), shown as ±95% intervals. A coefficient whose
              interval crosses zero is labelled “not distinguishable from zero”. The Travel Impact Score prices a heavy
              travel scenario (back-to-back, 4,000 miles, two zones, an altitude game) using coefficients shrunk toward
              zero by their standard errors — a communication device, not a new statistic.
            </p>
            <div className="mt-3 rounded-xl border border-amber-300/20 bg-amber-300/[0.05] p-3 text-[12px] text-amber-100/80">
              Correlation is not causation. Injuries, matchup difficulty, load management, lineup changes and score effects
              are unobserved or only partly controlled. Rookie/small-sample players will show unstable splits.
            </div>
          </section>

          <section id="limitations" className="scroll-mt-24">
            <h2 className="text-lg font-semibold tracking-tight text-mist-50">7. Limitations</h2>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[12px] text-mist-400">
              <li>Live mode reads ESPN&apos;s public, undocumented endpoints; they may change, rate-limit or disappear. Production use requires a licensed feed with a support contract.</li>
              <li>The completed {ds.previousSeasonId} season is used for backtesting; current-season projections start from a preseason prior and update as results arrive.</li>
              <li>Injury impact uses a coarse position/availability prior rather than a fitted lineup model, and historical injury data is not backfilled for {ds.fitSeasonId}.</li>
              <li>The live ledger is file-backed; on read-only hosts it degrades to in-memory and only grades games seen by that process.</li>
              <li>Travel is schedule-derived; charter routes, delays and ground transport are unknown.</li>
              <li>No lineup-level or possession-level modelling; no playoff, travel-fatigue interaction by position, or back-to-back-by-altitude interaction.</li>
              <li>Elo ratings carry across seasons without a reset, and are not recency-weighted.</li>
              <li>The prediction history is recomputed deterministically per request, not stored in a database.</li>
              <li>Rate limiting is per-instance and in memory; a serverless deployment needs a shared store for real limits.</li>
            </ul>
          </section>

          <section id="legal" className="scroll-mt-24">
            <h2 className="text-lg font-semibold tracking-tight text-mist-50">8. Legal, privacy & disclaimers</h2>
            <div className="mt-3 space-y-3 text-[12px] text-mist-400">
              <p>
                <strong className="text-mist-300">Trademarks.</strong> “NBA”, team names, nicknames, arena names and
                colours are trademarks of their respective owners. This project is not affiliated with, endorsed by, or
                licensed by the NBA or any team. No team logos, wordmarks or player likenesses are used; team marks are
                abbreviation chips tinted with team colours for identification.
              </p>
              <p>
                <strong className="text-mist-300">Data provider terms.</strong> Live data comes from ESPN&apos;s public
                NBA JSON endpoints. ESPN&apos;s terms of use, attribution requirements and rate limits apply; this project
                is not endorsed by ESPN and should not be relied on commercially without a licensed agreement. balldontlie,
                SportsDataIO, Sportradar and The Odds API each carry their own terms as well.
              </p>
              <p>
                <strong className="text-mist-300">Privacy.</strong> There are no accounts, cookies for tracking, or
                analytics. The watchlist and theme preference are stored in your browser&apos;s localStorage only and never
                sent to a server. Server logs may contain request paths and IP addresses if you deploy with a host that
                logs them.
              </p>
              <p>
                <strong className="text-mist-300">Not betting advice.</strong> Projections are informational only. They
                are derived from public data and a hand-tuned model, carry wide uncertainty, and must not be used to place
                wagers. No guarantee of accuracy is made or implied.
              </p>
              <p>
                <strong className="text-mist-300">OpenStreetMap.</strong> Basemap tiles are © OpenStreetMap contributors,
                available under the ODbL. The no-token mode renders without any tile server.
              </p>
              <p className="text-[11px] text-mist-600">
                Document version 1.1 · model v2.0-live-elo-fatigue · generated {ds.generatedAt}.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
