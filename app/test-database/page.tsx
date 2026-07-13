"use client"

import * as React from "react"

import { Badge } from "@/components/ui/badge"
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
import { API_BASE } from "@/lib/api"

type TableDump = {
  count: number
  items: Record<string, unknown>[]
  error?: string
}

type DatabaseDump = Record<string, TableDump>

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "—"
  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
}

function DumpTable({ name, dump }: { name: string; dump: TableDump }) {
  const columns = Array.from(
    new Set(dump.items.flatMap((item) => Object.keys(item)))
  ).sort()

  return (
    <Card className="dark:bg-card" data-testid={`db-table-${name}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-mono text-lg">
          {name}
          <Badge variant="secondary">{dump.count} items</Badge>
        </CardTitle>
        {dump.error && (
          <CardDescription className="text-destructive">
            {dump.error}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        {dump.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No records</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((col) => (
                    <TableHead key={col} className="whitespace-nowrap font-mono text-xs">
                      {col}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {dump.items.map((item, i) => (
                  <TableRow key={i}>
                    {columns.map((col) => (
                      <TableCell
                        key={col}
                        className="max-w-64 truncate whitespace-nowrap font-mono text-xs"
                        title={formatCell(item[col])}
                      >
                        {formatCell(item[col])}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function TestDatabasePage() {
  const [dump, setDump] = React.useState<DatabaseDump | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    fetch(`${API_BASE}/debug/database`)
      .then((res) => {
        if (!res.ok) throw new Error(`API responded ${res.status}`)
        return res.json()
      })
      .then(setDump)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }, [])

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Test Database
        </h1>
        <p className="text-muted-foreground">
          Live contents of every DynamoDB table behind the dashboard, grouped
          by table name.
        </p>
      </div>

      {error && (
        <p className="text-destructive" data-testid="db-error">
          Failed to load database dump: {error}
        </p>
      )}
      {!dump && !error && (
        <p className="text-muted-foreground" data-testid="db-loading">
          Loading database…
        </p>
      )}
      {dump &&
        Object.entries(dump).map(([name, tableDump]) => (
          <DumpTable key={name} name={name} dump={tableDump} />
        ))}
    </div>
  )
}
