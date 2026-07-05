"use client"

import * as React from "react"

import {
  deleteExport as removeExport,
  getStoredExports,
  saveExport,
} from "@/lib/exports/storage"
import type { ExportReport, ExportReportInput } from "@/lib/exports/types"

interface ExportContextValue {
  exports: ExportReport[]
  addExport: (input: ExportReportInput) => ExportReport
  removeExport: (id: string) => void
  refresh: () => void
}

const ExportContext = React.createContext<ExportContextValue | null>(null)

export function ExportProvider({ children }: { children: React.ReactNode }) {
  const [exports, setExports] = React.useState<ExportReport[]>([])

  const refresh = React.useCallback(() => {
    setExports(getStoredExports())
  }, [])

  React.useEffect(() => {
    refresh()
    const handler = () => refresh()
    window.addEventListener("revtrix-exports-updated", handler)
    return () => window.removeEventListener("revtrix-exports-updated", handler)
  }, [refresh])

  const addExport = React.useCallback(
    (input: ExportReportInput) => {
      const saved = saveExport(input)
      refresh()
      return saved
    },
    [refresh]
  )

  const handleRemove = React.useCallback(
    (id: string) => {
      removeExport(id)
      refresh()
    },
    [refresh]
  )

  return (
    <ExportContext.Provider
      value={{ exports, addExport, removeExport: handleRemove, refresh }}
    >
      {children}
    </ExportContext.Provider>
  )
}

export function useExports() {
  const ctx = React.useContext(ExportContext)
  if (!ctx) {
    throw new Error("useExports must be used within ExportProvider")
  }
  return ctx
}