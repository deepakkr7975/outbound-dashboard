"use client"

import * as React from "react"
import Link from "next/link"
import { toast } from "sonner"

import { SequenceStepEditDialog } from "@/components/modules/sequence-step-edit-dialog"
import {
  SequenceStatsSidebar,
  SequenceTimeline,
} from "@/components/modules/sequence-timeline"
import { getSequenceById } from "@/lib/data/sequences"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { Sequence, SequenceStep } from "@/lib/types"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
  ArrowLeft01Icon,
  EyeIcon,
} from "@hugeicons/core-free-icons"

const defaultStep: SequenceStep = {
  step_order: 1,
  wait_days: 0,
  variants: {
    a: { title: "", body: "" },
    b: null,
  },
}

export function SequenceBuilderPanel({
  sequenceId,
}: {
  sequenceId?: string
}) {
  const existing = sequenceId ? getSequenceById(sequenceId) : undefined
  const [name, setName] = React.useState(existing?.name ?? "")
  const [description, setDescription] = React.useState(
    existing?.description ?? ""
  )
  const [hasAb, setHasAb] = React.useState(existing?.has_ab_testing ?? false)
  const [steps, setSteps] = React.useState<SequenceStep[]>(
    existing?.steps ?? [defaultStep]
  )
  const [editIndex, setEditIndex] = React.useState<number | null>(null)
  const [editOpen, setEditOpen] = React.useState(false)

  const previewSequence: Sequence = {
    sequence_id: existing?.sequence_id ?? "new",
    name: name || "Untitled sequence",
    description,
    total_steps: steps.length,
    has_ab_testing: hasAb,
    steps,
    is_scheduled: existing?.is_scheduled ?? false,
    is_completed: existing?.is_completed ?? false,
    sequence_completion: existing?.sequence_completion ?? 0,
    sequence_steps: existing?.sequence_steps ?? {},
    created_at: existing?.created_at ?? new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  function openEditStep(index: number) {
    setEditIndex(index)
    setEditOpen(true)
  }

  function saveStep(updated: SequenceStep) {
    if (editIndex === null) return
    setSteps((prev) =>
      prev.map((s, i) => (i === editIndex ? updated : s))
    )
    toast.success(`Step ${updated.step_order} saved`)
  }

  function updateWaitDays(index: number, waitDays: number) {
    setSteps((prev) =>
      prev.map((s, i) => (i === index ? { ...s, wait_days: waitDays } : s))
    )
  }

  function addStep() {
    const next: SequenceStep = {
      step_order: steps.length + 1,
      wait_days: 3,
      variants: {
        a: { title: "", body: "" },
        b: hasAb ? { title: "", body: "" } : null,
      },
    }
    setSteps((prev) => [...prev, next])
    setEditIndex(steps.length)
    setEditOpen(true)
    toast.success("Step added — compose your email")
  }

  function toggleAb() {
    const next = !hasAb
    setHasAb(next)
    setSteps((prev) =>
      prev.map((s) => ({
        ...s,
        variants: {
          ...s.variants,
          b: next
            ? s.variants.b ?? { title: "", body: s.variants.a.body }
            : null,
        },
      }))
    )
  }

  if (sequenceId && !existing) {
    return (
      <div className="flex flex-col items-center gap-4 py-16">
        <p className="text-muted-foreground">Sequence not found</p>
        <Button render={<Link href="/dashboard/sequences" />}>
          Back to Sequences
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="flex flex-col gap-3 px-4 lg:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-fit"
            render={<Link href="/dashboard/sequences" />}
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
            Sequences
          </Button>
          {existing && (
            <Button
              variant="ghost"
              size="sm"
              className="w-fit"
              render={
                <Link href={`/dashboard/sequences/${existing.sequence_id}`} />
              }
            >
              <HugeiconsIcon icon={EyeIcon} strokeWidth={2} />
              Preview
            </Button>
          )}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-semibold">
            {existing ? "Edit Sequence" : "New Sequence"}
          </h2>
          <Button onClick={() => toast.success("Sequence saved")}>
            Save Sequence
          </Button>
        </div>
      </div>

      <div className="grid gap-6 px-4 lg:grid-cols-[1fr_300px] lg:px-6">
        <div className="flex flex-col gap-6">
          <Card className="dark:bg-card">
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="seq-name">Name</Label>
                <Input
                  id="seq-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Winter Outreach"
                />
              </div>
              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor="seq-desc">Description</Label>
                <Input
                  id="seq-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2 sm:col-span-2">
                <Button
                  variant={hasAb ? "default" : "outline"}
                  size="sm"
                  onClick={toggleAb}
                >
                  A/B Testing {hasAb ? "On" : "Off"}
                </Button>
                <span className="text-sm text-muted-foreground">
                  Split-test subject lines per step
                </span>
              </div>
            </CardContent>
          </Card>

          <div>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium">Email chain</h3>
                <p className="text-sm text-muted-foreground">
                  Set wait days between emails inline · click Edit to compose
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={addStep}>
                <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
                Add step
              </Button>
            </div>
            <SequenceTimeline
              sequence={previewSequence}
              editable
              onEditStep={openEditStep}
              onWaitChange={updateWaitDays}
            />
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <SequenceStatsSidebar sequence={previewSequence} />
          <Card className="dark:bg-card">
            <CardHeader>
              <CardTitle className="text-base">Slash commands</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
              <p>
                In the editor, type <kbd className="rounded border px-1 font-mono text-xs">/</kbd> to insert:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {["Heading", "Subheading", "Variable", "Image", "Bullet list", "Divider"].map((v) => (
                  <Badge key={v} variant="outline" className="text-xs">
                    {v}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <SequenceStepEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        step={editIndex !== null ? steps[editIndex] : null}
        hasAb={hasAb}
        onSave={saveStep}
      />
    </div>
  )
}