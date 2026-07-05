import { campaigns, transactions } from "@/lib/data"

export interface HeaderEmailStats {
  sent: number
  scheduled: number
  delivered: number
}

function getDeliveryRate(): number {
  const sent = transactions.filter((t) => t.sent_at).length
  const delivered = transactions.filter((t) => t.delivered_at).length
  if (sent === 0) return 0.97
  return delivered / sent
}

export function getHeaderEmailStats(): HeaderEmailStats {
  const sent = campaigns.reduce((sum, c) => sum + c.sent_count, 0)
  const scheduled = campaigns
    .filter((c) => c.status === "sending" || c.status === "scheduled")
    .reduce((sum, c) => sum + Math.max(0, c.total_count - c.sent_count), 0)

  const deliveryRate = getDeliveryRate()
  const delivered = campaigns.reduce((sum, c) => {
    if (c.sent_count === 0) return sum
    if (c.status === "completed") return sum + c.sent_count
    return sum + Math.round(c.sent_count * deliveryRate)
  }, 0)

  return { sent, scheduled, delivered }
}

export function formatCompactCount(value: number): string {
  if (value >= 1000) {
    const compact = value / 1000
    return compact >= 10
      ? `${Math.round(compact)}k`
      : `${compact.toFixed(1).replace(/\.0$/, "")}k`
  }
  return value.toLocaleString()
}