"use client";

// Replaces the root layout when it fails, so it carries its own page shell and
// cannot rely on the app's styles or providers.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white font-sans text-[#10233d] antialiased">
        <main className="mx-auto max-w-lg px-4 py-20 text-center">
          <h1 className="text-[26px] font-semibold">Something went wrong</h1>
          <p className="mt-3 text-[16px]">The app could not open. Please try again.</p>
          <button
            type="button"
            onClick={reset}
            className="mt-6 inline-flex min-h-14 items-center rounded-xl bg-[#0f2747] px-6 font-semibold text-white"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
