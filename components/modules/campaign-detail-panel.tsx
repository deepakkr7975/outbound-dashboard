"use client"

import Link from "next/link"

import { CampaignStatusBadge } from "@/components/dashboard/status-badge"
import { DetailRow } from "@/components/dashboard/detail-row"
import { useLiveData } from "@/hooks/use-live-data"
import { audiences } from "@/lib/data/audiences"
import { getCampaignById } from "@/lib/data/campaigns"
import { sequences } from "@/lib/data/sequences"
import { senderEmails } from "@/lib/data/sender-emails"
import { getTransactionsByCampaign } from "@/lib/data/transactions"
import { formatDate } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowLeft01Icon,
  Calendar01Icon,
  Megaphone01Icon,
} from "@hugeicons/core-free-icons"

export function CampaignDetailPanel({ campaignId }: { campaignId: string }) {
  const { ready } = useLiveData()
  const campaign = getCampaignById(campaignId)

  if (!campaign) {
    if (!ready) {
      return (
        <div className="flex flex-col items-center gap-4 py-16">
          <p className="text-muted-foreground">Loading…</p>
        </div>
      )
    }
    return (
      <div className="flex flex-col items-center gap-4 py-16">
        <p className="text-muted-foreground">Campaign not found</p>
        <Button render={<Link href="/dashboard/campaigns" />}>
          Back to Campaigns
        </Button>
      </div>
    )
  }

  const audience = audiences.find((a) => a.id === campaign.audience_id)
  const sequence = sequences.find((s) => s.sequence_id === campaign.sequence_id)
  const senders = campaign.sender_email_ids
    .map((id) => senderEmails.find((s) => s.id === id))
    .filter(Boolean)
  const txns = getTransactionsByCampaign(campaign.campaign_id)
  const progress =
    campaign.total_count > 0
      ? Math.round((campaign.sent_count / campaign.total_count) * 100)
      : 0

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="flex flex-col gap-4 px-4 lg:px-6">
        <Button
          variant="ghost"
          size="sm"
          className="w-fit"
          render={<Link href="/dashboard/campaigns" />}
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
          Back to Campaigns
        </Button>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl border bg-muted/50">
              <HugeiconsIcon
                icon={Megaphone01Icon}
                strokeWidth={2}
                className="size-6 text-muted-foreground"
              />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-semibold tracking-tight">
                  {campaign.name}
                </h2>
                <CampaignStatusBadge status={campaign.status} />
              </div>
              <p className="mt-1 max-w-2xl text-base text-muted-foreground">
                {campaign.description}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              render={
                <Link
                  href={`/dashboard/analytics?campaign=${campaign.campaign_id}`}
                />
              }
            >
              View analytics
            </Button>
            <Button
              variant="outline"
              render={
                <Link
                  href={`/dashboard/leads?audience=${campaign.audience_id}&campaign=${campaign.campaign_id}`}
                />
              }
            >
              View leads
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 px-4 lg:grid-cols-3 lg:px-6">
        <Card className="dark:bg-card">
          <CardHeader>
            <CardTitle className="text-lg">Send Progress</CardTitle>
            <CardDescription>
              {campaign.sent_count} of {campaign.total_count} emails sent
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-end justify-between">
              <span className="text-4xl font-semibold tabular-nums">
                {progress}%
              </span>
              <span className="text-sm text-muted-foreground">
                {txns.length} transactions
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="dark:bg-card lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <HugeiconsIcon
                icon={Calendar01Icon}
                strokeWidth={2}
                className="size-5"
              />
              Schedule
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2.5">
            <DetailRow
              label="Date & time"
              value={`${formatDate(campaign.schedule.date)} ${campaign.schedule.time}`}
            />
            <DetailRow label="Timezone" value={campaign.schedule.timezone} />
            <DetailRow
              label="Scheduled"
              value={campaign.is_scheduled ? "Yes" : "No"}
            />
            <DetailRow
              label="Completed"
              value={campaign.is_completed ? "Yes" : "No"}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 px-4 lg:grid-cols-2 lg:px-6">
        <Card className="dark:bg-card">
          <CardHeader>
            <CardTitle className="text-lg">Audience</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <DetailRow label="Name" value={audience?.name ?? "—"} />
            <DetailRow
              label="Members"
              value={audience?.member_count.toLocaleString() ?? "—"}
            />
            {audience && (
              <Button
                variant="outline"
                size="sm"
                className="w-fit"
                render={
                  <Link href={`/dashboard/audiences/${audience.id}`} />
                }
              >
                Open audience
              </Button>
            )}
          </CardContent>
        </Card>

        <Card className="dark:bg-card">
          <CardHeader>
            <CardTitle className="text-lg">Sequence</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <DetailRow label="Name" value={sequence?.name ?? "—"} />
            <DetailRow
              label="Steps"
              value={sequence?.total_steps ?? "—"}
            />
            {sequence?.has_ab_testing && (
              <Badge variant="secondary" className="w-fit">
                A/B testing enabled
              </Badge>
            )}
            {sequence && (
              <Button
                variant="outline"
                size="sm"
                className="w-fit"
                render={
                  <Link
                    href={`/dashboard/sequences/${sequence.sequence_id}`}
                  />
                }
              >
                View sequence
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="px-4 lg:px-6">
        <h3 className="mb-3 text-lg font-medium">Sender Emails</h3>
        <div className="flex flex-wrap gap-2">
          {senders.map((sender) =>
            sender ? (
              <Button
                key={sender.id}
                variant="outline"
                size="sm"
                render={
                  <Link href={`/dashboard/sender-emails?preview=${sender.id}`} />
                }
              >
                {sender.email}
              </Button>
            ) : null
          )}
        </div>
      </div>
    </div>
  )
}