"use client"

import { DetailRow } from "@/components/dashboard/detail-row"
import { PreviewSheetFooter } from "@/components/dashboard/preview-sheet-footer"
import { TransactionStatusBadge } from "@/components/dashboard/status-badge"
import { audiences } from "@/lib/data/audiences"
import { campaigns } from "@/lib/data/campaigns"
import { getLeadTransactions } from "@/lib/data/leads"
import { formatDate, formatDateTime } from "@/lib/format"
import type { Lead } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface LeadDetailSheetProps {
  lead: Lead | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function LeadDetailSheet({
  lead,
  open,
  onOpenChange,
}: LeadDetailSheetProps) {
  if (!lead) return null

  const audience = audiences.find((a) => a.id === lead.audience_id)
  const leadTxns = getLeadTransactions(lead.id)
  const campaignIds = Array.from(new Set(leadTxns.map((t) => t.campaign_id)))
  const campaignNames = campaignIds
    .map((id) => campaigns.find((c) => c.campaign_id === id)?.name ?? id)
    .join(", ")

  const lastContact = leadTxns
    .filter((t) => t.sent_at)
    .sort((a, b) => (b.sent_at ?? "").localeCompare(a.sent_at ?? ""))[0]

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 overflow-y-auto p-0 text-sm sm:max-w-xl"
      >
        <SheetHeader className="border-b p-6">
          <SheetTitle className="text-xl">{lead.name}</SheetTitle>
          <SheetDescription className="text-base">{lead.email}</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-6 p-6">
          <section className="flex flex-col gap-3">
            <h3 className="text-base font-medium">Contact Info</h3>
            <div className="flex flex-col gap-2.5 rounded-xl border p-4">
              <DetailRow label="Role" value={lead.role} />
              <DetailRow label="Company" value={lead.company} />
              <DetailRow label="City" value={lead.city} />
              <DetailRow label="Audience" value={audience?.name ?? "—"} />
              <DetailRow label="Added" value={formatDate(lead.created_at)} />
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <h3 className="text-base font-medium">Engagement</h3>
            <div className="flex flex-col gap-2.5 rounded-xl border p-4">
              <DetailRow
                label="Emails sent"
                value={
                  <Badge variant="outline">
                    {lead.emails_sent > 0 ? lead.emails_sent : "None"}
                  </Badge>
                }
              />
              <DetailRow
                label="Campaigns"
                value={campaignNames || "Not contacted yet"}
              />
              <DetailRow
                label="Last contacted"
                value={
                  lastContact?.sent_at
                    ? formatDateTime(lastContact.sent_at)
                    : "—"
                }
              />
            </div>
          </section>

          {leadTxns.length > 0 && (
            <section className="flex flex-col gap-3">
              <h3 className="text-base font-medium">Email Activity</h3>
              <div className="overflow-hidden rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campaign</TableHead>
                      <TableHead>Step</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Sent</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leadTxns.map((txn) => (
                      <TableRow key={txn.transaction_id}>
                        <TableCell className="max-w-32 truncate">
                          {campaigns.find((c) => c.campaign_id === txn.campaign_id)
                            ?.name ?? txn.campaign_id}
                        </TableCell>
                        <TableCell>{txn.step_order}</TableCell>
                        <TableCell>
                          <TransactionStatusBadge status={txn.status} />
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {txn.sent_at ? formatDate(txn.sent_at) : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>
          )}
        </div>

        <PreviewSheetFooter
          links={[
            {
              label: "Open lead page",
              href: `/dashboard/leads/${lead.id}`,
            },
            {
              label: "View audience",
              href: `/dashboard/audiences/${lead.audience_id}`,
            },
            ...(campaignIds[0]
              ? [
                  {
                    label: "View analytics",
                    href: `/dashboard/analytics?campaign=${campaignIds[0]}`,
                  },
                ]
              : []),
          ]}
        />
      </SheetContent>
    </Sheet>
  )
}