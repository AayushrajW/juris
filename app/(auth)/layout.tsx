import { BrandMark } from "@/components/brand/Logo";
import { APP_NAME } from "@/lib/constants";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="px-4 py-4">
        <BrandMark href="/" />
      </header>
      <main id="main" className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">{children}</div>
      </main>
      <p className="px-4 py-3 text-center text-[11px] text-muted">
        {APP_NAME} explains and organises information. It is not a lawyer and does not give legal advice.
      </p>
    </div>
  );
}
