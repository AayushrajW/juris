import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main" className="mx-auto max-w-lg px-4 py-20 text-center">
      <h1 className="text-[26px] font-semibold text-navy">Page not found</h1>
      <p className="mt-3 text-muted">That link is not part of this prototype.</p>
      <Link
        href="/"
        className="mt-6 inline-flex min-h-11 items-center rounded-[10px] bg-primary px-4 font-semibold text-white"
      >
        Back to home
      </Link>
    </main>
  );
}
