"use client"

import * as React from "react"

import { PageHeader } from "@/components/dashboard/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useExports } from "@/hooks/use-exports"
import { downloadExportCsv } from "@/lib/exports/builders"
import type { ExportReport, ExportSource } from "@/lib/exports/types"
import { formatDateTime } from "@/lib/format"
import { cn } from "@/lib/utils"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Analytics01Icon,
  Contact01Icon,
  Delete02Icon,
  Download01Icon,
  LeftToRightListBulletIcon,
} from "@hugeicons/core-free-icons"

const sourceLabels: Record<ExportSource, string> = {
  leads: "Leads",
  lead: "Lead detail",
  sequences: "Sequences",
  sequence: "Sequence detail",
  analytics: "Analytics",
}

const sourceIcons: Record<ExportSource, typeof Contact01Icon> = {
  leads: Contact01Icon,
  lead: Contact01Icon,
  sequences: LeftToRightListBulletIcon,
  sequence: LeftToRightListBulletIcon,
  analytics: Analytics01Icon,
}

export function ExportPanel() {
  const { exports, removeExport } = useExports()
  const [selectedId, setSelectedId] = React.useState<string | null>(
    exports[0]?.id ?? null
  )

  React.useEffect(() => {
    if (!selectedId && exports[0]) setSelectedId(exports[0].id)
    if (selectedId && !exports.find((e) => e.id === selectedId)) {
      setSelectedId(exports[0]?.id ?? null)
    }
  }, [exports, selectedId])

  const selected = exports.find((e) => e.id === selectedId) ?? null
  const totalRows = exports.reduce((sum, e) => sum + e.rows.length, 0)

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <PageHeader
        title="Export"
        description="Saved reports from leads, sequences, and analytics exports"
      />

      <div className="grid gap-4 px-4 sm:grid-cols-2 lg:grid-cols-4 lg:px-6">
        <Card className="dark:bg-card">
          <CardHeader className="pb-2">
            <CardDescription>Total reports</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{exports.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="dark:bg-card">
          <CardHeader className="pb-2">
            <CardDescription>Total rows exported</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{totalRows}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="dark:bg-card">
          <CardHeader className="pb-2">
            <CardDescription>Latest export</CardDescription>
            <CardTitle className="text-lg">
              {exports[0] ? formatDateTime(exports[0].createdAt) : "—"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="dark:bg-card">
          <CardHeader className="pb-2">
            <CardDescription>Sources</CardDescription>
            <CardTitle className="text-lg">
              {new Set(exports.map((e) => e.source)).size || 0} types
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="flex flex-col gap-6 px-4 lg:px-6">
        <div className="overflow-hidden rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Report</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Rows</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {exports.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-32 text-center text-muted-foreground"
                  >
                    No exports yet. Use Export on Leads, Sequences, or Analytics.
                  </TableCell>
                </TableRow>
              ) : (
                exports.map((report) => (
                  <TableRow
                    key={report.id}
                    className={cn(
                      "cursor-pointer",
                      selectedId === report.id && "bg-muted/50"
                    )}
                    onClick={() => setSelectedId(report.id)}
                  >
                    <TableCell className="font-medium">{report.title}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {sourceLabels[report.source]}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-md truncate text-muted-foreground">
                      {report.description ?? "—"}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {report.rows.length}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDateTime(report.createdAt)}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => removeExport(report.id)}
                      >
                        <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-col gap-3">
          <h3 className="text-lg font-medium">Report preview</h3>
          {selected ? (
            <ExportDetail report={selected} />
          ) : (
            <Card className="flex items-center justify-center dark:bg-card">
              <CardContent className="py-16 text-center text-muted-foreground">
                Select a report from the table above to preview metrics and data
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

function ExportDetail({ report }: { report: ExportReport }) {
  const Icon = sourceIcons[report.source]

  return (
    <Card className="dark:bg-card">
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-muted/50">
              <HugeiconsIcon icon={Icon} strokeWidth={2} className="size-5" />
            </div>
            <div>
              <CardTitle>{report.title}</CardTitle>
              {report.description && (
                <CardDescription className="mt-1">
                  {report.description}
                </CardDescription>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                Exported {formatDateTime(report.createdAt)}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => downloadExportCsv(report)}
          >
            <HugeiconsIcon icon={Download01Icon} strokeWidth={2} className="size-4" />
            Download CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {report.metrics.map((metric) => (
            <div
              key={metric.label}
              className="rounded-lg border bg-muted/30 px-3 py-2"
            >
              <p className="text-xs text-muted-foreground">{metric.label}</p>
              <p className="text-lg font-semibold tabular-nums">{metric.value}</p>
            </div>
          ))}
        </div>

        {report.filters && Object.keys(report.filters).length > 0 && (
          <div className="flex flex-wrap gap-2">
            {Object.entries(report.filters).map(([key, value]) =>
              value && value !== "all" ? (
                <Badge key={key} variant="secondary">
                  {key}: {value}
                </Badge>
              ) : null
            )}
          </div>
        )}

        <div className="overflow-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                {report.columns.map((col) => (
                  <TableHead key={col.key}>{col.label}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.rows.map((row, i) => (
                <TableRow key={i}>
                  {report.columns.map((col) => (
                    <TableCell
                      key={col.key}
                      className="max-w-xs truncate text-muted-foreground"
                    >
                      {row[col.key] ?? "—"}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}