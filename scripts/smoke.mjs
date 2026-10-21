#!/usr/bin/env node
/**
 * E2E smoke test: hits every page and API route on a running production build.
 *
 *   npm run build && npm run start
 *   npm run smoke                     # defaults to http://127.0.0.1:4310
 *   BASE_URL=https://… npm run smoke
 */
const BASE = process.env.BASE_URL ?? "http://127.0.0.1:4310";

const results = [];

function record(name, ok, detail) {
  results.push({ name, ok, detail });
}

async function checkPage(path, marker) {
  try {
    const res = await fetch(`${BASE}${path}`, { redirect: "manual" });
    const html = await res.text();
    const hasMarker = marker ? html.includes(marker) : true;
    record(path, res.status === 200 && hasMarker, `${res.status}${hasMarker ? "" : " · marker missing"} · ${html.length}b`);
  } catch (error) {
    record(path, false, error.message);
  }
}

async function checkJson(path, predicate, expectedStatus = 200) {
  try {
    const res = await fetch(`${BASE}${path}`);
    const body = await res.json();
    const ok = res.status === expectedStatus && predicate(body);
    record(path, ok, `${res.status} · ${JSON.stringify(body).length}b`);
    return body;
  } catch (error) {
    record(path, false, error.message);
    return null;
  }
}

async function main() {
  await checkJson("/api/status", (body) => Array.isArray(body.data?.status) && body.data.status.length > 0);
  await checkJson("/api/teams", (body) => body.data?.length === 30);

  const games = await checkJson("/api/games", (body) => Array.isArray(body.data) && body.data.length > 0);
  const gameId = games?.data?.[0]?.id;

  // Player ids differ between live (ESPN athlete ids) and mock (team-p1) modes.
  const teamPage = await fetch(`${BASE}/teams/bos`).then((response) => response.text()).catch(() => "");
  const playerId = teamPage.match(/\/players\/([a-z0-9-]+)/i)?.[1];

  await checkJson("/api/predictions", (body) => Array.isArray(body.data) && typeof body.report?.accuracy === "number");
  await checkJson("/api/teams/bos/travel", (body) => typeof body.data?.metrics?.fatigueIndex === "number");
  await checkJson("/api/map/travel", (body) => Array.isArray(body.data?.trips));
  if (playerId) {
    await checkJson(
      `/api/players/${playerId}/travel-impact`,
      (body) => typeof body.data?.impact?.travelImpactScore === "number" && Array.isArray(body.data.impact.splits.rest),
    );
  } else {
    record("/api/players/:id/travel-impact", false, "no player link found on /teams/bos");
  }
  await checkJson("/api/teams/not-a-team/travel", (body) => Boolean(body.error), 404);

  await checkPage("/", "Where the league is");
  await checkPage("/map", "Follow the flights");
  await checkPage("/teams", "All 30 teams");
  await checkPage("/teams/bos", "Boston Celtics");
  if (playerId) await checkPage(`/players/${playerId}`, "Travel impact explained");
  await checkPage("/predictions", "Predictions, with the receipts");
  await checkPage("/compare?teams=bos,den", "Two teams, one lens");
  await checkPage("/watchlist", "Watchlist &amp; alerts");
  await checkPage("/methodology", "Methodology &amp; disclaimers");
  await checkPage("/status", "Data source status");
  if (gameId) await checkPage(`/games/${gameId}`, "Projection");

  const failed = results.filter((result) => !result.ok);
  const width = Math.max(...results.map((result) => result.name.length));
  for (const result of results) {
    console.log(`${result.ok ? "PASS" : "FAIL"}  ${result.name.padEnd(width)}  ${result.detail}`);
  }
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length > 0) process.exitCode = 1;
}

main();
