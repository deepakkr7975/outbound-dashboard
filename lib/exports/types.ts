export type ExportSource =
  | "leads"
  | "lead"
  | "sequences"
  | "sequence"
  | "analytics"

export interface ExportMetric {
  label: string
  value: string | number
}

export interface ExportColumn {
  key: string
  label: string
}

export interface ExportRow {
  [key: string]: string | number
}

export interface ExportReport {
  id: string
  source: ExportSource
  title: string
  description?: string
  createdAt: string
  metrics: ExportMetric[]
  columns: ExportColumn[]
  rows: ExportRow[]
  filters?: Record<string, string>
}

export type ExportReportInput = Omit<ExportReport, "id" | "createdAt">