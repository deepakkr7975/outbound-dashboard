import { Suspense } from "react"

import { LeadsPanel } from "@/components/modules/leads-panel"
import { Skeleton } from "@/components/ui/skeleton"

export default function LeadsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-4 p-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      }
    >
      <LeadsPanel />
    </Suspense>
  )
}