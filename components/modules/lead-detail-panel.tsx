"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { DetailRow } from "@/components/dashboard/detail-row"
import { ExportButton } from "@/components/dashboard/export-button"
import { TransactionStatusBadge } from "@/components/dashboard/status-badge"
import { audiences } from "@/lib/data/audiences"
import { campaigns } from "@/lib/data/campaigns"
import { useExports } from "@/hooks/use-exports"
import { useLiveData } from "@/hooks/use-live-data"
import { buildLeadDetailExport } from "@/lib/exports/builders"
import { getLeadById, getLeadTransactions } from "@/lib/data/leads"
import { formatDate, formatDateTime } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowLeft01Icon,
  Contact01Icon,
  Mail01Icon,
} from "@hugeicons/core-free-icons"

export function LeadDetailPanel({ leadId }: { leadId: string }) {
  const router = useRouter()
  const { addExport } = useExports()
  const { ready } = useLiveData()
  const lead = getLeadById(leadId)

  if (!lead) {
    if (!ready) {
      return (
        <div className="flex flex-col items-center gap-4 py-16">
          <p className="text-muted-foreground">Loading…</p>
        </div>
      )
    }
    return (
      <div className="flex flex-col items-center gap-4 py-16">
        <p className="text-muted-foreground">Lead not found</p>
        <Button render={<Link href="/dashboard/leads" />}>
          Back to Leads
        </Button>
      </div>
    )
  }

  const audience = audiences.find((a) => a.id === lead.audience_id)
  const leadTxns = getLeadTransactions(lead.id)
  const campaignIds = Array.from(new Set(leadTxns.map((t) => t.campaign_id)))

  const lastContact = leadTxns
    .filter((t) => t.sent_at)
    .sort((a, b) => (b.sent_at ?? "").localeCompare(a.sent_at ?? ""))[0]

  function handleExport() {
    const report = buildLeadDetailExport(leadId)
    if (!report) return
    addExport(report)
    toast.success("Lead report saved to Export", {
      action: {
        label: "View",
        onClick: () => router.push("/dashboard/export"),
      },
    })
  }

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="flex flex-col gap-4 px-4 lg:px-6">
        <Button
          variant="ghost"
          size="sm"
          className="w-fit"
          render={<Link href="/dashboard/leads" />}
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
          Back to Leads
        </Button>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl border bg-muted/50">
              <HugeiconsIcon
                icon={Contact01Icon}
                strokeWidth={2}
                className="size-6 text-muted-foreground"
              />
            </div>
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">
                {lead.name}
              </h2>
              <p className="text-base text-muted-foreground">{lead.email}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge variant="outline">{lead.role}</Badge>
                <Badge variant="secondary">{lead.company}</Badge>
                {audience && (
                  <Badge variant="outline">{audience.name}</Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <ExportButton onClick={handleExport} />
            <Button
              variant="outline"
              render={
                <Link href={`/dashboard/audiences/${lead.audience_id}`} />
              }
            >
              View audience
            </Button>
            {campaignIds[0] && (
              <Button
                variant="outline"
                render={
                  <Link
                    href={`/dashboard/analytics?campaign=${campaignIds[0]}`}
                  />
                }
              >
                View analytics
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 px-4 lg:grid-cols-3 lg:px-6">
        <Card className="dark:bg-card lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Contact Info</CardTitle>
            <CardDescription>Profile and audience membership</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2.5">
            <DetailRow label="Role" value={lead.role} />
            <DetailRow label="Company" value={lead.company} />
            <DetailRow label="City" value={lead.city} />
            <DetailRow label="Audience" value={audience?.name ?? "—"} />
            <DetailRow label="Added" value={formatDate(lead.created_at)} />
          </CardContent>
        </Card>

        <Card className="dark:bg-card lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <HugeiconsIcon icon={Mail01Icon} strokeWidth={2} className="size-5" />
              Engagement
            </CardTitle>
            <CardDescription>Outreach history across campaigns</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2.5">
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
              value={
                campaignIds.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {campaignIds.map((id) => {
                      const campaign = campaigns.find(
                        (c) => c.campaign_id === id
                      )
                      return (
                        <Button
                          key={id}
                          variant="outline"
                          size="sm"
                          className="h-7"
                          render={
                            <Link href={`/dashboard/campaigns/${id}`} />
                          }
                        >
                          {campaign?.name ?? id}
                        </Button>
                      )
                    })}
                  </div>
                ) : (
                  "Not contacted yet"
                )
              }
            />
            <DetailRow
              label="Last contacted"
              value={
                lastContact?.sent_at
                  ? formatDateTime(lastContact.sent_at)
                  : "—"
              }
            />
          </CardContent>
        </Card>
      </div>

      {leadTxns.length > 0 && (
        <div className="px-4 lg:px-6">
          <h3 className="mb-3 text-lg font-medium">Email Activity</h3>
          <div className="overflow-hidden rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Step</TableHead>
                  <TableHead>Variant</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leadTxns.map((txn) => (
                  <TableRow key={txn.transaction_id}>
                    <TableCell>
                      <Link
                        href={`/dashboard/campaigns/${txn.campaign_id}`}
                        className="font-medium hover:underline"
                      >
                        {campaigns.find((c) => c.campaign_id === txn.campaign_id)
                          ?.name ?? txn.campaign_id}
                      </Link>
                    </TableCell>
                    <TableCell>{txn.step_order}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{txn.variant}</Badge>
                    </TableCell>
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
        </div>
      )}
    </div>
  )
}