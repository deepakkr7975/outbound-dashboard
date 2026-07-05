import { Suspense } from "react"

import { AudiencesPanel } from "@/components/modules/audiences-panel"
import { Skeleton } from "@/components/ui/skeleton"

export default function AudiencesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-4 p-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      }
    >
      <AudiencesPanel />
    </Suspense>
  )
}