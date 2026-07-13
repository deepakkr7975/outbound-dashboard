import { transactions } from "@/lib/data"

export interface HeaderEmailStats {
  sent: number
  scheduled: number
  delivered: number
}

// Derived from actual transactions (the same source the overview cards use) so
// the header numbers always agree with the rest of the dashboard, rather than
// mixing campaign counters with an estimated delivery rate.
export function getHeaderEmailStats(): HeaderEmailStats {
  const sent = transactions.filter((t) => t.sent_at).length
  const scheduled = transactions.filter(
    (t) => t.status === "queued" && !t.sent_at
  ).length
  const delivered = transactions.filter((t) => t.delivered_at).length

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