"use client";

import { useRouter } from "next/navigation";
import { TEAMS } from "@/lib/teams";

export function CompareSelector({ left, right }: { left: string; right: string }) {
  const router = useRouter();

  const update = (nextLeft: string, nextRight: string) => {
    router.replace(`/compare?teams=${nextLeft},${nextRight}`, { scroll: false });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor="compare-left">
        First team
      </label>
      <select
        id="compare-left"
        value={left}
        onChange={(event) => update(event.target.value, right)}
        className="h-9 rounded-xl border border-[var(--hairline)] bg-ink-900 px-2.5 text-xs font-medium text-mist-200"
      >
        {TEAMS.map((team) => (
          <option key={team.id} value={team.id}>
            {team.abbreviation} · {team.nickname}
          </option>
        ))}
      </select>
      <span className="text-[11px] text-mist-500">vs</span>
      <label className="sr-only" htmlFor="compare-right">
        Second team
      </label>
      <select
        id="compare-right"
        value={right}
        onChange={(event) => update(left, event.target.value)}
        className="h-9 rounded-xl border border-[var(--hairline)] bg-ink-900 px-2.5 text-xs font-medium text-mist-200"
      >
        {TEAMS.map((team) => (
          <option key={team.id} value={team.id}>
            {team.abbreviation} · {team.nickname}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => update(right, left)}
        className="h-9 rounded-xl border border-[var(--hairline)] bg-white/[0.03] px-3 text-[11px] font-semibold text-mist-300 hover:text-mist-100"
      >
        Swap
      </button>
    </div>
  );
}
