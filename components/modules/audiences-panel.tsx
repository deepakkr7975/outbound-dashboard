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
import { useLiveData } from "@/hooks/use-live-data"
import { useTableSort } from "@/hooks/use-table-sort"
import { useUrlPreview } from "@/hooks/use-url-preview"
import { deleteAudience, uploadLeadsCsv } from "@/lib/api"
import { audiences as initialData, getAudienceById } from "@/lib/data/audiences"
import { refresh } from "@/lib/data/store"
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
  const { version } = useLiveData()
  const [data, setData] = React.useState(initialData)
  const [search, setSearch] = React.useState("")

  React.useEffect(() => {
    setData([...initialData])
  }, [version])
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
  const [csvFile, setCsvFile] = React.useState<File | null>(null)
  const [uploading, setUploading] = React.useState(false)

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

  async function handleAdd() {
    if (!form.name || !csvFile) {
      toast.error("Name and CSV file are required")
      return
    }
    const body = new FormData()
    body.append("name", form.name)
    if (form.description) body.append("description", form.description)
    if (form.tags) body.append("tags", form.tags)
    body.append("file", csvFile)
    setUploading(true)
    try {
      const result = (await uploadLeadsCsv(body)) as {
        audience?: { id: string; name: string; num_leads: number }
      }
      await refresh()
      setAddOpen(false)
      setForm({ name: "", description: "", tags: "", fileName: "" })
      setCsvFile(null)
      toast.success(
        `Audience "${result.audience?.name ?? form.name}" created with ${
          result.audience?.num_leads ?? 0
        } leads`
      )
      if (result.audience?.id) {
        router.push(`/dashboard/audiences/${result.audience.id}`)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete() {
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
    try {
      await deleteAudience(selected.id)
      setData((prev) => prev.filter((row) => row.id !== selected.id))
      toast.success("Audience deleted")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed")
    }
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
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null
                  setCsvFile(file)
                  setForm({ ...form, fileName: file?.name ?? "" })
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={uploading}>
              {uploading ? "Uploading…" : "Import Audience"}
            </Button>
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