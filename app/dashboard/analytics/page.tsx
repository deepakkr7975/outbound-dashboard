import { Suspense } from "react"

import { AnalyticsPanel } from "@/components/modules/analytics-panel"
import { Skeleton } from "@/components/ui/skeleton"

export default function AnalyticsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-4 p-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      }
    >
      <AnalyticsPanel />
    </Suspense>
  )
}