"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"

import { ExportButton } from "@/components/dashboard/export-button"
import { FilterBar } from "@/components/dashboard/filter-bar"
import { SortableTableHead } from "@/components/dashboard/sortable-table-head"
import { PageHeader } from "@/components/dashboard/page-header"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useExports } from "@/hooks/use-exports"
import { useLiveData } from "@/hooks/use-live-data"
import { useTableSort } from "@/hooks/use-table-sort"
import { buildLeadsExport } from "@/lib/exports/builders"
import { audiences } from "@/lib/data/audiences"
import { campaigns } from "@/lib/data/campaigns"
import { getLeadById, leads, leadMatchesCampaign } from "@/lib/data/leads"
import { formatDate } from "@/lib/format"
import type { Lead } from "@/lib/types"
import { HugeiconsIcon } from "@hugeicons/react"
import { CheckmarkCircle01Icon } from "@hugeicons/core-free-icons"

type LeadSortColumn =
  | "name"
  | "email"
  | "role"
  | "company"
  | "city"
  | "audience"
  | "emails_sent"
  | "created_at"

export function LeadsPanel() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { addExport } = useExports()
  const { version } = useLiveData()

  const audienceFilter = searchParams.get("audience") ?? "all"
  const campaignFilter = searchParams.get("campaign") ?? "all"
  const dateFilter = searchParams.get("date") ?? ""
  const nameFilter = searchParams.get("name") ?? ""

  const [nameInput, setNameInput] = React.useState(nameFilter)
  const { column: sortColumn, direction: sortDirection, toggle: toggleSort, sort } =
    useTableSort<LeadSortColumn>("name")

  const leadParam = searchParams.get("lead")

  React.useEffect(() => {
    setNameInput(nameFilter)
  }, [nameFilter])

  React.useEffect(() => {
    if (leadParam && getLeadById(leadParam)) {
      router.replace(`/dashboard/leads/${leadParam}`)
    }
  }, [leadParam, router, version])

  function updateParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString())
    Object.entries(updates).forEach(([key, value]) => {
      if (!value || value === "all") params.delete(key)
      else params.set(key, value)
    })
    const qs = params.toString()
    router.replace(qs ? `/dashboard/leads?${qs}` : "/dashboard/leads")
  }

  const filtered = sort(
    leads.filter((lead) => {
      if (audienceFilter !== "all" && lead.audience_id !== audienceFilter) {
        return false
      }
      if (campaignFilter !== "all") {
        const campaign = campaigns.find((c) => c.campaign_id === campaignFilter)
        if (!campaign) return false
        if (!leadMatchesCampaign(lead, campaignFilter, campaign.audience_id)) {
          return false
        }
      }
      if (dateFilter) {
        const leadDate = lead.created_at.slice(0, 10)
        if (leadDate < dateFilter) return false
      }
      if (nameFilter) {
        const q = nameFilter.toLowerCase()
        const matches =
          lead.name.toLowerCase().includes(q) ||
          lead.email.toLowerCase().includes(q) ||
          lead.company.toLowerCase().includes(q)
        if (!matches) return false
      }
      return true
    }),
    {
      name: (lead) => lead.name,
      email: (lead) => lead.email,
      role: (lead) => lead.role,
      company: (lead) => lead.company,
      city: (lead) => lead.city,
      audience: (lead) =>
        audiences.find((a) => a.id === lead.audience_id)?.name ?? "",
      emails_sent: (lead) => lead.emails_sent,
      created_at: (lead) => lead.created_at,
    }
  )

  const activeFilterCount = [
    audienceFilter !== "all",
    campaignFilter !== "all",
    !!dateFilter,
    !!nameFilter,
  ].filter(Boolean).length

  function openLead(lead: Lead) {
    router.push(`/dashboard/leads/${lead.id}`)
  }

  function clearFilters() {
    setNameInput("")
    router.replace("/dashboard/leads")
  }

  function handleNameSearch() {
    updateParams({ name: nameInput.trim() || null })
  }

  function handleExport() {
    addExport(
      buildLeadsExport(filtered, {
        audience: audienceFilter,
        campaign: campaignFilter,
        date: dateFilter,
        name: nameFilter,
      })
    )
    toast.success("Leads report saved to Export", {
      action: {
        label: "View",
        onClick: () => router.push("/dashboard/export"),
      },
    })
  }

  const audienceName =
    audienceFilter !== "all"
      ? audiences.find((a) => a.id === audienceFilter)?.name
      : null

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <PageHeader
        title="Leads"
        description={
          audienceName
            ? `Showing leads from ${audienceName}`
            : "All leads across audiences and campaigns"
        }
        actions={<ExportButton onClick={handleExport} />}
      />

      <FilterBar
        filters={[
          {
            id: "audience",
            label: "Audience",
            value: audienceFilter,
            options: [
              { label: "All audiences", value: "all" },
              ...audiences.map((a) => ({ label: a.name, value: a.id })),
            ],
            onChange: (v) => updateParams({ audience: v }),
          },
          {
            id: "campaign",
            label: "Campaign",
            value: campaignFilter,
            options: [
              { label: "All campaigns", value: "all" },
              ...campaigns.map((c) => ({
                label: c.name,
                value: c.campaign_id,
              })),
            ],
            onChange: (v) => updateParams({ campaign: v }),
          },
          {
            id: "date",
            label: "Added on or after",
            type: "date",
            value: dateFilter,
            onChange: (v) => updateParams({ date: v || null }),
          },
          {
            id: "name",
            label: "Name / email / company",
            type: "text",
            value: nameInput,
            placeholder: "Search leads…",
            onChange: setNameInput,
            onSubmit: handleNameSearch,
          },
        ]}
        resultCount={filtered.length}
        resultLabel={filtered.length === 1 ? "lead" : "leads"}
        activeFilterCount={activeFilterCount}
        onClear={clearFilters}
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
                  column="email"
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={toggleSort}
                >
                  Email
                </SortableTableHead>
                <SortableTableHead
                  column="role"
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={toggleSort}
                >
                  Role
                </SortableTableHead>
                <SortableTableHead
                  column="company"
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={toggleSort}
                >
                  Company
                </SortableTableHead>
                <SortableTableHead
                  column="city"
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={toggleSort}
                >
                  City
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
                  column="emails_sent"
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={toggleSort}
                >
                  Emails Sent
                </SortableTableHead>
                <SortableTableHead
                  column="created_at"
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={toggleSort}
                >
                  Added
                </SortableTableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No leads match the current filters
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((lead) => {
                  const audience = audiences.find(
                    (a) => a.id === lead.audience_id
                  )
                  return (
                    <TableRow
                      key={lead.id}
                      className="cursor-pointer"
                      onClick={() => openLead(lead)}
                    >
                      <TableCell className="font-medium">{lead.name}</TableCell>
                      <TableCell>{lead.email}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {lead.role}
                      </TableCell>
                      <TableCell>{lead.company}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {lead.city}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{audience?.name ?? "—"}</Badge>
                      </TableCell>
                      <TableCell>
                        {lead.emails_sent > 0 ? (
                          <Badge variant="outline" className="gap-1">
                            <HugeiconsIcon
                              icon={CheckmarkCircle01Icon}
                              strokeWidth={2}
                              className="size-3.5"
                            />
                            {lead.emails_sent}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(lead.created_at)}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}