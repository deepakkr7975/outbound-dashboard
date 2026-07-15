import type {
  ABVariant,
  Audience,
  Campaign,
  CampaignSchedule,
  CampaignStatus,
  EmailTransaction,
  Lead,
  SenderEmail,
  Sequence,
  SequenceStep,
  TransactionStatus,
} from "@/lib/types"

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000"

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init?.body && !(init.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...init?.headers,
    },
  })
  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      if (typeof body?.detail === "string") detail = body.detail
    } catch {
      // non-JSON error body — keep statusText
    }
    throw new ApiError(res.status, detail)
  }
  return res.json() as Promise<T>
}

/* ── Raw backend shapes ────────────────────────────────────────────────── */

interface RawAccount {
  id: string
  email: string
  domain: string | null
  domain_name: string | null
  status: string
  connected_at: string | null
  is_active: boolean
  daily_limit: number
  sent_today: number
  signature_name: string | null
  signature_title: string | null
  signature_company: string | null
  signature_phone: string | null
  signature_html: string | null
  is_linked: boolean
  linked_campaign_count: number
}

interface RawAudience {
  id: string
  name: string
  description: string | null
  file_name: string | null
  tags: string[]
  num_leads: number
  created_at: string
  updated_at?: string
}

interface RawAudienceDetail {
  audience: RawAudience
  leads: { id: string; name: string; email: string; company: string }[]
}

type RawLead = Record<string, unknown> & {
  id: string
  name: string
  email: string
  company: string
  created_at: string
}

interface RawVariant {
  // Legacy shape stored a single subject string on `title`.
  title?: string
  // New backend shape.
  subject_lines?: string[]
  opening_lines?: string[]
  reply_trigger?: string | null
  body?: string
}

interface RawSequenceStep {
  step_order: number
  wait_days?: number
  variants?: { a?: RawVariant; b?: RawVariant | null }
}

type RawSequence = Record<string, unknown> & {
  sequence_id: string
  name: string
  description?: string | null
  total_steps?: number
  has_ab_testing?: boolean
  is_ai_generated?: boolean
  steps?: RawSequenceStep[]
  created_at?: string
  updated_at?: string
}

interface RawCampaignListItem {
  id: string
  name: string
  description: string | null
  status: string
  schedule_at: string
  current_step_order: number
  total_steps: number
  sent: number
  queued: number
  failed: number
  completion_percentage: number
  created_at: string
}

type RawCampaignDetail = Record<string, unknown> & {
  id: string
  name: string
  status: string
  schedule_at: string
  sender_email_ids?: string[]
  sequence_id: string
  audience_id: string
  stats?: Record<string, number | string>
}

type RawTransaction = Record<string, unknown> & {
  transaction_id: string
  PK: string
  SK: string
  campaign_id: string
  sequence_id: string
  step_order: number
  lead_id: string
  status: string
  created_at: string
  scheduled_for: string
}

/* ── Mappers (backend → dashboard types) ───────────────────────────────── */

const BACKEND_TO_UI_CAMPAIGN_STATUS: Record<string, CampaignStatus> = {
  draft: "draft",
  scheduled: "scheduled",
  running: "sending",
  paused: "paused",
  completed: "completed",
  cancelled: "cancelled",
  failed: "failed",
}

const BACKEND_TO_UI_TXN_STATUS: Record<string, TransactionStatus> = {
  queued: "queued",
  sending: "queued",
  sent: "sent",
  delivered: "delivered",
  opened: "opened",
  clicked: "clicked",
  replied: "replied",
  bounced: "bounced",
  failed: "failed",
  cancelled: "failed",
  unsubscribed: "unsubscribed",
}

function scheduleFromIso(iso: string): CampaignSchedule {
  const [date, time] = iso.split("T")
  return { date, time: (time ?? "00:00").slice(0, 5), timezone: "UTC" }
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback
}

function num(value: unknown, fallback = 0): number {
  return typeof value === "number" ? value : fallback
}

function nullableStr(value: unknown): string | null {
  return typeof value === "string" ? value : null
}

export function mapSenderEmail(raw: RawAccount): SenderEmail {
  return {
    id: raw.id,
    email: raw.email,
    name: raw.signature_name,
    domain: raw.domain ?? raw.email.split("@")[1] ?? "",
    domain_name: raw.domain_name ?? "",
    signature: raw.signature_html,
    verification_status:
      raw.status === "verified" ? "verified" : "pending_verification",
    linked_status: raw.is_linked ? "linked" : "free",
    linked_campaign_ids: [], // filled in by the store from campaigns
    created_at: raw.connected_at ?? "",
    updated_at: raw.connected_at ?? "",
  }
}

export function mapAudience(raw: RawAudience): Audience {
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description ?? "",
    file_name: raw.file_name ?? "",
    tags: raw.tags ?? [],
    member_count: raw.num_leads ?? 0,
    created_at: raw.created_at,
    updated_at: raw.updated_at ?? raw.created_at,
  }
}

export function mapLead(raw: RawLead): Lead {
  return {
    id: raw.id,
    audience_id: str(raw.audience_id),
    email: raw.email,
    name: raw.name,
    role: str(raw.role),
    company: raw.company ?? "",
    city: str(raw.city),
    emails_sent: num(raw.emails_sent),
    created_at: raw.created_at,
  }
}

function mapVariant(v: RawVariant | null | undefined) {
  if (!v) return null
  const subjectLines = v.subject_lines ?? []
  const openingLines = v.opening_lines ?? []
  return {
    // New format keeps subject options on `subject_lines`; the legacy format
    // stored a single subject on `title`. Surface the first as `title` so the
    // existing table/detail UI keeps rendering unchanged.
    title: subjectLines[0] ?? v.title ?? "",
    body: v.body ?? "",
    subject_lines: subjectLines,
    opening_lines: openingLines,
    reply_trigger: v.reply_trigger ?? null,
  }
}

export function mapSequence(raw: RawSequence): Sequence {
  const steps = (raw.steps ?? []).map((s) => ({
    step_order: num(s.step_order),
    wait_days: num(s.wait_days),
    variants: {
      a: mapVariant(s.variants?.a) ?? { title: "", body: "" },
      b: mapVariant(s.variants?.b),
    },
  }))
  const fallbackStepCounts = Object.fromEntries(
    steps.map((s) => [`email ${s.step_order}`, 0])
  )
  return {
    sequence_id: raw.sequence_id,
    name: raw.name,
    description: str(raw.description),
    total_steps: num(raw.total_steps, steps.length),
    has_ab_testing: Boolean(raw.has_ab_testing),
    is_ai_generated: Boolean(raw.is_ai_generated),
    steps,
    is_scheduled: Boolean(raw.is_scheduled),
    is_completed: Boolean(raw.is_completed),
    sequence_completion: num(raw.sequence_completion),
    sequence_steps:
      (raw.sequence_steps as Record<string, number> | undefined) ??
      fallbackStepCounts,
    created_at: str(raw.created_at),
    updated_at: str(raw.updated_at),
  }
}

export function mapCampaign(raw: RawCampaignDetail): Campaign {
  const status = BACKEND_TO_UI_CAMPAIGN_STATUS[raw.status] ?? "draft"
  const stats = raw.stats ?? {}
  const sentFromStats =
    num(stats.sent) +
    num(stats.delivered) +
    num(stats.opened) +
    num(stats.clicked) +
    num(stats.replied)
  return {
    campaign_id: raw.id,
    name: raw.name,
    description: str(raw.description),
    sender_email_ids: raw.sender_email_ids ?? [],
    sequence_id: raw.sequence_id,
    audience_id: raw.audience_id,
    schedule:
      (raw.schedule as CampaignSchedule | undefined) ??
      scheduleFromIso(raw.schedule_at),
    is_scheduled:
      typeof raw.is_scheduled === "boolean"
        ? raw.is_scheduled
        : status === "scheduled" || status === "sending",
    is_completed:
      typeof raw.is_completed === "boolean"
        ? raw.is_completed
        : status === "completed",
    status,
    sent_count: num(raw.sent_count, sentFromStats),
    total_count: num(raw.total_count, num(stats.total_transactions)),
    created_at: str(raw.created_at),
    updated_at: str(raw.updated_at),
  }
}

export function mapTransaction(raw: RawTransaction): EmailTransaction {
  return {
    transaction_id: raw.transaction_id,
    PK: raw.PK,
    SK: raw.SK,
    campaign_id: raw.campaign_id,
    sequence_id: raw.sequence_id,
    step_order: num(raw.step_order),
    lead_id: raw.lead_id,
    sender_email_id: str(raw.sender_email_id),
    audience_id: str(raw.audience_id),
    variant: (str(raw.variant, "a").toUpperCase() === "B" ? "B" : "A") as ABVariant,
    subject_line: str(raw.subject_line),
    template_version: str(raw.template_version),
    status: BACKEND_TO_UI_TXN_STATUS[raw.status] ?? "queued",
    created_at: raw.created_at,
    scheduled_for: raw.scheduled_for,
    sent_at: nullableStr(raw.sent_at),
    delivered_at: nullableStr(raw.delivered_at),
    opened_at: nullableStr(raw.opened_at),
    clicked_at: nullableStr(raw.clicked_at),
    replied_at: nullableStr(raw.replied_at),
    bounced_at: nullableStr(raw.bounced_at),
    open_count: num(raw.open_count),
    click_count: num(raw.click_count),
    provider: str(raw.provider),
    provider_message_id: str(raw.provider_message_id),
    bounce_type: (raw.bounce_type as "hard" | "soft" | null | undefined) ?? null,
    error_message: nullableStr(raw.error_message),
  }
}

/* ── Read endpoints ────────────────────────────────────────────────────── */

export async function fetchSenderEmails(): Promise<SenderEmail[]> {
  const raw = await api<RawAccount[]>("/email-accounts")
  return raw.map(mapSenderEmail)
}

export async function fetchAudiences(): Promise<Audience[]> {
  const { audiences } = await api<{ audiences: RawAudience[] }>("/audiences")
  return audiences.map(mapAudience)
}

/** audience_id -> member lead ids (list endpoint omits lead_ids) */
export async function fetchAudienceLeadIds(
  audienceIds: string[]
): Promise<Record<string, string[]>> {
  const details = await Promise.all(
    audienceIds.map((id) =>
      api<RawAudienceDetail>(`/audiences/${id}`).catch(() => null)
    )
  )
  const result: Record<string, string[]> = {}
  details.forEach((detail, i) => {
    if (detail) result[audienceIds[i]] = detail.leads.map((l) => l.id)
  })
  return result
}

export async function fetchLeads(): Promise<Lead[]> {
  const { leads } = await api<{ leads: RawLead[] }>("/leads?limit=1000")
  return leads.map(mapLead)
}

export async function fetchSequences(): Promise<Sequence[]> {
  const raw = await api<RawSequence[]>("/sequences")
  return raw.map(mapSequence)
}

export async function fetchCampaigns(): Promise<Campaign[]> {
  const { campaigns } = await api<{ campaigns: RawCampaignListItem[] }>(
    "/campaigns"
  )
  // List endpoint omits linked ids/schedule extras — resolve each campaign
  const details = await Promise.all(
    campaigns.map((c) =>
      api<RawCampaignDetail>(`/campaigns/${c.id}`).catch(() => null)
    )
  )
  return details.filter((d): d is RawCampaignDetail => d !== null).map(mapCampaign)
}

export async function fetchTransactions(): Promise<EmailTransaction[]> {
  const { transactions } = await api<{ transactions: RawTransaction[] }>(
    "/transactions"
  )
  return transactions.map(mapTransaction)
}

/* ── Mutations ─────────────────────────────────────────────────────────── */

export function deleteCampaign(id: string) {
  return api<{ message: string }>(`/campaigns/${id}`, { method: "DELETE" })
}

export function pauseCampaign(id: string) {
  return api<{ message: string }>(`/campaigns/${id}/pause`, { method: "POST" })
}

export function resumeCampaign(id: string) {
  return api<{ message: string }>(`/campaigns/${id}/resume`, { method: "POST" })
}

export function cancelCampaign(id: string) {
  return api<{ message: string }>(`/campaigns/${id}/cancel`, { method: "POST" })
}

export function deleteAudience(id: string) {
  return api<{ message: string }>(`/audiences/${id}`, { method: "DELETE" })
}

export function updateAudience(
  id: string,
  body: { name?: string; description?: string; tags?: string[] }
) {
  return api<{ message: string }>(`/audiences/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  })
}

export function deleteSequence(id: string) {
  return api<{ message: string }>(`/sequences/${id}`, { method: "DELETE" })
}

export function createSequence(body: {
  name: string
  description?: string
  total_steps: number
  has_ab_testing: boolean
  steps: SequenceStep[]
}) {
  return api<RawSequence>("/sequences", {
    method: "POST",
    body: JSON.stringify(body),
  })
}

export function updateSequence(
  id: string,
  body: Partial<{
    name: string
    description: string
    total_steps: number
    has_ab_testing: boolean
    steps: SequenceStep[]
  }>
) {
  return api<RawSequence>(`/sequences/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  })
}

/** Get the Google OAuth URL to connect/verify a Gmail mailbox. The account
 * that ends up verified is whichever Google account the user logs in as, so
 * callers should append a `login_hint` to target a specific mailbox. */
export function connectSenderEmail() {
  return api<{ authorization_url: string }>("/email-accounts/connect")
}

export function createSenderEmail(email: string, name?: string) {
  return api<{ id: string; email: string }>("/email-accounts", {
    method: "POST",
    body: JSON.stringify({ email, signature_name: name || undefined }),
  })
}

export function deleteSenderEmail(id: string) {
  return api<{ message: string }>(`/email-accounts/${id}`, {
    method: "DELETE",
  })
}

export function updateSenderSignature(
  id: string,
  body: { signature_html?: string; signature_name?: string }
) {
  return api<{ message: string }>(`/email-accounts/${id}/signature`, {
    method: "PATCH",
    body: JSON.stringify(body),
  })
}

export function createCampaign(body: {
  name: string
  description?: string
  sender_email_ids: string[]
  sequence_id: string
  audience_id: string
  schedule_at: string
}) {
  return api<{ campaign_id: string; status: string }>("/campaigns", {
    method: "POST",
    body: JSON.stringify(body),
  })
}

export function uploadLeadsCsv(form: FormData) {
  return api<{ message: string }>("/leads/upload", {
    method: "POST",
    body: form,
  })
}

/* ── AI Sequences (/ai/sequences) ──────────────────────────────────────── */

export type SequenceTone = "professional" | "clickbait" | "casual" | "formal"

export interface GenerateSequenceBody {
  company: string
  target_audience: string
  offer: string
  num_steps: number
  body_char_limit: number
  cta: { text: string; url?: string | null }
  include_ab_testing: boolean
  personalization_vars: string[]
  tone: SequenceTone
}

export interface RefineSequenceBody {
  steps: SequenceStep[]
  instruction: string
  body_char_limit: number
  personalization_vars: string[]
  tone: SequenceTone
}

/** A draft sequence carries the same shape as a saved one, un-persisted. */
export type SequenceDraft = Sequence & { draft?: boolean }

/**
 * Generate a sequence draft from a brief. Does NOT persist.
 *
 * When `file` is supplied, the request is sent as multipart/form-data so the
 * backend can read the document (e.g. an existing sequence to mimic): the file
 * goes in the `file` field and the brief is JSON-encoded in the `brief` field.
 * Without a file it falls back to the plain JSON brief request.
 */
export async function generateAiSequence(
  body: GenerateSequenceBody,
  file?: File | null
): Promise<SequenceDraft> {
  let init: RequestInit
  if (file) {
    const form = new FormData()
    form.append("file", file)
    form.append("brief", JSON.stringify(body))
    init = { method: "POST", body: form }
  } else {
    init = { method: "POST", body: JSON.stringify(body) }
  }
  const raw = await api<RawSequence & { draft?: boolean }>(
    "/ai/sequences/generate",
    init
  )
  return { ...mapSequence(raw), draft: Boolean(raw.draft) }
}

/** Generate a sequence AND persist it to the sequences table. */
export async function generateAndSaveAiSequence(
  body: GenerateSequenceBody
): Promise<Sequence> {
  const raw = await api<RawSequence>("/ai/sequences/generate-and-save", {
    method: "POST",
    body: JSON.stringify(body),
  })
  return mapSequence(raw)
}

/** Revise a draft sequence with a free-text instruction. Does NOT persist. */
export async function refineAiSequence(
  body: RefineSequenceBody
): Promise<SequenceDraft> {
  const raw = await api<RawSequence & { draft?: boolean }>(
    "/ai/sequences/refine",
    { method: "POST", body: JSON.stringify(body) }
  )
  return { ...mapSequence(raw), draft: Boolean(raw.draft) }
}

/** Refine a saved sequence in place with an instruction and persist it. */
export async function updateAiSequence(
  id: string,
  body: {
    instruction: string
    name?: string
    description?: string
    body_char_limit: number
    personalization_vars: string[]
    tone: SequenceTone
  }
): Promise<Sequence> {
  const raw = await api<RawSequence>(`/ai/sequences/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  })
  return mapSequence(raw)
}

/** Regenerate a single step of a saved sequence and persist the change. */
export async function regenerateAiSequenceStep(
  id: string,
  body: {
    step_order: number
    instruction?: string
    include_ab_testing: boolean
    body_char_limit: number
    personalization_vars: string[]
  }
): Promise<Sequence> {
  const raw = await api<RawSequence>(`/ai/sequences/${id}/regenerate-step`, {
    method: "POST",
    body: JSON.stringify(body),
  })
  return mapSequence(raw)
}
