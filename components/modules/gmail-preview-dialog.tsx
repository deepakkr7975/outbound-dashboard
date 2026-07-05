"use client"

import { GmailEmailPreview } from "@/components/editor/gmail-email-preview"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { SequenceStep } from "@/lib/types"

interface GmailPreviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  step: SequenceStep | null
  hasAb: boolean
}

export function GmailPreviewDialog({
  open,
  onOpenChange,
  step,
  hasAb,
}: GmailPreviewDialogProps) {
  if (!step) return null

  const showVariantB = hasAb && step.variants.b

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle>Gmail preview — Email {step.step_order}</DialogTitle>
          <DialogDescription>
            Sample personalization applied for preview
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 overflow-y-auto p-5">
          <GmailEmailPreview
            subject={step.variants.a.title}
            body={step.variants.a.body}
            variant="a"
          />
          {showVariantB && step.variants.b && (
            <GmailEmailPreview
              subject={step.variants.b.title}
              body={step.variants.b.body}
              variant="b"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}