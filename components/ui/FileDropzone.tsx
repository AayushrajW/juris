"use client";

import { cn } from "@/lib/cn";
import { formatFileSize } from "@/lib/format";
import { FileText, Image as ImageIcon, Upload } from "lucide-react";
import { useCallback, useRef, useState } from "react";

export interface LocalFile {
  fileName: string;
  mimeType: string;
  byteSize: number;
  kind: "pdf" | "image" | "other";
  previewUrl?: string;
}

function classify(file: File): LocalFile {
  const mimeType = file.type || "application/octet-stream";
  const kind: LocalFile["kind"] = mimeType.startsWith("image/")
    ? "image"
    : mimeType === "application/pdf"
      ? "pdf"
      : "other";
  return {
    fileName: file.name,
    mimeType,
    byteSize: file.size,
    kind,
    previewUrl: kind === "image" ? URL.createObjectURL(file) : undefined,
  };
}

export function FileDropzone({
  value,
  onChange,
}: {
  value: LocalFile | null;
  onChange: (file: LocalFile | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = useCallback(
    (list: FileList | null) => {
      const file = list?.[0];
      if (!file) return;
      const allowed = [
        "application/pdf",
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/heic",
      ];
      if (file.type && !allowed.includes(file.type) && !file.name.match(/\.(pdf|jpe?g|png|webp)$/i)) {
        setError("Use a PDF or an image (JPG, PNG, WebP).");
        return;
      }
      if (file.size > 12 * 1024 * 1024) {
        setError("Please choose a file under 12 MB for this demo.");
        return;
      }
      setError(null);
      onChange(classify(file));
    },
    [onChange],
  );

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png"
        className="sr-only"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
        }}
        onDrop={(e) => {
          e.preventDefault();
          handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex w-full min-h-36 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-primary/25 bg-pastel-purple/60 px-4 py-8 text-center hover:bg-pastel-purple focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        )}
      >
        <Upload className="size-6 text-navy" aria-hidden />
        <span className="font-medium text-navy">Drop a file here or choose one</span>
        <span className="text-sm text-demo">PDF or image · stays on this device in the demo</span>
      </button>
      {error ? (
        <p className="mt-2 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
      {value ? (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-md border border-border bg-surface px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            {value.kind === "image" ? (
              <ImageIcon className="size-4 shrink-0 text-info" aria-hidden />
            ) : (
              <FileText className="size-4 shrink-0 text-navy" aria-hidden />
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">{value.fileName}</p>
              <p className="text-xs text-demo">{formatFileSize(value.byteSize)} · not uploaded to a server</p>
            </div>
          </div>
          <button
            type="button"
            className="text-sm font-medium text-navy underline-offset-2 hover:underline"
            onClick={() => onChange(null)}
          >
            Remove
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function Stepper({
  steps,
  current,
}: {
  steps: string[];
  current: number;
}) {
  return (
    <ol className="flex flex-wrap gap-2" aria-label="Progress">
      {steps.map((step, i) => {
        const state = i < current ? "done" : i === current ? "current" : "todo";
        return (
          <li
            key={step}
            aria-current={state === "current" ? "step" : undefined}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium",
              state === "current" && "bg-navy text-white",
              state === "done" && "bg-success/15 text-success",
              state === "todo" && "bg-navy/8 text-demo",
            )}
          >
            {i + 1}. {step}
          </li>
        );
      })}
    </ol>
  );
}
