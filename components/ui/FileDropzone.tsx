"use client";

import { cn } from "@/lib/cn";
import { FILE_ACCEPT, checkFile, fileKind } from "@/lib/files";
import { formatFileSize } from "@/lib/format";
import { Camera, FileText, Image as ImageIcon } from "lucide-react";
import { useTranslations } from "use-intl";
import { useCallback, useId, useRef, useState } from "react";

export function FileDropzone({
  id,
  value,
  onChange,
  label,
  error,
}: {
  id?: string;
  value: File | null;
  onChange: (file: File | null) => void;
  label: string;
  /** A problem the form found, such as no paper chosen. */
  error?: string;
}) {
  const t = useTranslations("file");
  const inputRef = useRef<HTMLInputElement>(null);
  const [rejected, setRejected] = useState<string | null>(null);
  const errorId = useId();
  const shown = rejected ?? error;

  const handleFiles = useCallback(
    (list: FileList | null) => {
      const file = list?.[0];
      // Clearing the field lets the same file be picked again after it is removed.
      if (inputRef.current) inputRef.current.value = "";
      if (!file) return;
      const problem = checkFile(file);
      if (problem) {
        setRejected(t(problem === "size" ? "errSize" : "errType"));
        return;
      }
      setRejected(null);
      onChange(file);
    },
    [onChange, t],
  );

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        tabIndex={-1}
        aria-hidden
        accept={FILE_ACCEPT}
        className="sr-only"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <button
        id={id}
        type="button"
        aria-label={`${label}: ${t("choose")}`}
        aria-describedby={shown ? errorId : undefined}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
        }}
        onDrop={(e) => {
          e.preventDefault();
          handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex w-full min-h-36 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed bg-pastel-blue/60 px-4 py-8 text-center hover:bg-pastel-blue",
          shown ? "border-danger" : "border-primary/30",
        )}
      >
        <Camera className="size-8 text-navy" strokeWidth={1.75} aria-hidden />
        <span className="text-[17px] font-semibold text-navy">{t("choose")}</span>
        <span className="text-[14px] text-muted">{t("hint")}</span>
      </button>
      {shown ? (
        <p id={errorId} className="mt-2 text-[15px] text-danger" role="alert">
          {shown}
        </p>
      ) : null}
      {value ? (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            {fileKind(value.type) === "image" ? (
              <ImageIcon className="size-5 shrink-0 text-info" aria-hidden />
            ) : (
              <FileText className="size-5 shrink-0 text-navy" aria-hidden />
            )}
            <div className="min-w-0">
              <p className="truncate text-[15px] font-medium text-ink">{value.name}</p>
              <p className="text-[13px] text-muted">{t("notSent", { size: formatFileSize(value.size) })}</p>
            </div>
          </div>
          <button
            type="button"
            className="min-h-11 px-2 text-[15px] font-semibold text-navy underline-offset-2 hover:underline"
            onClick={() => onChange(null)}
          >
            {t("remove")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function Stepper({
  steps,
  current,
  label,
}: {
  steps: string[];
  current: number;
  label: string;
}) {
  return (
    <ol className="flex flex-wrap gap-2" aria-label={label}>
      {steps.map((step, i) => {
        const state = i < current ? "done" : i === current ? "current" : "todo";
        return (
          <li
            key={step}
            aria-current={state === "current" ? "step" : undefined}
            className={cn(
              "rounded-full px-3 py-1.5 text-[14px] font-semibold",
              state === "current" && "bg-navy text-white",
              state === "done" && "bg-pastel-green text-success",
              state === "todo" && "bg-navy/8 text-muted",
            )}
          >
            {i + 1}. {step}
          </li>
        );
      })}
    </ol>
  );
}
