import type { ReactNode } from "react"

export function DetailRow({
  label,
  value,
}: {
  label: string
  value: ReactNode
}) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  )
}