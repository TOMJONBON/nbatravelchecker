import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * CSS-driven entrance animations.
 *
 * Deliberately not JS-driven: content must be visible even if hydration is slow
 * or fails, and `prefers-reduced-motion` is handled in CSS (globals.css).
 */
export function FadeIn({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <div className={cn("animate-fade-up", className)} style={{ animationDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

export function Stagger({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}

export function StaggerItem({
  children,
  className,
  index = 0,
}: {
  children: ReactNode;
  className?: string;
  index?: number;
}) {
  return (
    <div className={cn("animate-fade-up", className)} style={{ animationDelay: `${index * 60}ms` }}>
      {children}
    </div>
  );
}
