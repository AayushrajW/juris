"use client";

import { Button } from "@/components/ui/Button";
import Link from "next/link";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="main" className="mx-auto max-w-lg px-4 py-20 text-center">
      <h1 className="text-[26px] font-semibold text-navy">Something went wrong</h1>
      <p className="mt-3 text-[16px] text-muted">
        This screen could not open. Your papers are not affected. Please try again.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button size="lg" onClick={reset}>
          Try again
        </Button>
        <Link
          href="/dashboard"
          className="inline-flex min-h-14 items-center rounded-xl border border-border bg-surface px-6 font-semibold text-navy"
        >
          Go to Home
        </Link>
      </div>
    </main>
  );
}
