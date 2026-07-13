/**
 * Live data store backed by the FastAPI backend.
 *
 * The arrays below keep stable references and are hydrated in place from the
 * API, so every existing `lib/data/*` helper and module-level import keeps
 * working. Components subscribe via the `useLiveData()` hook, which triggers
 * the initial load and re-renders whenever the store is (re)filled.
 */
import {
  fetchAudienceLeadIds,
  fetchAudiences,
  fetchCampaigns,
  fetchLeads,
  fetchSenderEmails,
  fetchSequences,
  fetchTransactions,
} from "@/lib/api"
import type {
  Audience,
  Campaign,
  EmailTransaction,
  Lead,
  SenderEmail,
  Sequence,
} from "@/lib/types"

export const senderEmails: SenderEmail[] = []
export const audiences: Audience[] = []
export const leads: Lead[] = []
export const sequences: Sequence[] = []
export const campaigns: Campaign[] = []
export const transactions: EmailTransaction[] = []

let version = 0
let loaded = false
let loadPromise: Promise<void> | null = null
const listeners = new Set<() => void>()

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getVersion(): number {
  return version
}

export function isLoaded(): boolean {
  return loaded
}

function notify() {
  version++
  listeners.forEach((listener) => listener())
}

function fill<T>(target: T[], next: T[]) {
  target.splice(0, target.length, ...next)
}

async function hydrate(): Promise<void> {
  const [
    nextSenders,
    nextAudiences,
    nextLeads,
    nextSequences,
    nextCampaigns,
    nextTransactions,
  ] = await Promise.all([
    fetchSenderEmails(),
    fetchAudiences(),
    fetchLeads(),
    fetchSequences(),
    fetchCampaigns(),
    fetchTransactions(),
  ])

  // Cross-derivations the individual endpoints don't provide directly:
  // sender -> campaigns that reference it. A sender only counts as "linked"
  // (and is blocked from deletion) when an *active* campaign holds it — this
  // must match the backend, which only rejects deletes for campaigns in these
  // statuses. Draft/completed/cancelled/failed references leave it free.
  const LOCKING_STATUSES = new Set<Campaign["status"]>([
    "scheduled",
    "sending",
    "paused",
  ])
  for (const sender of nextSenders) {
    const activeLinks = nextCampaigns.filter(
      (c) =>
        c.sender_email_ids.includes(sender.id) &&
        LOCKING_STATUSES.has(c.status)
    )
    sender.linked_campaign_ids = activeLinks.map((c) => c.campaign_id)
    sender.linked_status = activeLinks.length > 0 ? "linked" : "free"
  }

  // lead -> audience (backend stores lead_ids on the audience side)
  const missingAudience = nextLeads.filter((l) => !l.audience_id)
  if (missingAudience.length > 0) {
    const byAudience = await fetchAudienceLeadIds(nextAudiences.map((a) => a.id))
    const leadToAudience = new Map<string, string>()
    for (const [audienceId, leadIds] of Object.entries(byAudience)) {
      for (const leadId of leadIds) leadToAudience.set(leadId, audienceId)
    }
    for (const lead of missingAudience) {
      lead.audience_id = leadToAudience.get(lead.id) ?? ""
    }
  }

  fill(senderEmails, nextSenders)
  fill(audiences, nextAudiences)
  fill(leads, nextLeads)
  fill(sequences, nextSequences)
  fill(campaigns, nextCampaigns)
  fill(transactions, nextTransactions)

  loaded = true
  notify()
}

/** Load once; concurrent callers share the same request. */
export function loadAll(): Promise<void> {
  if (!loadPromise) {
    loadPromise = hydrate().catch((error) => {
      loadPromise = null // allow retry after a failure
      throw error
    })
  }
  return loadPromise
}

/** Re-fetch everything (after a mutation). */
export function refresh(): Promise<void> {
  loadPromise = hydrate().catch((error) => {
    loadPromise = null
    throw error
  })
  return loadPromise
}
