"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/dashboard/confirm-dialog"
import { FilterBar } from "@/components/dashboard/filter-bar"
import { SortableTableHead } from "@/components/dashboard/sortable-table-head"
import { CampaignStatusBadge } from "@/components/dashboard/status-badge"
import { PageHeader } from "@/components/dashboard/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useLiveData } from "@/hooks/use-live-data"
import { useTableSort } from "@/hooks/use-table-sort"
import { useUrlPreview } from "@/hooks/use-url-preview"
import { cancelCampaign, createCampaign, deleteCampaign } from "@/lib/api"
import { refresh } from "@/lib/data/store"
import { campaigns as initialData } from "@/lib/data/campaigns"
import { senderEmails } from "@/lib/data/sender-emails"
import { audiences } from "@/lib/data/audiences"
import { sequences } from "@/lib/data/sequences"
import { formatDate } from "@/lib/format"
import type { Campaign } from "@/lib/types"
import { HugeiconsIcon } from "@hugeicons/react"
import { MoreVerticalCircle01Icon } from "@hugeicons/core-free-icons"

type CampaignSortColumn =
  | "name"
  | "sequence"
  | "audience"
  | "senders"
  | "schedule"
  | "status"
  | "progress"

type LinkedSortColumn = "campaign" | "email" | "domain" | "status"

export function CampaignsPanel() {
  const router = useRouter()
  const { previewId } = useUrlPreview()
  const { version } = useLiveData()
  const [data, setData] = React.useState(initialData)

  React.useEffect(() => {
    setData([...initialData])
  }, [version])
  const [search, setSearch] = React.useState("")
  const [scheduledFilter, setScheduledFilter] = React.useState("all")
  const [completedFilter, setCompletedFilter] = React.useState("all")
  const [sequenceFilter, setSequenceFilter] = React.useState("all")
  const [statusFilter, setStatusFilter] = React.useState("all")
  const [linkedSearch, setLinkedSearch] = React.useState("")
  const {
    column: sortColumn,
    direction: sortDirection,
    toggle: toggleSort,
    sort,
  } = useTableSort<CampaignSortColumn>("name")
  const {
    column: linkedSortColumn,
    direction: linkedSortDirection,
    toggle: toggleLinkedSort,
    sort: sortLinked,
  } = useTableSort<LinkedSortColumn>("campaign")
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [selected, setSelected] = React.useState<Campaign | null>(null)
  const [createOpen, setCreateOpen] = React.useState(false)
  const [creating, setCreating] = React.useState(false)
  const emptyCreateForm = {
    name: "",
    description: "",
    sequence_id: "",
    audience_id: "",
    sender_email_ids: [] as string[],
    schedule_at: "",
  }
  const [createForm, setCreateForm] = React.useState(emptyCreateForm)

  // Only verified senders can actually send, so those are the eligible picks.
  const verifiedSenders = senderEmails.filter(
    (s) => s.verification_status === "verified"
  )

  const canCreate =
    !!createForm.name.trim() &&
    !!createForm.sequence_id &&
    !!createForm.audience_id &&
    createForm.sender_email_ids.length > 0 &&
    !!createForm.schedule_at

  function toggleSender(id: string) {
    setCreateForm((f) => ({
      ...f,
      sender_email_ids: f.sender_email_ids.includes(id)
        ? f.sender_email_ids.filter((s) => s !== id)
        : [...f.sender_email_ids, id],
    }))
  }

  async function handleCreate() {
    if (!canCreate) return
    // The datetime-local value is an IST wall-clock time. Tag it with the fixed
    // IST offset (+05:30) so the UTC conversion is correct regardless of the
    // browser's own timezone, then send UTC ISO to the backend.
    const local = createForm.schedule_at
    const withSeconds = local.length === 16 ? `${local}:00` : local
    const scheduleIso = new Date(`${withSeconds}+05:30`).toISOString()
    setCreating(true)
    try {
      await createCampaign({
        name: createForm.name.trim(),
        description: createForm.description.trim() || undefined,
        sender_email_ids: createForm.sender_email_ids,
        sequence_id: createForm.sequence_id,
        audience_id: createForm.audience_id,
        schedule_at: scheduleIso,
      })
      await refresh()
      setCreateOpen(false)
      setCreateForm(emptyCreateForm)
      toast.success(`"${createForm.name.trim()}" campaign created`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Create failed")
    } finally {
      setCreating(false)
    }
  }

  function getSequenceName(id: string) {
    return sequences.find((s) => s.sequence_id === id)?.name ?? id
  }

  function getAudienceName(id: string) {
    return audiences.find((a) => a.id === id)?.name ?? id
  }

  function getSenderEmails(ids: string[]) {
    return ids
      .map((id) => senderEmails.find((s) => s.id === id)?.email ?? id)
      .join(", ")
  }

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
      const matchesSequence =
        sequenceFilter === "all" || row.sequence_id === sequenceFilter
      const matchesStatus =
        statusFilter === "all" || row.status === statusFilter
      return (
        matchesSearch &&
        matchesScheduled &&
        matchesCompleted &&
        matchesSequence &&
        matchesStatus
      )
    }),
    {
      name: (row) => row.name,
      sequence: (row) => getSequenceName(row.sequence_id),
      audience: (row) => getAudienceName(row.audience_id),
      senders: (row) => row.sender_email_ids.length,
      schedule: (row) => `${row.schedule.date} ${row.schedule.time}`,
      status: (row) => row.status,
      progress: (row) =>
        row.total_count === 0 ? 0 : row.sent_count / row.total_count,
    }
  )

  const activeFilterCount = [
    !!search,
    scheduledFilter !== "all",
    completedFilter !== "all",
    sequenceFilter !== "all",
    statusFilter !== "all",
  ].filter(Boolean).length

  function clearFilters() {
    setSearch("")
    setScheduledFilter("all")
    setCompletedFilter("all")
    setSequenceFilter("all")
    setStatusFilter("all")
  }

  const linkedRows = sortLinked(
    data
      .flatMap((campaign) =>
        campaign.sender_email_ids.map((senderId) => {
          const sender = senderEmails.find((s) => s.id === senderId)
          if (!sender) return null
          return {
            key: `${campaign.campaign_id}-${senderId}`,
            campaign,
            sender,
          }
        })
      )
      .filter(Boolean) as {
      key: string
      campaign: Campaign
      sender: (typeof senderEmails)[number]
    }[],
    {
      campaign: (row) => row.campaign.name,
      email: (row) => row.sender.email,
      domain: (row) => row.sender.domain,
      status: (row) => row.campaign.status,
    }
  ).filter((row) => {
    if (!linkedSearch) return true
    const q = linkedSearch.toLowerCase()
    return (
      row.campaign.name.toLowerCase().includes(q) ||
      row.sender.email.toLowerCase().includes(q) ||
      row.sender.domain.toLowerCase().includes(q)
    )
  })

  React.useEffect(() => {
    if (previewId && data.find((c) => c.campaign_id === previewId)) {
      router.replace(`/dashboard/campaigns/${previewId}`)
    }
  }, [previewId, data, router])

  function openPreview(campaign: Campaign) {
    router.push(`/dashboard/campaigns/${campaign.campaign_id}`)
  }

  async function handleCancel(campaign: Campaign) {
    try {
      await cancelCampaign(campaign.campaign_id)
      // Refetch so this campaign's status and any freed sender emails update.
      await refresh()
      toast.success(`"${campaign.name}" cancelled`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Cancel failed")
    }
  }

  async function handleDelete() {
    if (!selected) return
    if (selected.status === "scheduled" || selected.status === "sending") {
      toast.error(
        "Cancel this campaign before deleting it."
      )
      return
    }
    try {
      await deleteCampaign(selected.campaign_id)
      setData((prev) =>
        prev.filter((row) => row.campaign_id !== selected.campaign_id)
      )
      toast.success("Campaign deleted")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed")
    }
  }

  const campaignTable = (
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
              column="sequence"
              sortColumn={sortColumn}
              sortDirection={sortDirection}
              onSort={toggleSort}
            >
              Sequence
            </SortableTableHead>
            <SortableTableHead
              column="audience"
              sortColumn={sortColumn}
              sortDirection={sortDirection}
              onSort={toggleSort}
            >
              Audience
            </SortableTableHead>
            <SortableTableHead
              column="senders"
              sortColumn={sortColumn}
              sortDirection={sortDirection}
              onSort={toggleSort}
            >
              Senders
            </SortableTableHead>
            <SortableTableHead
              column="schedule"
              sortColumn={sortColumn}
              sortDirection={sortDirection}
              onSort={toggleSort}
            >
              Schedule
            </SortableTableHead>
            <SortableTableHead
              column="status"
              sortColumn={sortColumn}
              sortDirection={sortDirection}
              onSort={toggleSort}
            >
              Status
            </SortableTableHead>
            <SortableTableHead
              column="progress"
              sortColumn={sortColumn}
              sortDirection={sortDirection}
              onSort={toggleSort}
            >
              Progress
            </SortableTableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((row) => (
            <TableRow
              key={row.campaign_id}
              className="cursor-pointer"
              onClick={() => openPreview(row)}
            >
              <TableCell className="font-medium">{row.name}</TableCell>
              <TableCell className="text-muted-foreground">
                {getSequenceName(row.sequence_id)}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {getAudienceName(row.audience_id)}
              </TableCell>
              <TableCell>
                <Tooltip>
                  <TooltipTrigger
                    render={<Badge variant="secondary" className="cursor-default" />}
                  >
                    {row.sender_email_ids.length}
                  </TooltipTrigger>
                  <TooltipContent>
                    {getSenderEmails(row.sender_email_ids)}
                  </TooltipContent>
                </Tooltip>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDate(row.schedule.date)} {row.schedule.time}
              </TableCell>
              <TableCell>
                <CampaignStatusBadge status={row.status} />
              </TableCell>
              <TableCell className="tabular-nums">
                {row.sent_count}/{row.total_count}
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
                        <a href={`/dashboard/campaigns/${row.campaign_id}`} />
                      }
                    >
                      View
                    </DropdownMenuItem>
                    {(row.status === "scheduled" ||
                      row.status === "sending" ||
                      row.status === "paused") && (
                      <DropdownMenuItem onClick={() => handleCancel(row)}>
                        Cancel sending
                      </DropdownMenuItem>
                    )}
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
  )

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <PageHeader
        title="Campaigns"
        description="Bind senders, sequences, audiences, and schedules"
        action={{ label: "New Campaign", onClick: () => setCreateOpen(true) }}
      />
      <Tabs defaultValue="campaigns" className="px-4 lg:px-6">
        <TabsList>
          <TabsTrigger value="campaigns">All Campaigns</TabsTrigger>
          <TabsTrigger value="linked">Linked Emails</TabsTrigger>
        </TabsList>
        <TabsContent value="campaigns" className="mt-4 flex flex-col gap-4">
          <FilterBar
            searchLabel="Search"
            searchPlaceholder="Search by name…"
            searchValue={search}
            onSearchChange={setSearch}
            resultCount={filtered.length}
            resultLabel={filtered.length === 1 ? "campaign" : "campaigns"}
            activeFilterCount={activeFilterCount}
            onClear={clearFilters}
            filters={[
              {
                id: "status",
                label: "Status",
                value: statusFilter,
                options: [
                  { label: "All statuses", value: "all" },
                  { label: "Draft", value: "draft" },
                  { label: "Scheduled", value: "scheduled" },
                  { label: "Sending", value: "sending" },
                  { label: "Completed", value: "completed" },
                  { label: "Paused", value: "paused" },
                ],
                onChange: setStatusFilter,
              },
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
                id: "sequence",
                label: "Sequence",
                value: sequenceFilter,
                options: [
                  { label: "All sequences", value: "all" },
                  ...sequences.map((s) => ({
                    label: s.name,
                    value: s.sequence_id,
                  })),
                ],
                onChange: setSequenceFilter,
              },
            ]}
          />
          {campaignTable}
        </TabsContent>
        <TabsContent value="linked" className="mt-4 flex flex-col gap-4">
          <FilterBar
            searchLabel="Search"
            searchPlaceholder="Search campaign, email, or domain…"
            searchValue={linkedSearch}
            onSearchChange={setLinkedSearch}
            resultCount={linkedRows.length}
            resultLabel="linked emails"
            activeFilterCount={linkedSearch ? 1 : 0}
            onClear={() => setLinkedSearch("")}
            className="px-0"
          />
          <div className="overflow-hidden rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead
                    column="campaign"
                    sortColumn={linkedSortColumn}
                    sortDirection={linkedSortDirection}
                    onSort={toggleLinkedSort}
                  >
                    Campaign
                  </SortableTableHead>
                  <SortableTableHead
                    column="email"
                    sortColumn={linkedSortColumn}
                    sortDirection={linkedSortDirection}
                    onSort={toggleLinkedSort}
                  >
                    Sender Email
                  </SortableTableHead>
                  <SortableTableHead
                    column="domain"
                    sortColumn={linkedSortColumn}
                    sortDirection={linkedSortDirection}
                    onSort={toggleLinkedSort}
                  >
                    Domain
                  </SortableTableHead>
                  <SortableTableHead
                    column="status"
                    sortColumn={linkedSortColumn}
                    sortDirection={linkedSortDirection}
                    onSort={toggleLinkedSort}
                  >
                    Status
                  </SortableTableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {linkedRows.map((row) => (
                  <TableRow
                    key={row.key}
                    className="cursor-pointer"
                    onClick={() =>
                      router.push(
                        `/dashboard/sender-emails?preview=${row.sender.id}`
                      )
                    }
                  >
                    <TableCell className="font-medium">
                      {row.campaign.name}
                    </TableCell>
                    <TableCell className="font-medium">
                      {row.sender.email}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.sender.domain}
                    </TableCell>
                    <TableCell>
                      <CampaignStatusBadge status={row.campaign.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New Campaign</DialogTitle>
          </DialogHeader>
          <div className="grid max-h-[65vh] gap-3 overflow-y-auto px-1">
            <div className="grid gap-1.5">
              <Label htmlFor="campaign-name">Name</Label>
              <Input
                id="campaign-name"
                value={createForm.name}
                onChange={(e) =>
                  setCreateForm({ ...createForm, name: e.target.value })
                }
                placeholder="e.g. Q3 Founders Outreach"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="campaign-description">Description (optional)</Label>
              <Textarea
                id="campaign-description"
                value={createForm.description}
                onChange={(e) =>
                  setCreateForm({ ...createForm, description: e.target.value })
                }
                placeholder="What is this campaign for?"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="campaign-sequence">Sequence</Label>
              <Select
                value={createForm.sequence_id}
                onValueChange={(v) =>
                  setCreateForm({ ...createForm, sequence_id: v ?? "" })
                }
              >
                <SelectTrigger id="campaign-sequence" className="w-full">
                  <SelectValue placeholder="Select a sequence" />
                </SelectTrigger>
                <SelectContent>
                  {sequences.map((s) => (
                    <SelectItem key={s.sequence_id} value={s.sequence_id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="campaign-audience">Audience</Label>
              <Select
                value={createForm.audience_id}
                onValueChange={(v) =>
                  setCreateForm({ ...createForm, audience_id: v ?? "" })
                }
              >
                <SelectTrigger id="campaign-audience" className="w-full">
                  <SelectValue placeholder="Select an audience" />
                </SelectTrigger>
                <SelectContent>
                  {audiences.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name} · {a.member_count} leads
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Sender Emails</Label>
              {verifiedSenders.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No verified sender emails available. Verify a sender first.
                </p>
              ) : (
                <div className="grid max-h-40 gap-2 overflow-y-auto rounded-lg border p-3">
                  {verifiedSenders.map((sender) => (
                    <label
                      key={sender.id}
                      className="flex cursor-pointer items-center gap-2 text-sm"
                    >
                      <Checkbox
                        checked={createForm.sender_email_ids.includes(sender.id)}
                        onCheckedChange={() => toggleSender(sender.id)}
                      />
                      <span>{sender.email}</span>
                      <span className="text-muted-foreground">
                        {sender.domain}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="campaign-schedule">Schedule (IST)</Label>
              <Input
                id="campaign-schedule"
                type="datetime-local"
                value={createForm.schedule_at}
                onChange={(e) =>
                  setCreateForm({ ...createForm, schedule_at: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">
                Entered in IST (UTC+5:30); converted to UTC before sending.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!canCreate || creating}>
              {creating ? "Creating…" : "Create Campaign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete campaign?"
        description={`This will permanently remove "${selected?.name}".`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />

    </div>
  )
}