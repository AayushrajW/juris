import { CitizenShell } from "@/components/layout/CitizenShell";

export default function CitizenLayout({ children }: { children: React.ReactNode }) {
  return <CitizenShell>{children}</CitizenShell>;
}
