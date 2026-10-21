import { NextResponse } from "next/server";

const buckets = new Map<string, { count: number; reset: number }>();

/** Very small in-memory rate limiter; per-instance only (documented in README). */
export function rateLimit(key: string, limit = 120, windowMs = 60_000): { ok: boolean; remaining: number } {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return { ok: true, remaining: limit - 1 };
  }
  bucket.count += 1;
  return { ok: bucket.count <= limit, remaining: Math.max(0, limit - bucket.count) };
}

export function clientKey(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "local"
  );
}

export function json<T>(data: T, init?: { status?: number; cacheSeconds?: number; headers?: HeadersInit }) {
  const status = init?.status ?? 200;
  const cacheSeconds = init?.cacheSeconds ?? 30;
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": status === 200
        ? `public, s-maxage=${cacheSeconds}, stale-while-revalidate=${cacheSeconds * 2}`
        : "no-store",
      "X-Data-Provenance": "mock",
      ...init?.headers,
    },
  });
}

export function badRequest(message: string) {
  return json({ error: message }, { status: 400, cacheSeconds: 0 });
}

export function notFound(message: string) {
  return json({ error: message }, { status: 404, cacheSeconds: 0 });
}

export function guard(request: Request): NextResponse | null {
  const { ok, remaining } = rateLimit(`${clientKey(request)}:${new URL(request.url).pathname}`);
  if (!ok) {
    return json({ error: "Rate limit exceeded. Try again in a minute." }, { status: 429, cacheSeconds: 0 });
  }
  void remaining;
  return null;
}
