"use client";

import "./globals.css";

// Replaces the root layout when it fails, so it carries its own page shell and
// stylesheet and cannot rely on the app's providers or language files. With no
// way to know the reader's language here, it says the same thing in all three.
const LINES = [
  { lang: "mr", title: "काहीतरी चुकले", body: "ॲप उघडता आले नाही. कृपया पुन्हा प्रयत्न करा.", retry: "पुन्हा प्रयत्न करा" },
  { lang: "hi", title: "कुछ गड़बड़ हो गई", body: "ऐप नहीं खुल सका। कृपया फिर से कोशिश करें।", retry: "फिर से कोशिश करें" },
  { lang: "en", title: "Something went wrong", body: "The app could not open. Please try again.", retry: "Try again" },
] as const;

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="mr">
      <body className="min-h-screen bg-white font-sans text-[#10233d] antialiased">
        <main className="mx-auto max-w-lg space-y-8 px-4 py-16 text-center">
          {LINES.map((line) => (
            <section key={line.lang} lang={line.lang}>
              <h1 className="text-[24px] font-semibold">{line.title}</h1>
              <p className="mt-2 text-[17px]">{line.body}</p>
              <button
                type="button"
                onClick={reset}
                className="mt-4 inline-flex min-h-14 items-center rounded-xl bg-[#0f2747] px-6 text-[17px] font-semibold text-white"
              >
                {line.retry}
              </button>
            </section>
          ))}
        </main>
      </body>
    </html>
  );
}
