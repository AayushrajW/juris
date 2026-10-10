import { cn } from "@/lib/cn";
import type { InputHTMLAttributes, ReactNode, Ref, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  id: string;
}

export function Input({
  label,
  hint,
  error,
  id,
  className,
  before,
  describedBy,
  ...props
}: FieldProps &
  InputHTMLAttributes<HTMLInputElement> & {
    ref?: Ref<HTMLInputElement>;
    /** Shown inside the box before what is typed, such as a country code. Not part of the value. */
    before?: ReactNode;
    /** The id of text elsewhere on the page that explains this field, read out with it. */
    describedBy?: string;
  }) {
  const described = [error ? `${id}-error` : hint ? `${id}-hint` : null, describedBy].filter(Boolean).join(" ");
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
      </label>
      <div className="relative">
        {before ? (
          <span aria-hidden className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-ink/70">
            {before}
          </span>
        ) : null}
        <input
          id={id}
          aria-invalid={Boolean(error)}
          aria-describedby={described || undefined}
          className={cn(
            "min-h-11 w-full rounded-[12px] border bg-surface px-3 text-base text-ink shadow-none outline-none transition-colors placeholder:text-muted",
            error ? "border-danger" : "border-border focus:border-navy",
            className,
          )}
          {...props}
        />
      </div>
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-sm text-demo">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Textarea({
  label,
  hint,
  error,
  id,
  className,
  ...props
}: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
      </label>
      <textarea
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={cn(
          "min-h-32 w-full rounded-[12px] border bg-surface px-3 py-2.5 text-base text-ink outline-none placeholder:text-muted",
          error ? "border-danger" : "border-border focus:border-navy",
          className,
        )}
        {...props}
      />
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-sm text-demo">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Select({
  label,
  hint,
  error,
  id,
  className,
  children,
  ...props
}: FieldProps & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
      </label>
      <select
        id={id}
        aria-invalid={Boolean(error)}
        className={cn(
          "min-h-11 w-full rounded-[12px] border border-border bg-surface px-3 text-base text-ink outline-none focus:border-primary",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      {hint ? <p className="text-sm text-demo">{hint}</p> : null}
      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

interface CheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  id: string;
}

export function Checkbox({ label, id, className, ...props }: CheckboxProps) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-3 text-sm text-ink">
      <input
        id={id}
        type="checkbox"
        className={cn(
          "mt-0.5 size-5 rounded border-border text-navy focus:ring-navy",
          className,
        )}
        {...props}
      />
      <span>{label}</span>
    </label>
  );
}
