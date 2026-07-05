"use client"

import { LinkedStatusBadge } from "@/components/dashboard/status-badge"
import { DetailRow } from "@/components/dashboard/detail-row"
import { PreviewSheetFooter } from "@/components/dashboard/preview-sheet-footer"
import { campaigns } from "@/lib/data/campaigns"
import { formatDate } from "@/lib/format"
import type { SenderEmail } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

interface SenderEmailPreviewSheetProps {
  sender: SenderEmail | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SenderEmailPreviewSheet({
  sender,
  open,
  onOpenChange,
}: SenderEmailPreviewSheetProps) {
  if (!sender) return null

  const linkedNames = sender.linked_campaign_ids
    .map((id) => campaigns.find((c) => c.campaign_id === id)?.name ?? id)
    .join(", ")

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 overflow-y-auto p-0 text-sm sm:max-w-xl"
      >
        <SheetHeader className="border-b p-6">
          <SheetTitle className="text-xl">{sender.email}</SheetTitle>
          <SheetDescription className="text-base">
            {sender.domain} · {sender.domain_name}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-6 p-6">
          <section className="flex flex-col gap-3">
            <h3 className="text-base font-medium">Inbox details</h3>
            <div className="flex flex-col gap-2.5 rounded-xl border p-4">
              <DetailRow
                label="Status"
                value={<LinkedStatusBadge status={sender.linked_status} />}
              />
              <DetailRow
                label="Linked campaigns"
                value={linkedNames || "None"}
              />
              <DetailRow
                label="Signature"
                value={
                  sender.signature ? (
                    <Badge variant="outline">Set</Badge>
                  ) : (
                    "Not set"
                  )
                }
              />
              <DetailRow label="Created" value={formatDate(sender.created_at)} />
            </div>
          </section>

          {sender.signature && (
            <section className="flex flex-col gap-3">
              <h3 className="text-base font-medium">Signature preview</h3>
              <div
                className="rounded-xl border p-4 text-sm"
                dangerouslySetInnerHTML={{ __html: sender.signature }}
              />
            </section>
          )}
        </div>

        <PreviewSheetFooter
          links={[
            {
              label: "View campaigns",
              href: "/dashboard/campaigns",
            },
          ]}
        />
      </SheetContent>
    </Sheet>
  )
}