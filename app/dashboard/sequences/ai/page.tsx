import { Suspense } from "react"

import { AiSequencePanel } from "@/components/modules/ai-sequence-panel"
import { Skeleton } from "@/components/ui/skeleton"

export default function AiSequencesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-4 p-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      }
    >
      <AiSequencePanel />
    </Suspense>
  )
}
