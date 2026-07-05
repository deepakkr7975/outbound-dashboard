"use client"

import { CampaignStatusBadge } from "@/components/dashboard/status-badge"
import { DetailRow } from "@/components/dashboard/detail-row"
import { PreviewSheetFooter } from "@/components/dashboard/preview-sheet-footer"
import { audiences } from "@/lib/data/audiences"
import { sequences } from "@/lib/data/sequences"
import { senderEmails } from "@/lib/data/sender-emails"
import { getTransactionsByCampaign } from "@/lib/data/transactions"
import { formatDate } from "@/lib/format"
import type { Campaign } from "@/lib/types"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

interface CampaignPreviewSheetProps {
  campaign: Campaign | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CampaignPreviewSheet({
  campaign,
  open,
  onOpenChange,
}: CampaignPreviewSheetProps) {
  if (!campaign) return null

  const audience = audiences.find((a) => a.id === campaign.audience_id)
  const sequence = sequences.find((s) => s.sequence_id === campaign.sequence_id)
  const senders = campaign.sender_email_ids
    .map((id) => senderEmails.find((s) => s.id === id)?.email ?? id)
    .join(", ")
  const txns = getTransactionsByCampaign(campaign.campaign_id)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 overflow-y-auto p-0 text-sm sm:max-w-xl"
      >
        <SheetHeader className="border-b p-6">
          <div className="flex items-center gap-2">
            <SheetTitle className="text-xl">{campaign.name}</SheetTitle>
            <CampaignStatusBadge status={campaign.status} />
          </div>
          <SheetDescription className="text-base">
            {campaign.description}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-6 p-6">
          <section className="flex flex-col gap-3">
            <h3 className="text-base font-medium">Composition</h3>
            <div className="flex flex-col gap-2.5 rounded-xl border p-4">
              <DetailRow label="Audience" value={audience?.name ?? "—"} />
              <DetailRow label="Sequence" value={sequence?.name ?? "—"} />
              <DetailRow label="Senders" value={senders} />
              <DetailRow
                label="Schedule"
                value={`${formatDate(campaign.schedule.date)} ${campaign.schedule.time} (${campaign.schedule.timezone})`}
              />
              <DetailRow
                label="Progress"
                value={`${campaign.sent_count} / ${campaign.total_count} sent`}
              />
              <DetailRow label="Transactions" value={txns.length} />
            </div>
          </section>
        </div>

        <PreviewSheetFooter
          links={[
            {
              label: "Open campaign",
              href: `/dashboard/campaigns/${campaign.campaign_id}`,
            },
            {
              label: "View analytics",
              href: `/dashboard/analytics?campaign=${campaign.campaign_id}`,
            },
            {
              label: "View audience leads",
              href: `/dashboard/leads?audience=${campaign.audience_id}&campaign=${campaign.campaign_id}`,
            },
          ]}
        />
      </SheetContent>
    </Sheet>
  )
}