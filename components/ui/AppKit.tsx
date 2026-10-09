"use client";

import { cn } from "@/lib/cn";
import Link from "next/link";
import type { ReactNode } from "react";

export function Tabs({
  items,
  value,
  onChange,
  className,
}: {
  items: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "-mx-4 flex gap-1 overflow-x-auto border-b border-border px-4 md:mx-0 md:px-0",
        className,
      )}
      role="tablist"
    >
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.id)}
            className={cn(
              "shrink-0 border-b-[3px] px-3 py-3 text-[15px] font-semibold",
              active ? "border-primary text-primary" : "border-transparent text-muted hover:text-navy",
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

export function ActionCard({
  title,
  description,
  cta,
  href,
  icon,
  tone,
}: {
  title: string;
  description: string;
  cta: string;
  href: string;
  icon: ReactNode;
  tone: "blue" | "green" | "orange" | "purple";
}) {
  const tones = {
    blue: "bg-pastel-blue text-info",
    green: "bg-pastel-green text-success",
    orange: "bg-pastel-orange text-ai",
    purple: "bg-pastel-purple text-primary",
  };
  return (
    <Link
      href={href}
      className="ns-card flex min-h-[5.5rem] items-center gap-4 p-4 transition-colors hover:border-primary/30 md:min-h-0 md:flex-col md:items-start md:p-5"
    >
      <span className={cn("inline-flex size-12 shrink-0 items-center justify-center rounded-2xl", tones[tone])}>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[17px] font-semibold text-navy">{title}</span>
        <span className="mt-0.5 block text-[14px] leading-snug text-muted">{description}</span>
      </span>
      <span className="hidden text-[15px] font-semibold text-primary md:inline">{cta}</span>
      <span className="text-xl text-primary md:hidden" aria-hidden>
        →
      </span>
    </Link>
  );
}

export function FilterButton({
  onClick,
  activeCount = 0,
}: {
  onClick: () => void;
  activeCount?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-10 items-center gap-2 rounded-[10px] border border-border bg-surface px-3 text-sm font-semibold text-navy hover:bg-bg"
    >
      Filter
      {activeCount > 0 ? (
        <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] text-white">
          {activeCount}
        </span>
      ) : null}
    </button>
  );
}

export function AppPage({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("mx-auto w-full max-w-6xl px-4 py-5 md:px-8 md:py-7", className)}>{children}</div>;
}

export function PageHeading({
  kicker,
  title,
  subtitle,
  actions,
}: {
  kicker?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        {kicker}
        <h1 className="text-[24px] font-semibold tracking-tight text-navy md:text-[28px]">{title}</h1>
        {subtitle ? <p className="mt-1.5 max-w-xl text-[15px] leading-snug text-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
