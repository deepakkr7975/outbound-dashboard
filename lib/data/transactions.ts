import transactionsData from "@/data/transactions.json"
import type { EmailTransaction } from "@/lib/types"

export const transactions = transactionsData as EmailTransaction[]

export function getTransactionsByCampaign(campaignId: string): EmailTransaction[] {
  return transactions.filter((t) => t.campaign_id === campaignId)
}

export function getTransactionById(id: string): EmailTransaction | undefined {
  return transactions.find((t) => t.transaction_id === id)
}