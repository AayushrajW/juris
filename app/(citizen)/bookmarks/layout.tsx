import { env } from "@/lib/env";
import { notFound } from "next/navigation";

// Advocate screens are switched off (see lib/env.ts). The proxy already turns
// these addresses away; this makes sure the screens cannot be reached another way.
export default function AdvocateFeatureLayout({ children }: { children: React.ReactNode }) {
  if (!env.advocatesEnabled) notFound();
  return children;
}
