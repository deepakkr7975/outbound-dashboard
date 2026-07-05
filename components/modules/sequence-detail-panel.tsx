"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { ExportButton } from "@/components/dashboard/export-button"
import { SequenceStatsSidebar, SequenceTimeline } from "@/components/modules/sequence-timeline"
import { useExports } from "@/hooks/use-exports"
import { buildSequenceDetailExport } from "@/lib/exports/builders"
import { getSequenceById } from "@/lib/data/sequences"
import { campaigns } from "@/lib/data/campaigns"
import { formatDate } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowLeft01Icon,
  Edit01Icon,
  LeftToRightListBulletIcon,
} from "@hugeicons/core-free-icons"

export function SequenceDetailPanel({ sequenceId }: { sequenceId: string }) {
  const router = useRouter()
  const { addExport } = useExports()
  const sequence = getSequenceById(sequenceId)

  if (!sequence) {
    return (
      <div className="flex flex-col items-center gap-4 py-16">
        <p className="text-muted-foreground">Sequence not found</p>
        <Button render={<Link href="/dashboard/sequences" />}>
          Back to Sequences
        </Button>
      </div>
    )
  }

  const linkedCampaigns = campaigns.filter(
    (c) => c.sequence_id === sequence.sequence_id
  )

  function handleExport() {
    const report = buildSequenceDetailExport(sequenceId)
    if (!report) return
    addExport(report)
    toast.success("Sequence report saved to Export", {
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
          render={<Link href="/dashboard/sequences" />}
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
          Back to Sequences
        </Button>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl border bg-muted/50">
              <HugeiconsIcon
                icon={LeftToRightListBulletIcon}
                strokeWidth={2}
                className="size-6 text-muted-foreground"
              />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-semibold tracking-tight">
                  {sequence.name}
                </h2>
                {sequence.has_ab_testing && (
                  <Badge variant="secondary">A/B</Badge>
                )}
              </div>
              <p className="mt-1 max-w-2xl text-base text-muted-foreground">
                {sequence.description}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Updated {formatDate(sequence.updated_at)}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <ExportButton onClick={handleExport} />
            <Button
              render={
                <Link href={`/dashboard/sequences/${sequence.sequence_id}/edit`} />
              }
            >
              <HugeiconsIcon icon={Edit01Icon} strokeWidth={2} />
              Edit sequence
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 px-4 lg:grid-cols-[1fr_280px] lg:px-6">
        <div>
          <h3 className="mb-4 text-lg font-medium">Email timeline</h3>
          <SequenceTimeline sequence={sequence} gmailPreviewPopup />
        </div>
        <div className="flex flex-col gap-4">
          <SequenceStatsSidebar sequence={sequence} />

          {linkedCampaigns.length > 0 && (
            <div className="rounded-xl border bg-card p-4">
              <h4 className="mb-3 text-sm font-medium text-muted-foreground">
                Linked campaigns
              </h4>
              <div className="flex flex-col gap-2">
                {linkedCampaigns.map((campaign) => (
                  <Button
                    key={campaign.campaign_id}
                    variant="outline"
                    size="sm"
                    className="h-auto justify-start py-2"
                    render={
                      <Link
                        href={`/dashboard/campaigns/${campaign.campaign_id}`}
                      />
                    }
                  >
                    {campaign.name}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}