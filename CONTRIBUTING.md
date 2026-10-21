# Contributing

Thanks for taking a look. This project is a demo-grade analytics app, and the
most valuable contributions are the ones that make its data more honest or its
model easier to trust.

## Ground rules

1. **Never present derived data as measured data.** If a number is estimated,
   modelled or synthetic, it must carry the right provenance label
   (`Live / Cached / Estimated / Mock`) and a last-updated timestamp.
2. **No fabricated "live" feeds.** If a source is unavailable, fall back and
   say so — the synthetic engine exists for exactly this case.
3. **No secrets in the repo.** API keys go in `.env.local`, which is ignored.
   `.env.example` documents variable names only.
4. **Respect the data providers.** ESPN's public endpoints are not a commercial
   contract. Do not add scraping, bypassing rate limits, or redistribution of
   licensed data.

## Setup

```bash
npm install
npm run dev          # http://localhost:4310
```

No API key is required: the app reads ESPN's public NBA endpoints and falls
back to a deterministic synthetic dataset if they are unreachable.

## Checks before opening a PR

```bash
npm run typecheck
npm test
npm run build
npm run start        # in another shell
npm run smoke
```

CI runs the same checks on every push and pull request. On a fresh clone,
Next generates type stubs (`.next/types`, `next-env.d.ts`) during the first
`dev`/`build`; run `npm run build` once before a standalone `npm run typecheck`.

## Where things live

| Area | Path |
| --- | --- |
| Live provider (ESPN) | `src/lib/providers/espn.ts` |
| Season arithmetic (rollover) | `src/lib/seasons.ts` |
| Prediction ledger | `src/lib/ledger.ts` (writes `.data/predictions.jsonl`) |
| Dataset assembly, caching, fallback | `src/lib/data.ts` |
| Synthetic fallback engine | `src/lib/dataset.ts`, `src/lib/schedule.ts` |
| Travel legs and road trips | `src/lib/travel.ts` |
| Fatigue index | `src/lib/fatigue.ts` |
| Prediction model and Elo | `src/lib/predictions.ts` |
| Player impact model (OLS) | `src/lib/player-impact.ts` |
| UI pages | `src/app/**` |
| Design system | `src/app/globals.css`, `src/components/ui.tsx` |

## Adding a data provider

Implement the normaliser so it returns the existing domain types
(`Game`, `Player`, `InjuryStatus`) and route it through `src/lib/data.ts`. A
provider must only be labelled `live` after a successful fetch in the current
process; failures must fall back to the previous payload or the synthetic
engine. Add parsing tests with recorded fixtures — the live adapter is the most
failure-prone code in the app.

## Style

- TypeScript strict mode; no `any` in new code.
- Tailwind for styling; reuse the primitives in `src/components/ui.tsx`.
- Keep animations subtle and respect `prefers-reduced-motion`.
- Update `README.md` and `/methodology` when you change a formula or a data
  source.
