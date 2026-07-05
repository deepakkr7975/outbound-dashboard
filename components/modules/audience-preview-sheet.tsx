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
import { getLeadsByAudience } from "@/lib/data/leads"
import { formatDate } from "@/lib/format"
import type { Audience } from "@/lib/types"

interface AudiencePreviewSheetProps {
  audience: Audience | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AudiencePreviewSheet({
  audience,
  open,
  onOpenChange,
}: AudiencePreviewSheetProps) {
  if (!audience) return null

  const sampleLeads = getLeadsByAudience(audience.id).slice(0, 3)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 overflow-y-auto p-0 text-sm sm:max-w-xl"
      >
        <SheetHeader className="border-b p-6">
          <SheetTitle className="text-xl">{audience.name}</SheetTitle>
          <SheetDescription className="text-base">
            {audience.description}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-6 p-6">
          <section className="flex flex-col gap-3">
            <h3 className="text-base font-medium">Overview</h3>
            <div className="flex flex-col gap-2.5 rounded-xl border p-4">
              <DetailRow label="Members" value={audience.member_count.toLocaleString()} />
              <DetailRow label="Source file" value={audience.file_name} />
              <DetailRow label="Created" value={formatDate(audience.created_at)} />
              <DetailRow label="Updated" value={formatDate(audience.updated_at)} />
              <div className="flex flex-col gap-1.5">
                <span className="text-sm text-muted-foreground">Tags</span>
                <div className="flex flex-wrap gap-1">
                  {audience.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {sampleLeads.length > 0 && (
            <section className="flex flex-col gap-3">
              <h3 className="text-base font-medium">Sample leads</h3>
              <div className="flex flex-col gap-2 rounded-xl border p-4">
                {sampleLeads.map((lead) => (
                  <div key={lead.id} className="flex justify-between text-sm">
                    <span className="font-medium">{lead.name}</span>
                    <span className="text-muted-foreground">{lead.company}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <PreviewSheetFooter
          links={[
            {
              label: "Open audience",
              href: `/dashboard/audiences/${audience.id}`,
            },
            {
              label: "View all leads",
              href: `/dashboard/leads?audience=${audience.id}`,
            },
          ]}
        />
      </SheetContent>
    </Sheet>
  )
}