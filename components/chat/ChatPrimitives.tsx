import { cn } from "@/lib/cn";

export function MessageBubble({
  align,
  tone = "plain",
  children,
}: {
  align: "left" | "right";
  tone?: "plain" | "accent" | "ai";
  children: React.ReactNode;
}) {
  const bubble =
    tone === "accent"
      ? "bg-primary text-white"
      : tone === "ai"
        ? "bg-pastel-orange text-ink"
        : "bg-white text-ink border border-border";
  return (
    <div className={cn("flex", align === "right" ? "justify-end" : "justify-start")}>
      <div className={cn("max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed", bubble)}>
        {children}
      </div>
    </div>
  );
}

export function ChatInput({
  value,
  onChange,
  onSubmit,
  placeholder = "Type a message...",
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <form
      className="flex items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <label htmlFor="chat-input" className="sr-only">
        Message
      </label>
      <input
        id="chat-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="min-h-11 flex-1 rounded-[14px] border border-border bg-surface px-4 text-sm outline-none placeholder:text-muted focus:border-primary"
      />
      <button
        type="submit"
        aria-label="Send"
        disabled={disabled}
        className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-white hover:bg-primary-hover disabled:opacity-50"
      >
        <svg viewBox="0 0 24 24" className="size-4 fill-current" aria-hidden>
          <path d="M3.4 20.6 21 12 3.4 3.4 3 10l12 2-12 2z" />
        </svg>
      </button>
    </form>
  );
}
