import campaignsData from "@/data/campaigns.json"
import type { Campaign } from "@/lib/types"

export const campaigns = campaignsData as Campaign[]

export function getCampaignById(id: string): Campaign | undefined {
  return campaigns.find((c) => c.campaign_id === id)
}