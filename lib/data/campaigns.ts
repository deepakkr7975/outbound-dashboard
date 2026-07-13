import type { Campaign } from "@/lib/types"

import { campaigns } from "./store"

export { campaigns }

export function getCampaignById(id: string): Campaign | undefined {
  return campaigns.find((c) => c.campaign_id === id)
}
