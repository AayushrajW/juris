import { titled } from "@/i18n/server";

export const generateMetadata = () => titled((m) => m.auth.signInTitle);

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
