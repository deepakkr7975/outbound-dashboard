import type { EmailTransaction } from "@/lib/types"

import { transactions } from "./store"

export { transactions }

export function getTransactionsByCampaign(campaignId: string): EmailTransaction[] {
  return transactions.filter((t) => t.campaign_id === campaignId)
}

export function getTransactionById(id: string): EmailTransaction | undefined {
  return transactions.find((t) => t.transaction_id === id)
}
