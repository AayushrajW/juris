import { cn } from "@/lib/cn";
import { APP_NAME } from "@/lib/constants";
import type { HTMLAttributes, ReactNode } from "react";

type Tone = "info" | "success" | "warning" | "urgent" | "demo" | "ai" | "neutral";

const tones: Record<Tone, string> = {
  info: "bg-pastel-blue text-info",
  success: "bg-pastel-green text-success",
  warning: "bg-pastel-orange text-warning",
  urgent: "bg-pastel-red text-danger",
  demo: "bg-bg text-muted",
  ai: "bg-pastel-orange text-ai",
  neutral: "bg-bg text-navy",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[12px] font-semibold",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Card({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("ns-card p-5", className)} {...props}>
      {children}
    </div>
  );
}

export function Section({
  id,
  title,
  description,
  children,
  actions,
}: {
  id?: string;
  title: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[17px] font-semibold text-navy">{title}</h2>
          {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-surface px-6 py-10 text-center">
      <p className="text-[18px] font-semibold text-navy">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-[15px] text-muted">{body}</p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

type AlertTone = "info" | "success" | "warning" | "danger";

const alertClass: Record<AlertTone, string> = {
  info: "border-transparent bg-pastel-blue text-ink",
  success: "border-transparent bg-pastel-green text-ink",
  warning: "border-transparent bg-pastel-orange text-ink",
  danger: "border-transparent bg-pastel-red text-ink",
};

export function Alert({
  tone = "info",
  title,
  children,
}: {
  tone?: AlertTone;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn("rounded-2xl border px-4 py-3 text-sm", alertClass[tone])}
    >
      <p className="font-semibold text-navy">{title}</p>
      {children ? <div className="mt-1 text-ink/90">{children}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-navy/8", className)} />;
}

export function DisclaimerBar({ compact = false }: { compact?: boolean }) {
  return (
    <p
      className={cn(
        "text-muted",
        compact ? "px-4 py-2 text-[13px]" : "px-4 py-2.5 text-sm",
      )}
    >
      {APP_NAME} explains papers in simple words. It is not a lawyer.
    </p>
  );
}

/** Shown on every page while the app runs on sample data. */
export function DemoBanner() {
  return (
    <p role="note" className="bg-navy px-4 py-1.5 text-center text-[13px] font-medium text-white">
      Demo — sample data only. Do not enter real personal details.
    </p>
  );
}
