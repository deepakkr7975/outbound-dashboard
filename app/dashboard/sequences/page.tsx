import { Suspense } from "react"

import { SequencesPanel } from "@/components/modules/sequences-panel"
import { Skeleton } from "@/components/ui/skeleton"

export default function SequencesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-4 p-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      }
    >
      <SequencesPanel />
    </Suspense>
  )
}