import { APP_NAME } from "@/lib/constants";
import { FileSearch, ListChecks, MessageCircle, Shield } from "lucide-react";
import Link from "next/link";

export default function LandingPage() {
  return (
    <main id="main">
      <section className="border-b border-border bg-surface">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-2 md:py-20">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-info">
              For people, not law firms
            </p>
            <h1 className="mt-3 text-4xl font-semibold leading-tight tracking-tight text-navy md:text-5xl">
              Understand a legal paper before you panic.
            </h1>
            <p className="mt-4 max-w-xl text-lg text-ink/85">
              {APP_NAME} helps you read notices, contracts, and confusing situations in everyday
              language. You still decide what to do. A qualified advocate still gives legal advice.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/sign-up"
                className="inline-flex min-h-12 items-center rounded-[10px] bg-primary px-5 font-semibold text-white hover:bg-primary-hover"
              >
                Start with a demo case
              </Link>
              <Link
                href="/sign-in"
                className="inline-flex min-h-12 items-center rounded-[10px] border border-border px-5 font-semibold text-navy"
              >
                Sign in
              </Link>
            </div>
            <p className="mt-4 text-sm text-demo">
              This prototype uses sample files. It does not file cases or contact courts.
            </p>
          </div>
          <div className="ns-card p-6">
            <p className="text-sm font-semibold text-navy">A typical path</p>
            <ol className="mt-4 space-y-4">
              {[
                "Bring a PDF, photo, or a story in your own words.",
                "See a plain-language explanation, dates, and gaps.",
                "Use a checklist of papers and questions for an advocate.",
                "If you need a person, find free legal aid and official help.",
              ].map((item, i) => (
                <li key={item} className="flex gap-3 text-ink">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-navy text-sm text-white">
                    {i + 1}
                  </span>
                  {item}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-3xl font-semibold text-navy">How it works</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: FileSearch,
              title: "Read the paper",
              body: "Upload a notice or describe what happened. We organise it into short sections.",
            },
            {
              icon: ListChecks,
              title: "See risks and dates",
              body: "Deadlines, duties, and missing information are listed so nothing hides in a paragraph.",
            },
            {
              icon: MessageCircle,
              title: "Ask about this file",
              body: "The assistant stays on your case. Every answer is labelled as a demo in this version.",
            },
            {
              icon: Shield,
              title: "Stay in control",
              body: "No “you will win”. No pretending to be your lawyer. Official help links stay visible.",
            },
          ].map((item) => (
            <article key={item.title} className="rounded-lg border border-border bg-surface p-5">
              <item.icon className="size-6 text-navy" aria-hidden />
              <h3 className="mt-3 font-semibold text-navy">{item.title}</h3>
              <p className="mt-2 text-sm text-ink/80">{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-3xl font-semibold text-navy">Trust, and limits</h2>
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="font-semibold text-navy">What {APP_NAME} is</h3>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-ink/85">
                <li>A reading and organising tool for ordinary citizens in India.</li>
                <li>A place to prepare questions and a paper checklist.</li>
                <li>A pointer to free legal aid when you need a person.</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-navy">What it is not</h3>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-ink/85">
                <li>Not an advocate, law firm, or court filing service.</li>
                <li>Not a guarantee of any outcome.</li>
                <li>Not live legal research in this prototype — sample analyses are labelled Demo.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-3xl font-semibold text-navy">Made for first-time users</h2>
        <p className="mt-3 max-w-2xl text-ink/85">
          Large buttons, short sentences, and details hidden until you ask. Works on a phone,
          because that is how most people will open a notice.
        </p>
        <Link
          href="/sign-up"
          className="mt-8 inline-flex min-h-12 items-center rounded-md bg-navy px-5 font-medium text-white"
        >
          Open the citizen demo
        </Link>
      </section>
    </main>
  );
}
