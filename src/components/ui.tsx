import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("glass rounded-2xl", className)} {...props} />;
}

export function CardHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3 px-5 pt-4 pb-3", className)}>
      <div className="min-w-0">
        <h3 className="text-[15px] font-semibold tracking-tight text-mist-100">{title}</h3>
        {subtitle ? <p className="mt-0.5 text-xs text-mist-400">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function CardBody({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("px-5 pb-5", className)} {...props} />;
}

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold tracking-wide",
  {
    variants: {
      tone: {
        neutral: "border-[var(--hairline)] bg-white/[0.04] text-mist-300",
        mint: "border-mint-500/30 bg-mint-500/10 text-mint-300",
        iris: "border-iris-400/30 bg-iris-400/10 text-iris-300",
        amber: "border-amber-300/30 bg-amber-300/10 text-amber-200",
        danger: "border-rose-400/30 bg-rose-400/10 text-rose-300",
        outline: "border-[var(--hairline-strong)] bg-transparent text-mist-300",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export function Badge({
  className,
  tone,
  ...props
}: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-mint-400 text-ink-950 hover:bg-mint-300",
        ghost: "border border-[var(--hairline)] bg-white/[0.03] text-mist-200 hover:bg-white/[0.08]",
        quiet: "text-mist-300 hover:text-mist-100",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-10 px-4",
        lg: "h-11 px-5",
      },
    },
    defaultVariants: { variant: "ghost", size: "md" },
  },
);

export function Button({
  className,
  variant,
  size,
  ...props
}: ComponentProps<"button"> & VariantProps<typeof buttonVariants>) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export function ButtonLink({
  className,
  variant,
  size,
  ...props
}: ComponentProps<typeof Link> & VariantProps<typeof buttonVariants>) {
  return <Link className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-white/[0.06]", className)} />;
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-4 flex items-end justify-between gap-4", className)}>
      <div>
        {eyebrow ? <p className="label-xs mb-1">{eyebrow}</p> : null}
        <h2 className="text-lg font-semibold tracking-tight text-mist-100 sm:text-xl">{title}</h2>
        {description ? <p className="mt-1 max-w-2xl text-sm text-mist-400">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "mint" | "amber" | "danger";
}) {
  const toneClass =
    tone === "mint" ? "text-mint-300" : tone === "amber" ? "text-amber-200" : tone === "danger" ? "text-rose-300" : "text-mist-100";
  return (
    <div className="rounded-xl border border-[var(--hairline)] bg-white/[0.02] px-4 py-3">
      <p className="label-xs">{label}</p>
      <p className={cn("num mt-1 text-xl font-semibold tracking-tight", toneClass)}>{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-mist-500">{hint}</p> : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  icon,
  action,
}: {
  title: string;
  description: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--hairline-strong)] px-6 py-12 text-center">
      {icon ? <div className="mb-3 text-mist-500">{icon}</div> : null}
      <p className="text-sm font-semibold text-mist-200">{title}</p>
      <p className="mt-1 max-w-sm text-xs text-mist-400">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow ? <p className="label-xs mb-1.5">{eyebrow}</p> : null}
        <h1 className="text-2xl font-semibold tracking-tight text-mist-50 sm:text-3xl">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-sm leading-relaxed text-mist-400">{description}</p> : null}
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </header>
  );
}

export function Divider({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-[var(--hairline)]", className)} />;
}
