"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog"
import { ExportButton } from "@/components/dashboard/export-button"
import { FilterBar } from "@/components/dashboard/filter-bar"
import { SortableTableHead } from "@/components/dashboard/sortable-table-head"
import { PageHeader } from "@/components/dashboard/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useExports } from "@/hooks/use-exports"
import { useTableSort } from "@/hooks/use-table-sort"
import { buildSequencesExport } from "@/lib/exports/builders"
import { useUrlPreview } from "@/hooks/use-url-preview"
import { sequences as initialData } from "@/lib/data/sequences"
import { campaigns } from "@/lib/data/campaigns"
import { formatDate } from "@/lib/format"
import type { Sequence } from "@/lib/types"
import { HugeiconsIcon } from "@hugeicons/react"
import { MoreVerticalCircle01Icon } from "@hugeicons/core-free-icons"

type SequenceSortColumn =
  | "name"
  | "description"
  | "steps"
  | "ab"
  | "scheduled"
  | "completed"
  | "completions"
  | "updated_at"

export function SequencesPanel() {
  const router = useRouter()
  const { previewId } = useUrlPreview()
  const { addExport } = useExports()
  const [data, setData] = React.useState(initialData)
  const [search, setSearch] = React.useState("")
  const [scheduledFilter, setScheduledFilter] = React.useState("all")
  const [completedFilter, setCompletedFilter] = React.useState("all")
  const [abFilter, setAbFilter] = React.useState("all")
  const { column: sortColumn, direction: sortDirection, toggle: toggleSort, sort } =
    useTableSort<SequenceSortColumn>("name")
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [selected, setSelected] = React.useState<Sequence | null>(null)

  const filtered = sort(
    data.filter((row) => {
      const matchesSearch =
        !search || row.name.toLowerCase().includes(search.toLowerCase())
      const matchesScheduled =
        scheduledFilter === "all" ||
        (scheduledFilter === "yes" ? row.is_scheduled : !row.is_scheduled)
      const matchesCompleted =
        completedFilter === "all" ||
        (completedFilter === "yes" ? row.is_completed : !row.is_completed)
      const matchesAb =
        abFilter === "all" ||
        (abFilter === "yes" ? row.has_ab_testing : !row.has_ab_testing)
      return matchesSearch && matchesScheduled && matchesCompleted && matchesAb
    }),
    {
      name: (row) => row.name,
      description: (row) => row.description,
      steps: (row) => row.total_steps,
      ab: (row) => (row.has_ab_testing ? 1 : 0),
      scheduled: (row) => (row.is_scheduled ? 1 : 0),
      completed: (row) => (row.is_completed ? 1 : 0),
      completions: (row) => row.sequence_completion,
      updated_at: (row) => row.updated_at,
    }
  )

  const activeFilterCount = [
    !!search,
    scheduledFilter !== "all",
    completedFilter !== "all",
    abFilter !== "all",
  ].filter(Boolean).length

  function clearFilters() {
    setSearch("")
    setScheduledFilter("all")
    setCompletedFilter("all")
    setAbFilter("all")
  }

  function handleExport() {
    addExport(
      buildSequencesExport(filtered, {
        search,
        scheduled: scheduledFilter,
        completed: completedFilter,
        ab: abFilter,
      })
    )
    toast.success("Sequences report saved to Export", {
      action: {
        label: "View",
        onClick: () => router.push("/dashboard/export"),
      },
    })
  }

  React.useEffect(() => {
    if (previewId && data.find((s) => s.sequence_id === previewId)) {
      router.replace(`/dashboard/sequences/${previewId}`)
    }
  }, [previewId, data, router])

  function openPreview(sequence: Sequence) {
    router.push(`/dashboard/sequences/${sequence.sequence_id}`)
  }

  function handleDelete() {
    if (!selected) return
    const blocking = campaigns.filter(
      (c) =>
        c.sequence_id === selected.sequence_id &&
        (c.status === "scheduled" || c.status === "sending" || c.status === "completed")
    )
    if (blocking.length > 0) {
      toast.error(
        `Cannot delete — linked to campaigns: ${blocking.map((c) => c.name).join(", ")}`
      )
      return
    }
    setData((prev) =>
      prev.filter((row) => row.sequence_id !== selected.sequence_id)
    )
    toast.success("Sequence deleted")
  }

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <PageHeader
        title="Sequences"
        description="Build multi-step email sequences with optional A/B testing"
        actions={<ExportButton onClick={handleExport} />}
        action={{ label: "New Sequence", href: "/dashboard/sequences/new" }}
      />
      <FilterBar
        searchLabel="Search"
        searchPlaceholder="Search by name…"
        searchValue={search}
        onSearchChange={setSearch}
        resultCount={filtered.length}
        resultLabel={filtered.length === 1 ? "sequence" : "sequences"}
        activeFilterCount={activeFilterCount}
        onClear={clearFilters}
        filters={[
          {
            id: "scheduled",
            label: "Scheduled",
            value: scheduledFilter,
            options: [
              { label: "All", value: "all" },
              { label: "Yes", value: "yes" },
              { label: "No", value: "no" },
            ],
            onChange: setScheduledFilter,
          },
          {
            id: "completed",
            label: "Completed",
            value: completedFilter,
            options: [
              { label: "All", value: "all" },
              { label: "Yes", value: "yes" },
              { label: "No", value: "no" },
            ],
            onChange: setCompletedFilter,
          },
          {
            id: "ab",
            label: "A/B Testing",
            value: abFilter,
            options: [
              { label: "All", value: "all" },
              { label: "Enabled", value: "yes" },
              { label: "Disabled", value: "no" },
            ],
            onChange: setAbFilter,
          },
        ]}
      />
      <div className="px-4 lg:px-6">
        <div className="overflow-hidden rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTableHead
                  column="name"
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={toggleSort}
                >
                  Name
                </SortableTableHead>
                <SortableTableHead
                  column="description"
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={toggleSort}
                >
                  Description
                </SortableTableHead>
                <SortableTableHead
                  column="steps"
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={toggleSort}
                >
                  Steps
                </SortableTableHead>
                <SortableTableHead
                  column="ab"
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={toggleSort}
                >
                  A/B
                </SortableTableHead>
                <SortableTableHead
                  column="scheduled"
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={toggleSort}
                >
                  Scheduled
                </SortableTableHead>
                <SortableTableHead
                  column="completed"
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={toggleSort}
                >
                  Completed
                </SortableTableHead>
                <SortableTableHead
                  column="completions"
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={toggleSort}
                >
                  Completions
                </SortableTableHead>
                <SortableTableHead
                  column="updated_at"
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={toggleSort}
                >
                  Updated
                </SortableTableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row) => (
                <TableRow
                  key={row.sequence_id}
                  className="cursor-pointer"
                  onClick={() => openPreview(row)}
                >
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell className="max-w-48 truncate text-muted-foreground">
                    {row.description}
                  </TableCell>
                  <TableCell>{row.total_steps}</TableCell>
                  <TableCell>
                    {row.has_ab_testing ? (
                      <Badge variant="secondary">A/B</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {row.is_scheduled ? (
                      <Badge variant="outline" className="text-blue-400">Yes</Badge>
                    ) : (
                      <span className="text-muted-foreground">No</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {row.is_completed ? (
                      <Badge variant="outline" className="text-emerald-400">Yes</Badge>
                    ) : (
                      <span className="text-muted-foreground">No</span>
                    )}
                  </TableCell>
                  <TableCell>{row.sequence_completion}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(row.updated_at)}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={<Button variant="ghost" size="icon-sm" />}
                      >
                        <HugeiconsIcon icon={MoreVerticalCircle01Icon} strokeWidth={2} />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          render={
                            <a href={`/dashboard/sequences/${row.sequence_id}`} />
                          }
                        >
                          View
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          render={
                            <a href={`/dashboard/sequences/${row.sequence_id}/edit`} />
                          }
                        >
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => {
                            setSelected(row)
                            setDeleteOpen(true)
                          }}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete sequence?"
        description={`This will permanently remove "${selected?.name}".`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />

    </div>
  )
}