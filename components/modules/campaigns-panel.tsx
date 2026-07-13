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
import { cancelCampaign, deleteCampaign } from "@/lib/api"
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
        action={{ label: "New Campaign", onClick: () => toast.info("Campaign wizard coming soon") }}
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