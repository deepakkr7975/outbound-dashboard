"use client"

import * as React from "react"

import { RichEmailEditor } from "@/components/editor/rich-email-editor"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import type { SequenceStep } from "@/lib/types"

interface SequenceStepEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  step: SequenceStep | null
  hasAb: boolean
  onSave: (step: SequenceStep) => void
}

export function SequenceStepEditDialog({
  open,
  onOpenChange,
  step,
  hasAb,
  onSave,
}: SequenceStepEditDialogProps) {
  const [draft, setDraft] = React.useState<SequenceStep | null>(step)
  const [tab, setTab] = React.useState("a")

  React.useEffect(() => {
    if (step) {
      setDraft({ ...step, variants: { ...step.variants, b: step.variants.b ? { ...step.variants.b } : null } })
      setTab("a")
    }
  }, [step, open])

  if (!draft) return null

  function updateVariantA(field: "title" | "body", value: string) {
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            variants: {
              ...prev.variants,
              a: { ...prev.variants.a, [field]: value },
            },
          }
        : prev
    )
  }

  function updateVariantB(field: "title" | "body", value: string) {
    setDraft((prev) => {
      if (!prev) return prev
      const b = prev.variants.b ?? { title: "", body: "" }
      return {
        ...prev,
        variants: {
          ...prev.variants,
          b: { ...b, [field]: value },
        },
      }
    })
  }

  function handleSave() {
    if (draft) {
      onSave(draft)
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle>Edit email {draft.step_order}</DialogTitle>
          <DialogDescription>
            Compose subject and body. Type <kbd className="rounded border px-1 font-mono text-xs">/</kbd> for headings, variables, images, and more.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {hasAb ? (
            <Tabs value={tab} onValueChange={(v) => v && setTab(v)}>
              <TabsList className="mb-4">
                <TabsTrigger value="a">Variant A</TabsTrigger>
                <TabsTrigger value="b">Variant B</TabsTrigger>
              </TabsList>
              <TabsContent value="a" className="flex flex-col gap-4">
                <VariantFields
                  variant="a"
                  title={draft.variants.a.title}
                  body={draft.variants.a.body}
                  onTitleChange={(v) => updateVariantA("title", v)}
                  onBodyChange={(v) => updateVariantA("body", v)}
                />
              </TabsContent>
              <TabsContent value="b" className="flex flex-col gap-4">
                <VariantFields
                  variant="b"
                  title={draft.variants.b?.title ?? ""}
                  body={draft.variants.b?.body ?? ""}
                  onTitleChange={(v) => updateVariantB("title", v)}
                  onBodyChange={(v) => updateVariantB("body", v)}
                />
              </TabsContent>
            </Tabs>
          ) : (
            <VariantFields
              variant="a"
              title={draft.variants.a.title}
              body={draft.variants.a.body}
              onTitleChange={(v) => updateVariantA("title", v)}
              onBodyChange={(v) => updateVariantA("body", v)}
            />
          )}
        </div>

        <DialogFooter className="border-t px-5 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save step</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function VariantFields({
  variant,
  title,
  body,
  onTitleChange,
  onBodyChange,
}: {
  variant: "a" | "b"
  title: string
  body: string
  onTitleChange: (v: string) => void
  onBodyChange: (v: string) => void
}) {
  return (
    <>
      <div className="grid gap-1.5">
        <div className="flex items-center gap-2">
          <Badge variant={variant === "a" ? "outline" : "secondary"}>
            {variant.toUpperCase()}
          </Badge>
          <Label htmlFor={`subject-${variant}`}>Subject line</Label>
        </div>
        <Input
          id={`subject-${variant}`}
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Quick question, {first_name}"
        />
      </div>
      <div className="grid gap-1.5">
        <Label>Email body</Label>
        <RichEmailEditor value={body} onChange={onBodyChange} minHeight={280} />
      </div>
    </>
  )
}