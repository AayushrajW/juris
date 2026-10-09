"use client";

import { cn } from "@/lib/cn";
import { Square, Volume2 } from "lucide-react";
import { useLocale, useTranslations } from "use-intl";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const SPEECH_LANG = { mr: "mr-IN", hi: "hi-IN", en: "en-IN" } as const;

// Older phone browsers have speech but cannot report when their voices load,
// so every call here is guarded.
function subscribeToVoices(onChange: () => void) {
  const synth = typeof window === "undefined" ? undefined : window.speechSynthesis;
  synth?.addEventListener?.("voiceschanged", onChange);
  return () => synth?.removeEventListener?.("voiceschanged", onChange);
}

/** Whether this phone has a voice for the language. Phones load voices late, so this can change. */
function useHasVoice(lang: string) {
  return useSyncExternalStore(
    subscribeToVoices,
    () =>
      "speechSynthesis" in window &&
      window.speechSynthesis
        .getVoices()
        .some((voice) => voice.lang.replace("_", "-").toLowerCase().startsWith(lang.slice(0, 2))),
    () => false,
  );
}

/**
 * Reads text aloud with the phone's own voice, for people who find reading
 * hard. Hidden when the phone has no voice for the language.
 */
export function ListenButton({ text, className }: { text: string; className?: string }) {
  const t = useTranslations("common");
  const locale = useLocale();
  const lang = SPEECH_LANG[locale];
  const hasVoice = useHasVoice(lang);
  const [speaking, setSpeaking] = useState(false);
  const speakingRef = useRef(false);

  function setSpeakingState(value: boolean) {
    speakingRef.current = value;
    setSpeaking(value);
  }

  // Stop talking when the person leaves the screen, but only if this button started it.
  useEffect(
    () => () => {
      if (speakingRef.current) window.speechSynthesis?.cancel();
    },
    [],
  );

  if (!hasVoice) return null;

  function toggle() {
    const synth = window.speechSynthesis;
    if (speaking) {
      synth.cancel();
      setSpeakingState(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 0.9;
    utterance.onend = () => setSpeakingState(false);
    utterance.onerror = () => setSpeakingState(false);
    synth.cancel();
    synth.speak(utterance);
    setSpeakingState(true);
  }

  const Icon = speaking ? Square : Volume2;
  return (
    <button
      type="button"
      onClick={toggle}
      className={cn(
        "inline-flex min-h-11 items-center gap-2 rounded-xl border border-primary/30 bg-surface px-4 text-[15px] font-semibold text-primary hover:bg-pastel-blue",
        className,
      )}
    >
      <Icon className="size-5" strokeWidth={1.75} aria-hidden />
      {speaking ? t("stop") : t("listen")}
    </button>
  );
}
