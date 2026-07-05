"use client"

import * as React from "react"

import { GmailPreviewDialog } from "@/components/modules/gmail-preview-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { stripHtmlToPreview } from "@/lib/editor-utils"
import { cn } from "@/lib/utils"
import type { Sequence, SequenceStep } from "@/lib/types"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Clock01Icon,
  Edit01Icon,
  Mail01Icon,
  GoogleIcon,
} from "@hugeicons/core-free-icons"

function WaitPeriodControl({
  waitDays,
  editable,
  onChange,
}: {
  waitDays: number
  editable?: boolean
  onChange?: (days: number) => void
}) {
  if (!editable && waitDays <= 0) return null

  return (
    <div className="mb-3 flex justify-center">
      <div
        className={cn(
          "flex items-center gap-2.5 rounded-full border bg-muted/40 px-5 py-2",
          editable && "bg-card shadow-sm"
        )}
      >
        <HugeiconsIcon
          icon={Clock01Icon}
          strokeWidth={2}
          className="size-5 shrink-0 text-muted-foreground"
        />
        {editable ? (
          <>
            <span className="text-sm text-muted-foreground">Wait</span>
            <Input
              type="number"
              min={0}
              max={90}
              value={waitDays}
              onChange={(e) =>
                onChange?.(Math.max(0, Number(e.target.value) || 0))
              }
              onClick={(e) => e.stopPropagation()}
              className="h-8 w-14 border-0 bg-muted/60 px-1.5 text-center text-sm font-medium tabular-nums shadow-none focus-visible:ring-1"
              aria-label="Wait days before this email"
            />
            <span className="text-sm text-muted-foreground">
              day{waitDays === 1 ? "" : "s"}
            </span>
          </>
        ) : (
          <span className="text-sm font-medium text-muted-foreground">
            Wait {waitDays} day{waitDays === 1 ? "" : "s"}
          </span>
        )}
      </div>
    </div>
  )
}

function StepCard({
  step,
  hasAb,
  isLast,
  editable,
  gmailPreviewPopup,
  onEdit,
  onWaitChange,
}: {
  step: SequenceStep
  hasAb: boolean
  isLast: boolean
  editable?: boolean
  gmailPreviewPopup?: boolean
  onEdit?: () => void
  onWaitChange?: (days: number) => void
}) {
  const [gmailOpen, setGmailOpen] = React.useState(false)
  const showVariantB = hasAb && step.variants.b

  return (
    <div className="relative flex gap-4 pb-8 last:pb-0">
      {!isLast && (
        <div
          className="absolute top-10 left-[15px] h-[calc(100%-2.5rem)] w-px bg-border"
          aria-hidden
        />
      )}

      <div className="relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-primary bg-background shadow-sm">
        <span className="text-xs font-semibold text-primary">
          {step.step_order}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        {step.step_order > 1 && (
          <WaitPeriodControl
            waitDays={step.wait_days}
            editable={editable}
            onChange={onWaitChange}
          />
        )}

        {gmailPreviewPopup && (
          <div className="mb-1.5 flex justify-end">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="size-7 text-muted-foreground hover:text-foreground"
                    onClick={() => setGmailOpen(true)}
                  />
                }
              >
                <HugeiconsIcon icon={GoogleIcon} strokeWidth={2} className="size-4" />
                <span className="sr-only">Gmail preview</span>
              </TooltipTrigger>
              <TooltipContent>Gmail preview</TooltipContent>
            </Tooltip>
          </div>
        )}

        <div
          className={cn(
            "rounded-xl border bg-card transition-shadow",
            editable && "hover:border-primary/30"
          )}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <HugeiconsIcon
                icon={Mail01Icon}
                strokeWidth={2}
                className="size-5 text-primary"
              />
              <span className="text-base font-semibold text-foreground">
                Email {step.step_order}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {showVariantB && (
                <Badge variant="secondary">A/B test</Badge>
              )}
              {editable && onEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1"
                  onClick={onEdit}
                >
                  <HugeiconsIcon icon={Edit01Icon} strokeWidth={2} className="size-3.5" />
                  Edit
                </Button>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3 p-4">
            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="mb-1 flex items-center gap-1.5">
                <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                  A
                </Badge>
                <span className="text-xs font-medium text-muted-foreground">
                  Subject
                </span>
              </div>
              <p className="text-sm font-medium">{step.variants.a.title}</p>
              <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
                {stripHtmlToPreview(step.variants.a.body)}
              </p>
            </div>

            {showVariantB && step.variants.b && (
              <div className="rounded-lg border border-dashed bg-muted/20 p-3">
                <div className="mb-1 flex items-center gap-1.5">
                  <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                    B
                  </Badge>
                  <span className="text-xs font-medium text-muted-foreground">
                    Subject
                  </span>
                </div>
                <p className="text-sm font-medium">{step.variants.b.title}</p>
                <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
                  {stripHtmlToPreview(step.variants.b.body)}
                </p>
              </div>
            )}
          </div>
        </div>

        {gmailPreviewPopup && (
          <GmailPreviewDialog
            open={gmailOpen}
            onOpenChange={setGmailOpen}
            step={step}
            hasAb={hasAb}
          />
        )}
      </div>
    </div>
  )
}

export function SequenceTimeline({
  sequence,
  editable = false,
  gmailPreviewPopup = false,
  onEditStep,
  onWaitChange,
}: {
  sequence: Sequence
  editable?: boolean
  gmailPreviewPopup?: boolean
  onEditStep?: (index: number) => void
  onWaitChange?: (index: number, waitDays: number) => void
}) {
  return (
    <div className="flex flex-col">
      {sequence.steps.map((step, index) => (
        <StepCard
          key={step.step_order}
          step={step}
          hasAb={sequence.has_ab_testing}
          isLast={index === sequence.steps.length - 1}
          editable={editable}
          gmailPreviewPopup={gmailPreviewPopup}
          onEdit={
            editable && onEditStep ? () => onEditStep(index) : undefined
          }
          onWaitChange={
            editable && onWaitChange
              ? (days) => onWaitChange(index, days)
              : undefined
          }
        />
      ))}
    </div>
  )
}

export function SequenceStatsSidebar({ sequence }: { sequence: Sequence }) {
  const stepStats = Object.entries(sequence.sequence_steps)

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border bg-card p-4">
        <h4 className="mb-3 text-sm font-medium text-muted-foreground">
          Overview
        </h4>
        <dl className="grid gap-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Total steps</dt>
            <dd className="font-medium tabular-nums">{sequence.total_steps}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Completions</dt>
            <dd className="font-medium tabular-nums">
              {sequence.sequence_completion}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">A/B testing</dt>
            <dd>
              {sequence.has_ab_testing ? (
                <Badge variant="secondary">On</Badge>
              ) : (
                <span className="text-muted-foreground">Off</span>
              )}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Status</dt>
            <dd className="flex gap-1">
              {sequence.is_scheduled && (
                <Badge variant="outline" className="text-blue-400">
                  Scheduled
                </Badge>
              )}
              {sequence.is_completed && (
                <Badge variant="outline" className="text-emerald-400">
                  Completed
                </Badge>
              )}
              {!sequence.is_scheduled && !sequence.is_completed && (
                <span className="text-muted-foreground">Draft</span>
              )}
            </dd>
          </div>
        </dl>
      </div>

      {stepStats.length > 0 && (
        <div className="rounded-xl border bg-card p-4">
          <h4 className="mb-3 text-sm font-medium text-muted-foreground">
            Step performance
          </h4>
          <div className="flex flex-col gap-2">
            {stepStats.map(([label, count]) => (
              <div key={label} className="flex items-center justify-between text-sm">
                <span className="text-base font-semibold text-foreground">
                  {label.replace(/^email /i, "Email ")}
                </span>
                <span className="text-base font-semibold tabular-nums text-foreground">
                  {count.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}