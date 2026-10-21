import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatMiles(miles: number): string {
  return `${Math.round(miles).toLocaleString("en-US")} mi`;
}

export function pct(value: number, digits = 0): string {
  return `${(value * 100).toFixed(digits)}%`;
}

export function signed(value: number, digits = 1): string {
  const rounded = Number(value.toFixed(digits));
  return `${rounded > 0 ? "+" : ""}${rounded.toFixed(digits)}`;
}

export function recordLabel(wins: number, losses: number): string {
  return `${wins}-${losses}`;
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("");
}

export function shortName(name: string): string {
  const parts = name.split(" ");
  return `${parts[0][0]}. ${parts.slice(1).join(" ")}`;
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}
