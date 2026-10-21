"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Activity,
  ArrowLeftRight,
  BookOpen,
  LayoutDashboard,
  Map as MapIcon,
  Menu,
  Moon,
  Sparkles,
  Star,
  Sun,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LiveRefresher } from "@/components/live-refresh";

const PRIMARY = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/map", label: "Travel map", icon: MapIcon },
  { href: "/teams", label: "Teams", icon: Users },
  { href: "/predictions", label: "Predictions", icon: Sparkles },
  { href: "/compare", label: "Compare", icon: ArrowLeftRight },
  { href: "/watchlist", label: "Watchlist", icon: Star },
];

const SECONDARY = [
  { href: "/methodology", label: "Methodology", icon: BookOpen },
  { href: "/status", label: "Data status", icon: Activity },
];

const MOBILE = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/map", label: "Map", icon: MapIcon },
  { href: "/teams", label: "Teams", icon: Users },
  { href: "/predictions", label: "Picks", icon: Sparkles },
  { href: "/watchlist", label: "Watch", icon: Star },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const current = document.documentElement.dataset.theme === "light" ? "light" : "dark";
    setTheme(current);
  }, []);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("nbatt-theme", next);
    } catch {
      /* ignore private mode */
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
      className={cn(
        "inline-grid size-9 place-items-center rounded-xl border border-[var(--hairline)] bg-white/[0.03] text-mist-300 transition-colors hover:text-mist-100",
        className,
      )}
    >
      {theme === "dark" ? <Sun className="size-4" aria-hidden /> : <Moon className="size-4" aria-hidden />}
    </button>
  );
}

export function SiteHeader({ mode = "mock", updatedAt }: { mode?: "live" | "mock"; updatedAt?: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-mint-400 focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-ink-950"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-50 border-b border-[var(--hairline)] bg-ink-950/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-3 px-4 sm:px-6">
          <Link href="/" className="group flex items-center gap-2.5 pr-2">
            <span className="relative grid size-8 place-items-center rounded-xl bg-gradient-to-br from-mint-400 to-iris-400 text-ink-950">
              <svg viewBox="0 0 24 24" className="size-4" fill="none" aria-hidden>
                <path d="M3 17.5 9 7l4 6.5L15.5 10 21 17.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="18.5" cy="5.5" r="1.8" fill="currentColor" />
              </svg>
            </span>
            <span className="leading-none">
              <span className="block text-[13px] font-extrabold tracking-[0.14em] text-mist-100">NBA TRAVEL</span>
              <span className="block text-[10px] font-semibold tracking-[0.34em] text-mint-300">TRACKER</span>
            </span>
          </Link>

          <nav aria-label="Primary" className="hidden flex-1 items-center gap-0.5 lg:flex">
            {PRIMARY.map((link) => {
              const active = isActive(pathname, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium transition-colors",
                    active
                      ? "bg-white/[0.06] text-mist-50"
                      : "text-mist-400 hover:bg-white/[0.04] hover:text-mist-100",
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <div className="hidden items-center gap-1 xl:flex">
              {SECONDARY.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "rounded-lg px-2 py-1 text-[11px] font-medium transition-colors",
                    isActive(pathname, link.href) ? "text-mint-300" : "text-mist-500 hover:text-mist-200",
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </div>
            <LiveRefresher mode={mode} updatedAt={updatedAt} />
            <ThemeToggle />
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls="mobile-menu"
              aria-label="Toggle navigation menu"
              className="inline-grid size-9 place-items-center rounded-xl border border-[var(--hairline)] bg-white/[0.03] text-mist-300 lg:hidden"
            >
              {open ? <X className="size-4" aria-hidden /> : <Menu className="size-4" aria-hidden />}
            </button>
          </div>
        </div>

        {open ? (
          <div id="mobile-menu" className="border-t border-[var(--hairline)] px-4 pb-4 pt-2 lg:hidden">
            <div className="grid grid-cols-2 gap-1">
              {[...PRIMARY, ...SECONDARY].map((link) => {
                const Icon = link.icon;
                const active = isActive(pathname, link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-3 py-2 text-sm",
                      active ? "bg-white/[0.06] text-mist-50" : "text-mist-300",
                    )}
                  >
                    <Icon className="size-4 text-mist-500" aria-hidden />
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ) : null}
      </header>

      <div
        className={
          mode === "live"
            ? "border-b border-mint-400/15 bg-mint-400/[0.05]"
            : "border-b border-amber-300/15 bg-amber-300/[0.06]"
        }
      >
        <div
          className={
            mode === "live"
              ? "mx-auto flex max-w-[1400px] items-center gap-2 px-4 py-1.5 text-[11px] text-mint-200/90 sm:px-6"
              : "mx-auto flex max-w-[1400px] items-center gap-2 px-4 py-1.5 text-[11px] text-amber-200/90 sm:px-6"
          }
        >
          <span
            className={
              mode === "live"
                ? "inline-block size-1.5 shrink-0 rounded-full bg-mint-300"
                : "inline-block size-1.5 shrink-0 rounded-full bg-amber-300"
            }
            aria-hidden
          />
          <p className="min-w-0 flex-1 truncate">
            {mode === "live" ? (
              <>
                Live NBA feed — schedules, scores and injuries from ESPN, refreshing automatically. Travel is{" "}
                <strong className="font-semibold">estimated</strong> from schedules; no live flight tracking.
              </>
            ) : (
              <>
                Synthetic fallback — live data is unavailable, so scores, injuries and rosters are{" "}
                <strong className="font-semibold">mock</strong>. Travel remains estimated.
              </>
            )}
          </p>
          <Link
            href="/status"
            className={
              mode === "live"
                ? "ml-auto hidden shrink-0 font-semibold text-mint-200 hover:text-mint-100 sm:block"
                : "ml-auto hidden shrink-0 font-semibold text-amber-200 hover:text-amber-100 sm:block"
            }
          >
            Data status
          </Link>
        </div>
      </div>

      <nav aria-label="Mobile" className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--hairline)] bg-ink-950/95 backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex max-w-md items-stretch justify-around px-2 pb-[env(safe-area-inset-bottom)]">
          {MOBILE.map((link) => {
            const Icon = link.icon;
            const active = isActive(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium",
                  active ? "text-mint-300" : "text-mist-500",
                )}
              >
                <Icon className="size-[18px]" aria-hidden />
                {link.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
