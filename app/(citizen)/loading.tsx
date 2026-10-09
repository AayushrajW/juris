import { AppPage } from "@/components/ui/AppKit";
import { Skeleton } from "@/components/ui/Display";

export default function Loading() {
  return (
    <AppPage>
      <p className="sr-only" role="status">
        Loading
      </p>
      <Skeleton className="h-10 w-48" />
      <Skeleton className="mt-4 h-28 w-full" />
      <Skeleton className="mt-3 h-16 w-full" />
    </AppPage>
  );
}
