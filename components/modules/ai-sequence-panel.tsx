"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { PageHeader } from "@/components/dashboard/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  createSequence,
  generateAiSequence,
  refineAiSequence,
  type SequenceDraft,
  type SequenceTone,
} from "@/lib/api"
import { refresh } from "@/lib/data/store"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  AiMagicIcon,
  ArrowLeft01Icon,
  FloppyDiskIcon,
  RefreshIcon,
  SparklesIcon,
} from "@hugeicons/core-free-icons"

const TONES: { value: SequenceTone; label: string }[] = [
  { value: "professional", label: "Professional" },
  { value: "casual", label: "Casual" },
  { value: "formal", label: "Formal" },
  { value: "clickbait", label: "Clickbait" },
]

function parseVars(input: string): string[] {
  return input
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean)
}

export function AiSequencePanel() {
  const router = useRouter()

  // ── Brief ──────────────────────────────────────────────────────────────
  const [company, setCompany] = React.useState("")
  const [targetAudience, setTargetAudience] = React.useState("")
  const [offer, setOffer] = React.useState("")
  const [numSteps, setNumSteps] = React.useState(3)
  const [bodyCharLimit, setBodyCharLimit] = React.useState(600)
  const [ctaText, setCtaText] = React.useState("")
  const [ctaUrl, setCtaUrl] = React.useState("")
  const [tone, setTone] = React.useState<SequenceTone>("professional")
  const [includeAb, setIncludeAb] = React.useState(false)
  const [personalization, setPersonalization] = React.useState("name, company")

  // ── Draft + refine ─────────────────────────────────────────────────────
  const [draft, setDraft] = React.useState<SequenceDraft | null>(null)
  const [instruction, setInstruction] = React.useState("")
  const [generating, setGenerating] = React.useState(false)
  const [refining, setRefining] = React.useState(false)
  const [saving, setSaving] = React.useState(false)

  const busy = generating || refining || saving

  function buildBrief() {
    return {
      company: company.trim(),
      target_audience: targetAudience.trim(),
      offer: offer.trim(),
      num_steps: numSteps,
      body_char_limit: bodyCharLimit,
      cta: { text: ctaText.trim(), url: ctaUrl.trim() || null },
      include_ab_testing: includeAb,
      personalization_vars: parseVars(personalization),
      tone,
    }
  }

  async function handleGenerate() {
    if (!company.trim() || !targetAudience.trim() || !offer.trim()) {
      toast.error("Company, target audience, and offer are required")
      return
    }
    if (!ctaText.trim()) {
      toast.error("A call-to-action is required")
      return
    }
    setGenerating(true)
    try {
      const result = await generateAiSequence(buildBrief())
      setDraft(result)
      setInstruction("")
      toast.success("Draft generated — review, refine, then save")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Generation failed")
    } finally {
      setGenerating(false)
    }
  }

  async function handleRefine() {
    if (!draft) return
    if (!instruction.trim()) {
      toast.error("Describe how to refine the draft")
      return
    }
    setRefining(true)
    try {
      const result = await refineAiSequence({
        steps: draft.steps,
        instruction: instruction.trim(),
        body_char_limit: bodyCharLimit,
        personalization_vars: parseVars(personalization),
        tone,
      })
      setDraft(result)
      setInstruction("")
      toast.success("Draft refined")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Refine failed")
    } finally {
      setRefining(false)
    }
  }

  async function handleSave() {
    if (!draft) return
    setSaving(true)
    try {
      const saved = await createSequence({
        name: draft.name,
        description: draft.description,
        total_steps: draft.steps.length,
        has_ab_testing: draft.has_ab_testing,
        steps: draft.steps,
      })
      await refresh()
      toast.success("Sequence saved")
      router.push(`/dashboard/sequences/${saved.sequence_id}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="px-4 lg:px-6">
        <Button
          variant="ghost"
          size="sm"
          className="w-fit"
          render={<Link href="/dashboard/sequences" />}
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
          Sequences
        </Button>
      </div>

      <PageHeader
        title="AI Sequences"
        description="Describe your offer and let AI draft a multi-step cold-email sequence you can refine and save."
      />

      <div className="grid gap-6 px-4 lg:grid-cols-[380px_1fr] lg:px-6">
        {/* ── Brief form ─────────────────────────────────────────────── */}
        <Card className="dark:bg-card h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HugeiconsIcon icon={AiMagicIcon} strokeWidth={2} />
              Brief
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="ai-company">Company or website</Label>
              <Input
                id="ai-company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Acme Inc / acme.com"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ai-audience">Target audience</Label>
              <Input
                id="ai-audience"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                placeholder="Heads of Sales at B2B SaaS startups"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ai-offer">Offer</Label>
              <Textarea
                id="ai-offer"
                value={offer}
                onChange={(e) => setOffer(e.target.value)}
                placeholder="What you're selling and why it matters to them"
                rows={3}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="ai-steps">Steps</Label>
                <Input
                  id="ai-steps"
                  type="number"
                  min={1}
                  max={10}
                  value={numSteps}
                  onChange={(e) =>
                    setNumSteps(
                      Math.min(10, Math.max(1, Number(e.target.value) || 1))
                    )
                  }
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ai-limit">Body char limit</Label>
                <Input
                  id="ai-limit"
                  type="number"
                  min={100}
                  max={5000}
                  step={50}
                  value={bodyCharLimit}
                  onChange={(e) =>
                    setBodyCharLimit(
                      Math.min(5000, Math.max(100, Number(e.target.value) || 100))
                    )
                  }
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ai-cta">Call to action</Label>
              <Input
                id="ai-cta"
                value={ctaText}
                onChange={(e) => setCtaText(e.target.value)}
                placeholder="Book a 15-min demo"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ai-cta-url">CTA link (optional)</Label>
              <Input
                id="ai-cta-url"
                value={ctaUrl}
                onChange={(e) => setCtaUrl(e.target.value)}
                placeholder="https://acme.com/demo"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ai-tone">Tone</Label>
              <Select
                value={tone}
                onValueChange={(v) => setTone((v as SequenceTone) ?? tone)}
              >
                <SelectTrigger id="ai-tone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TONES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ai-vars">Personalization variables</Label>
              <Input
                id="ai-vars"
                value={personalization}
                onChange={(e) => setPersonalization(e.target.value)}
                placeholder="name, company"
              />
              <p className="text-xs text-muted-foreground">
                Comma-separated merge fields, e.g. name, company.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={includeAb ? "default" : "outline"}
                size="sm"
                onClick={() => setIncludeAb((v) => !v)}
                type="button"
              >
                A/B testing {includeAb ? "on" : "off"}
              </Button>
            </div>
            <Button onClick={handleGenerate} disabled={busy}>
              <HugeiconsIcon icon={SparklesIcon} strokeWidth={2} />
              {generating ? "Generating…" : draft ? "Regenerate" : "Generate draft"}
            </Button>
          </CardContent>
        </Card>

        {/* ── Draft preview ──────────────────────────────────────────── */}
        <div className="flex flex-col gap-4">
          {!draft ? (
            <Card className="dark:bg-card">
              <CardContent className="flex flex-col items-center justify-center gap-3 py-20 text-center">
                <HugeiconsIcon
                  icon={AiMagicIcon}
                  strokeWidth={1.5}
                  className="size-10 text-muted-foreground"
                />
                <p className="text-muted-foreground">
                  Fill in the brief and generate a draft to preview it here.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card className="dark:bg-card">
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex flex-col gap-1">
                      <CardTitle className="flex items-center gap-2">
                        {draft.name}
                        <Badge variant="secondary">Draft</Badge>
                      </CardTitle>
                      {draft.description && (
                        <p className="text-sm text-muted-foreground">
                          {draft.description}
                        </p>
                      )}
                      <div className="mt-1 flex flex-wrap gap-2">
                        <Badge variant="outline">
                          {draft.steps.length} step
                          {draft.steps.length === 1 ? "" : "s"}
                        </Badge>
                        {draft.has_ab_testing && (
                          <Badge variant="outline">A/B testing</Badge>
                        )}
                      </div>
                    </div>
                    <Button onClick={handleSave} disabled={busy}>
                      <HugeiconsIcon icon={FloppyDiskIcon} strokeWidth={2} />
                      {saving ? "Saving…" : "Save to Sequences"}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-2">
                  <Label htmlFor="ai-refine">Refine with an instruction</Label>
                  <Textarea
                    id="ai-refine"
                    value={instruction}
                    onChange={(e) => setInstruction(e.target.value)}
                    placeholder="e.g. make it shorter and less salesy"
                    rows={2}
                  />
                  <div>
                    <Button
                      variant="outline"
                      onClick={handleRefine}
                      disabled={busy}
                    >
                      <HugeiconsIcon icon={RefreshIcon} strokeWidth={2} />
                      {refining ? "Refining…" : "Refine draft"}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {draft.steps.map((step) => (
                <Card key={step.step_order} className="dark:bg-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Badge variant="secondary">Step {step.step_order}</Badge>
                      <span className="text-sm font-normal text-muted-foreground">
                        {step.wait_days === 0
                          ? "Sends immediately"
                          : `Waits ${step.wait_days} day${
                              step.wait_days === 1 ? "" : "s"
                            }`}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-4">
                    <VariantView label="Variant A" variant={step.variants.a} />
                    {step.variants.b && (
                      <VariantView
                        label="Variant B"
                        variant={step.variants.b}
                      />
                    )}
                  </CardContent>
                </Card>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function VariantView({
  label,
  variant,
}: {
  label: string
  variant: {
    title: string
    body: string
    subject_lines?: string[]
    opening_lines?: string[]
    reply_trigger?: string | null
  }
}) {
  const subjects =
    variant.subject_lines && variant.subject_lines.length > 0
      ? variant.subject_lines
      : variant.title
        ? [variant.title]
        : []
  const openings = variant.opening_lines ?? []

  return (
    <div className="rounded-lg border p-3">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {subjects.length > 0 && (
        <div className="mb-2">
          <p className="text-xs text-muted-foreground">Subject lines</p>
          <ul className="list-inside list-disc text-sm font-medium">
            {subjects.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}
      {openings.length > 0 && (
        <div className="mb-2">
          <p className="text-xs text-muted-foreground">Opening lines</p>
          <ul className="list-inside list-disc text-sm">
            {openings.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}
      <p className="whitespace-pre-wrap text-sm text-foreground/90">
        {variant.body}
      </p>
      {variant.reply_trigger && (
        <p className="mt-2 text-sm">
          Reply <span className="font-semibold">{variant.reply_trigger}</span>{" "}
          to continue.
        </p>
      )}
    </div>
  )
}
