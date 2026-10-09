import { BrandMark } from "@/components/brand/Logo";
import { APP_NAME } from "@/lib/constants";
import Link from "next/link";

export function MarketingHeader() {
  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <BrandMark href="/" />
        <nav className="flex items-center gap-2 text-sm font-medium">
          <Link href="/#how-it-works" className="hidden min-h-11 items-center px-3 text-navy sm:inline-flex">
            How it works
          </Link>
          <Link href="/sign-in" className="inline-flex min-h-11 items-center px-3 text-navy">
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="inline-flex min-h-11 items-center rounded-[10px] bg-primary px-4 font-semibold text-white hover:bg-primary-hover"
          >
            Get started
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="border-t border-border bg-navy text-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3">
        <div>
          <p className="text-lg font-semibold">{APP_NAME}</p>
          <p className="mt-2 text-sm text-white/75">Your legal companion. Not a law firm.</p>
        </div>
        <div className="text-sm text-white/80">
          <p className="font-semibold text-white">Official starting points</p>
          <ul className="mt-2 space-y-1">
            <li>
              <a className="underline-offset-2 hover:underline" href="https://nalsa.gov.in/">
                NALSA (legal aid)
              </a>
            </li>
            <li>
              <a className="underline-offset-2 hover:underline" href="https://ecourts.gov.in/">
                eCourts
              </a>
            </li>
          </ul>
        </div>
        <p className="text-sm text-white/70">
          {APP_NAME} explains and organises information. It is not a lawyer and does not give legal
          advice. Demo content in this prototype is fictional.
        </p>
      </div>
    </footer>
  );
}
