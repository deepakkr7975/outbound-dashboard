import type { Lead } from "@/lib/types"

import { leads, transactions } from "./store"

export { leads }

export function getLeadsByAudience(audienceId: string): Lead[] {
  return leads.filter((lead) => lead.audience_id === audienceId)
}

export function getLeadById(id: string): Lead | undefined {
  return leads.find((lead) => lead.id === id)
}

export function getLeadTransactions(leadId: string) {
  return transactions.filter((t) => t.lead_id === leadId)
}

export function getLeadCampaignIds(leadId: string): string[] {
  return Array.from(
    new Set(getLeadTransactions(leadId).map((t) => t.campaign_id))
  )
}

export function leadMatchesCampaign(
  lead: Lead,
  campaignId: string,
  campaignAudienceId: string
): boolean {
  if (lead.audience_id === campaignAudienceId) return true
  return getLeadTransactions(lead.id).some((t) => t.campaign_id === campaignId)
}
