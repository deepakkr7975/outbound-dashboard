"use client"

import { DetailRow } from "@/components/dashboard/detail-row"
import { PreviewSheetFooter } from "@/components/dashboard/preview-sheet-footer"
import { Badge } from "@/components/ui/badge"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { formatDate } from "@/lib/format"
import type { Sequence } from "@/lib/types"

interface SequencePreviewSheetProps {
  sequence: Sequence | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SequencePreviewSheet({
  sequence,
  open,
  onOpenChange,
}: SequencePreviewSheetProps) {
  if (!sequence) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 overflow-y-auto p-0 text-sm sm:max-w-xl"
      >
        <SheetHeader className="border-b p-6">
          <SheetTitle className="text-xl">{sequence.name}</SheetTitle>
          <SheetDescription className="text-base">
            {sequence.description}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-6 p-6">
          <section className="flex flex-col gap-3">
            <h3 className="text-base font-medium">Summary</h3>
            <div className="flex flex-col gap-2.5 rounded-xl border p-4">
              <DetailRow label="Total steps" value={sequence.total_steps} />
              <DetailRow
                label="A/B testing"
                value={
                  sequence.has_ab_testing ? (
                    <Badge variant="secondary">Enabled</Badge>
                  ) : (
                    "Off"
                  )
                }
              />
              <DetailRow label="Completions" value={sequence.sequence_completion} />
              <DetailRow label="Scheduled" value={sequence.is_scheduled ? "Yes" : "No"} />
              <DetailRow label="Completed" value={sequence.is_completed ? "Yes" : "No"} />
              <DetailRow label="Updated" value={formatDate(sequence.updated_at)} />
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <h3 className="text-base font-medium">Steps</h3>
            <div className="flex flex-col gap-3">
              {sequence.steps.map((step) => (
                <div
                  key={step.step_order}
                  className="rounded-xl border p-4"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-medium">Step {step.step_order}</span>
                    {step.wait_days > 0 && (
                      <Badge variant="outline">Wait {step.wait_days}d</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {step.variants.a.title}
                  </p>
                  {step.variants.b && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      B: {step.variants.b.title}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>

        <PreviewSheetFooter
          links={[
            {
              label: "View sequence",
              href: `/dashboard/sequences/${sequence.sequence_id}`,
            },
            {
              label: "Edit sequence",
              href: `/dashboard/sequences/${sequence.sequence_id}/edit`,
            },
          ]}
        />
      </SheetContent>
    </Sheet>
  )
}