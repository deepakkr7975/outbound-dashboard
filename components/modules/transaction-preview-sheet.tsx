"use client"

import { TransactionStatusBadge } from "@/components/dashboard/status-badge"
import { DetailRow } from "@/components/dashboard/detail-row"
import { PreviewSheetFooter } from "@/components/dashboard/preview-sheet-footer"
import { audiences } from "@/lib/data/audiences"
import { campaigns } from "@/lib/data/campaigns"
import { getLeadById } from "@/lib/data/leads"
import { sequences } from "@/lib/data/sequences"
import { senderEmails } from "@/lib/data/sender-emails"
import { formatDateTime } from "@/lib/format"
import type { EmailTransaction } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

interface TransactionPreviewSheetProps {
  transaction: EmailTransaction | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TransactionPreviewSheet({
  transaction,
  open,
  onOpenChange,
}: TransactionPreviewSheetProps) {
  if (!transaction) return null

  const lead = getLeadById(transaction.lead_id)
  const leadEmail = transaction.SK.split("#")[1]
  const campaign = campaigns.find((c) => c.campaign_id === transaction.campaign_id)
  const sequence = sequences.find((s) => s.sequence_id === transaction.sequence_id)
  const audience = audiences.find((a) => a.id === transaction.audience_id)
  const sender = senderEmails.find((s) => s.id === transaction.sender_email_id)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 overflow-y-auto p-0 text-sm sm:max-w-xl"
      >
        <SheetHeader className="border-b p-6">
          <SheetTitle className="text-xl">{transaction.subject_line}</SheetTitle>
          <SheetDescription className="text-base">
            To {lead?.name ?? leadEmail}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-6 p-6">
          <section className="flex flex-col gap-3">
            <h3 className="text-base font-medium">Send details</h3>
            <div className="flex flex-col gap-2.5 rounded-xl border p-4">
              <DetailRow
                label="Status"
                value={<TransactionStatusBadge status={transaction.status} />}
              />
              <DetailRow label="Campaign" value={campaign?.name ?? "—"} />
              <DetailRow label="Sequence" value={sequence?.name ?? "—"} />
              <DetailRow label="Step" value={transaction.step_order} />
              <DetailRow
                label="Variant"
                value={<Badge variant="outline">{transaction.variant}</Badge>}
              />
              <DetailRow label="Sender" value={sender?.email ?? "—"} />
              <DetailRow label="Audience" value={audience?.name ?? "—"} />
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <h3 className="text-base font-medium">Timestamps</h3>
            <div className="flex flex-col gap-2.5 rounded-xl border p-4">
              <DetailRow
                label="Sent"
                value={
                  transaction.sent_at
                    ? formatDateTime(transaction.sent_at)
                    : "—"
                }
              />
              <DetailRow
                label="Opened"
                value={
                  transaction.opened_at
                    ? formatDateTime(transaction.opened_at)
                    : "—"
                }
              />
              <DetailRow
                label="Clicked"
                value={
                  transaction.clicked_at
                    ? formatDateTime(transaction.clicked_at)
                    : "—"
                }
              />
              <DetailRow
                label="Replied"
                value={
                  transaction.replied_at
                    ? formatDateTime(transaction.replied_at)
                    : "—"
                }
              />
              <DetailRow label="Opens" value={transaction.open_count} />
              <DetailRow label="Clicks" value={transaction.click_count} />
            </div>
          </section>
        </div>

        <PreviewSheetFooter
          links={[
            ...(lead
              ? [
                  {
                    label: "View lead",
                    href: `/dashboard/leads/${lead.id}`,
                  },
                ]
              : []),
            {
              label: "Campaign analytics",
              href: `/dashboard/analytics?campaign=${transaction.campaign_id}`,
            },
          ]}
        />
      </SheetContent>
    </Sheet>
  )
}