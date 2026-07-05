"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/dashboard/confirm-dialog"
import { FilterBar } from "@/components/dashboard/filter-bar"
import { SortableTableHead } from "@/components/dashboard/sortable-table-head"
import { PageHeader } from "@/components/dashboard/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useTableSort } from "@/hooks/use-table-sort"
import { useUrlPreview } from "@/hooks/use-url-preview"
import { audiences as initialData, getAudienceById } from "@/lib/data/audiences"
import { campaigns } from "@/lib/data/campaigns"
import { formatDate } from "@/lib/format"
import type { Audience } from "@/lib/types"
import { HugeiconsIcon } from "@hugeicons/react"
import { MoreVerticalCircle01Icon } from "@hugeicons/core-free-icons"

type AudienceSortColumn =
  | "name"
  | "description"
  | "tags"
  | "members"
  | "file"
  | "created_at"

export function AudiencesPanel() {
  const router = useRouter()
  const { previewId } = useUrlPreview()
  const [data, setData] = React.useState(initialData)
  const [search, setSearch] = React.useState("")
  const [tagFilter, setTagFilter] = React.useState("all")
  const [membersFilter, setMembersFilter] = React.useState("all")
  const { column: sortColumn, direction: sortDirection, toggle: toggleSort, sort } =
    useTableSort<AudienceSortColumn>("name")
  const [addOpen, setAddOpen] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [selected, setSelected] = React.useState<Audience | null>(null)
  const [form, setForm] = React.useState({
    name: "",
    description: "",
    tags: "",
    fileName: "",
  })

  const allTags = Array.from(new Set(data.flatMap((a) => a.tags)))

  const filtered = sort(
    data.filter((row) => {
      const matchesSearch =
        !search || row.name.toLowerCase().includes(search.toLowerCase())
      const matchesTag =
        tagFilter === "all" || row.tags.includes(tagFilter)
      const matchesMembers =
        membersFilter === "all" ||
        (membersFilter === "large"
          ? row.member_count >= 150
          : row.member_count < 150)
      return matchesSearch && matchesTag && matchesMembers
    }),
    {
      name: (row) => row.name,
      description: (row) => row.description,
      tags: (row) => row.tags.join(", "),
      members: (row) => row.member_count,
      file: (row) => row.file_name,
      created_at: (row) => row.created_at,
    }
  )

  const activeFilterCount = [
    !!search,
    tagFilter !== "all",
    membersFilter !== "all",
  ].filter(Boolean).length

  function clearFilters() {
    setSearch("")
    setTagFilter("all")
    setMembersFilter("all")
  }

  React.useEffect(() => {
    if (previewId && getAudienceById(previewId)) {
      router.replace(`/dashboard/audiences/${previewId}`)
    }
  }, [previewId, router])

  function openAudience(audience: Audience) {
    router.push(`/dashboard/audiences/${audience.id}`)
  }

  function handleAdd() {
    if (!form.name || !form.fileName) {
      toast.error("Name and CSV file are required")
      return
    }
    const newAudience: Audience = {
      id: crypto.randomUUID(),
      name: form.name,
      description: form.description,
      file_name: form.fileName,
      tags: form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      member_count: Math.floor(Math.random() * 200) + 50,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    setData((prev) => [newAudience, ...prev])
    setAddOpen(false)
    setForm({ name: "", description: "", tags: "", fileName: "" })
    toast.success(
      `Audience "${newAudience.name}" created with ${newAudience.member_count} leads`
    )
    router.push(`/dashboard/audiences/${newAudience.id}`)
  }

  function handleDelete() {
    if (!selected) return
    const inUse = campaigns.some(
      (c) =>
        c.audience_id === selected.id &&
        (c.status === "scheduled" || c.status === "sending")
    )
    if (inUse) {
      toast.error("Cannot delete — audience is attached to a running campaign")
      return
    }
    setData((prev) => prev.filter((row) => row.id !== selected.id))
    toast.success("Audience deleted")
  }

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <PageHeader
        title="Audiences"
        description="Upload and organize lead groups via CSV"
        action={{ label: "New Audience", onClick: () => setAddOpen(true) }}
      />
      <FilterBar
        searchLabel="Search"
        searchPlaceholder="Search by name…"
        searchValue={search}
        onSearchChange={setSearch}
        resultCount={filtered.length}
        resultLabel={filtered.length === 1 ? "audience" : "audiences"}
        activeFilterCount={activeFilterCount}
        onClear={clearFilters}
        filters={[
          {
            id: "tag",
            label: "Tag",
            value: tagFilter,
            options: [
              { label: "All tags", value: "all" },
              ...allTags.map((tag) => ({ label: tag, value: tag })),
            ],
            onChange: setTagFilter,
          },
          {
            id: "members",
            label: "Size",
            value: membersFilter,
            options: [
              { label: "All sizes", value: "all" },
              { label: "Large (150+)", value: "large" },
              { label: "Small (<150)", value: "small" },
            ],
            onChange: setMembersFilter,
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
                  column="tags"
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={toggleSort}
                >
                  Tags
                </SortableTableHead>
                <SortableTableHead
                  column="members"
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={toggleSort}
                >
                  Members
                </SortableTableHead>
                <SortableTableHead
                  column="file"
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={toggleSort}
                >
                  File
                </SortableTableHead>
                <SortableTableHead
                  column="created_at"
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={toggleSort}
                >
                  Created
                </SortableTableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() => openAudience(row)}
                >
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell className="max-w-48 truncate text-muted-foreground">
                    {row.description}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {row.tags.map((tag) => (
                        <Badge key={tag} variant="secondary">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>{row.member_count.toLocaleString()}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.file_name}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(row.created_at)}
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
                            <Link href={`/dashboard/audiences/${row.id}`} />
                          }
                        >
                          Open audience
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          render={
                            <Link href={`/dashboard/leads?audience=${row.id}`} />
                          }
                        >
                          View Leads
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

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Audience</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="desc">Description</Label>
              <Input
                id="desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="tags">Tags (comma-separated)</Label>
              <Input
                id="tags"
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                placeholder="marketing_head, klipkanvas"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="csv">CSV File</Label>
              <Input
                id="csv"
                type="file"
                accept=".csv"
                onChange={(e) =>
                  setForm({
                    ...form,
                    fileName: e.target.files?.[0]?.name ?? "",
                  })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd}>Import Audience</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete audience?"
        description={`This will remove "${selected?.name}" and all its leads.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  )
}