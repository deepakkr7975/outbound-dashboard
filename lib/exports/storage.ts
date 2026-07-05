import type { ExportReport, ExportReportInput } from "@/lib/exports/types"

const STORAGE_KEY = "revtrix-export-reports"

export function getStoredExports(): ExportReport[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as ExportReport[]
  } catch {
    return []
  }
}

export function saveExport(input: ExportReportInput): ExportReport {
  const report: ExportReport = {
    ...input,
    id: `exp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  }
  const existing = getStoredExports()
  const next = [report, ...existing]
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  window.dispatchEvent(new CustomEvent("revtrix-exports-updated"))
  return report
}

export function deleteExport(id: string): void {
  const next = getStoredExports().filter((r) => r.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  window.dispatchEvent(new CustomEvent("revtrix-exports-updated"))
}