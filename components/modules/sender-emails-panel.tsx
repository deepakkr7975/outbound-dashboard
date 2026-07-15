"use client"

import * as React from "react"
import { toast } from "sonner"

import { SenderEmailPreviewSheet } from "@/components/modules/sender-email-preview-sheet"
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog"
import { FilterBar } from "@/components/dashboard/filter-bar"
import { SortableTableHead } from "@/components/dashboard/sortable-table-head"
import {
  LinkedStatusBadge,
  VerificationBadge,
} from "@/components/dashboard/status-badge"
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
import { Textarea } from "@/components/ui/textarea"
import { useLiveData } from "@/hooks/use-live-data"
import { useTableSort } from "@/hooks/use-table-sort"
import { useUrlPreview } from "@/hooks/use-url-preview"
import {
  connectSenderEmail,
  createSenderEmail,
  deleteSenderEmail,
  updateSenderSignature,
} from "@/lib/api"
import { senderEmails as initialData } from "@/lib/data/sender-emails"
import { refresh } from "@/lib/data/store"
import { campaigns } from "@/lib/data/campaigns"
import { formatDate } from "@/lib/format"
import type { SenderEmail } from "@/lib/types"
import { HugeiconsIcon } from "@hugeicons/react"
import { MoreVerticalCircle01Icon } from "@hugeicons/core-free-icons"

/** Mirror the backend's `extract_domain_info` so the Add dialog can preview
 * the domain/domain name that will be derived from the email on the server. */
function deriveDomainInfo(email: string) {
  const at = email.indexOf("@")
  if (at === -1) return null
  const domain = email.slice(at + 1).toLowerCase().trim()
  if (!domain) return null
  const domain_name = domain
    .split(".")[0]
    .replace(/-/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ")
  return { domain, domain_name }
}

type SenderSortColumn =
  | "email"
  | "name"
  | "domain"
  | "domain_name"
  | "verification"
  | "status"
  | "linked_campaigns"
  | "signature"
  | "created_at"

export function SenderEmailsPanel() {
  const { previewId, setPreviewId } = useUrlPreview()
  const { version } = useLiveData()
  const [data, setData] = React.useState(initialData)

  React.useEffect(() => {
    setData([...initialData])
  }, [version])

  // The Gmail OAuth callback redirects back here with ?connected=<email> (or
  // ?connect_error=<msg>). Surface the result, refresh so the newly-verified
  // account shows, and strip the param so a reload doesn't re-toast.
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const connected = params.get("connected")
    const connectError = params.get("connect_error")
    if (!connected && !connectError) return
    if (connected) {
      toast.success(`${decodeURIComponent(connected)} connected`)
      refresh()
    } else if (connectError) {
      toast.error(`Gmail connect failed: ${decodeURIComponent(connectError)}`)
    }
    params.delete("connected")
    params.delete("connect_error")
    const qs = params.toString()
    window.history.replaceState(
      null,
      "",
      window.location.pathname + (qs ? `?${qs}` : "")
    )
  }, [])
  const [previewSender, setPreviewSender] = React.useState<SenderEmail | null>(null)
  const [previewOpen, setPreviewOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState("all")
  const [verificationFilter, setVerificationFilter] = React.useState("all")
  const [signatureFilter, setSignatureFilter] = React.useState("all")
  const [domainFilter, setDomainFilter] = React.useState("all")
  const { column: sortColumn, direction: sortDirection, toggle: toggleSort, sort } =
    useTableSort<SenderSortColumn>("email")
  const [addOpen, setAddOpen] = React.useState(false)
  const [signatureOpen, setSignatureOpen] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [selected, setSelected] = React.useState<SenderEmail | null>(null)
  const [form, setForm] = React.useState({
    email: "",
    name: "",
    signature: "",
  })
  const derivedDomain = deriveDomainInfo(form.email)
  const normalizedEmail = form.email.trim().toLowerCase()
  // Check both the rendered snapshot and the live store array so a lagging
  // `data` snapshot can't let a duplicate through.
  const emailExists = (candidate: string) =>
    data.some((row) => row.email.trim().toLowerCase() === candidate) ||
    initialData.some((row) => row.email.trim().toLowerCase() === candidate)
  const isDuplicate = !!normalizedEmail && emailExists(normalizedEmail)

  const domains = Array.from(new Set(data.map((row) => row.domain)))

  const filtered = sort(
    data.filter((row) => {
      const matchesSearch =
        !search ||
        row.email.toLowerCase().includes(search.toLowerCase()) ||
        row.domain.toLowerCase().includes(search.toLowerCase()) ||
        (row.name?.toLowerCase().includes(search.toLowerCase()) ?? false)
      const matchesStatus =
        statusFilter === "all" || row.linked_status === statusFilter
      const matchesVerification =
        verificationFilter === "all" ||
        row.verification_status === verificationFilter
      const matchesSignature =
        signatureFilter === "all" ||
        (signatureFilter === "set" ? !!row.signature : !row.signature)
      const matchesDomain =
        domainFilter === "all" || row.domain === domainFilter
      return (
        matchesSearch &&
        matchesStatus &&
        matchesVerification &&
        matchesSignature &&
        matchesDomain
      )
    }),
    {
      email: (row) => row.email,
      name: (row) => row.name ?? "",
      domain: (row) => row.domain,
      domain_name: (row) => row.domain_name,
      verification: (row) => (row.verification_status === "verified" ? 1 : 0),
      status: (row) => row.linked_status,
      linked_campaigns: (row) => row.linked_campaign_ids.length,
      signature: (row) => (row.signature ? 1 : 0),
      created_at: (row) => row.created_at,
    }
  )

  const activeFilterCount = [
    !!search,
    statusFilter !== "all",
    verificationFilter !== "all",
    signatureFilter !== "all",
    domainFilter !== "all",
  ].filter(Boolean).length

  function clearFilters() {
    setSearch("")
    setStatusFilter("all")
    setVerificationFilter("all")
    setSignatureFilter("all")
    setDomainFilter("all")
  }

  function getCampaignNames(ids: string[]) {
    return ids
      .map((id) => campaigns.find((c) => c.campaign_id === id)?.name ?? id)
      .join(", ")
  }

  React.useEffect(() => {
    if (previewId) {
      const sender = data.find((s) => s.id === previewId)
      if (sender) {
        setPreviewSender(sender)
        setPreviewOpen(true)
      }
    }
  }, [previewId, data])

  function openPreview(sender: SenderEmail) {
    setPreviewSender(sender)
    setPreviewOpen(true)
    setPreviewId(sender.id)
  }

  function handlePreviewChange(open: boolean) {
    setPreviewOpen(open)
    if (!open) setPreviewId(null)
  }

  async function handleAdd() {
    const email = form.email.trim().toLowerCase()
    if (!email.includes("@")) {
      toast.error("Enter a valid email address")
      return
    }
    if (emailExists(email)) {
      toast.error("This email is already added")
      return
    }
    const name = form.name.trim()
    try {
      const created = await createSenderEmail(email, name)
      if (form.signature || name) {
        await updateSenderSignature(created.id, {
          signature_html: form.signature || undefined,
          signature_name: name || undefined,
        })
      }
      await refresh()
      setAddOpen(false)
      setForm({ email: "", name: "", signature: "" })
      toast.success("Sender email added")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Add failed")
    }
  }

  async function handleSaveSignature() {
    if (!selected) return
    try {
      await updateSenderSignature(selected.id, {
        signature_html: form.signature,
      })
      setData((prev) =>
        prev.map((row) =>
          row.id === selected.id
            ? {
                ...row,
                signature: form.signature || null,
                updated_at: new Date().toISOString(),
              }
            : row
        )
      )
      setSignatureOpen(false)
      toast.success("Signature updated")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Update failed")
    }
  }

  async function handleConnect(sender: SenderEmail) {
    try {
      const { authorization_url } = await connectSenderEmail()
      // Pre-select this mailbox in the Google account chooser so the callback
      // (which matches by email) verifies this exact row.
      const url = new URL(authorization_url)
      url.searchParams.set("login_hint", sender.email)
      window.location.href = url.toString()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not start Gmail connect"
      )
    }
  }

  async function handleDelete() {
    if (!selected) return
    if (selected.linked_status === "linked") {
      toast.error(
        `In use by active campaign(s): ${getCampaignNames(selected.linked_campaign_ids)}. Cancel or pause them first, then delete.`
      )
      return
    }
    try {
      await deleteSenderEmail(selected.id)
      setData((prev) => prev.filter((row) => row.id !== selected.id))
      toast.success("Sender email deleted")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed")
    }
  }

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <PageHeader
        title="Sender Emails"
        description="Manage sending inboxes and their campaign availability"
        action={{ label: "Add Email", onClick: () => setAddOpen(true) }}
      />
      <FilterBar
        searchLabel="Search"
        searchPlaceholder="Search by email or domain…"
        searchValue={search}
        onSearchChange={setSearch}
        resultCount={filtered.length}
        resultLabel={filtered.length === 1 ? "sender" : "senders"}
        activeFilterCount={activeFilterCount}
        onClear={clearFilters}
        filters={[
          {
            id: "status",
            label: "Status",
            value: statusFilter,
            options: [
              { label: "All statuses", value: "all" },
              { label: "Free", value: "free" },
              { label: "Linked", value: "linked" },
            ],
            onChange: setStatusFilter,
          },
          {
            id: "verification",
            label: "Verification",
            value: verificationFilter,
            options: [
              { label: "All", value: "all" },
              { label: "Verified", value: "verified" },
              { label: "Not verified", value: "pending_verification" },
            ],
            onChange: setVerificationFilter,
          },
          {
            id: "signature",
            label: "Signature",
            value: signatureFilter,
            options: [
              { label: "All", value: "all" },
              { label: "Set", value: "set" },
              { label: "Not set", value: "not_set" },
            ],
            onChange: setSignatureFilter,
          },
          {
            id: "domain",
            label: "Domain",
            value: domainFilter,
            options: [
              { label: "All domains", value: "all" },
              ...domains.map((domain) => ({ label: domain, value: domain })),
            ],
            onChange: setDomainFilter,
          },
        ]}
      />
      <div className="px-4 lg:px-6">
        <div className="overflow-hidden rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTableHead
                  column="email"
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={toggleSort}
                >
                  Email
                </SortableTableHead>
                <SortableTableHead
                  column="name"
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={toggleSort}
                >
                  Name
                </SortableTableHead>
                <SortableTableHead
                  column="domain"
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={toggleSort}
                >
                  Domain
                </SortableTableHead>
                <SortableTableHead
                  column="domain_name"
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={toggleSort}
                >
                  Domain Name
                </SortableTableHead>
                <SortableTableHead
                  column="verification"
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={toggleSort}
                >
                  Verification
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
                  column="linked_campaigns"
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={toggleSort}
                >
                  Linked Campaigns
                </SortableTableHead>
                <SortableTableHead
                  column="signature"
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={toggleSort}
                >
                  Signature
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
                  onClick={() => openPreview(row)}
                >
                  <TableCell className="font-medium">{row.email}</TableCell>
                  <TableCell>
                    {row.name ? (
                      row.name
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>{row.domain}</TableCell>
                  <TableCell>{row.domain_name}</TableCell>
                  <TableCell>
                    <VerificationBadge status={row.verification_status} />
                  </TableCell>
                  <TableCell>
                    <LinkedStatusBadge status={row.linked_status} />
                  </TableCell>
                  <TableCell>
                    {row.linked_campaign_ids.length > 0 ? (
                      <Badge variant="secondary">
                        {row.linked_campaign_ids.length}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {row.signature ? (
                      <Badge variant="outline">Set</Badge>
                    ) : (
                      <span className="text-muted-foreground">Not set</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(row.created_at)}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button variant="ghost" size="icon-sm" />
                        }
                      >
                        <HugeiconsIcon icon={MoreVerticalCircle01Icon} strokeWidth={2} />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {row.verification_status === "pending_verification" && (
                          <>
                            <DropdownMenuItem
                              onClick={() => handleConnect(row)}
                            >
                              Verify with Gmail
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                          </>
                        )}
                        <DropdownMenuItem
                          onClick={() => {
                            setSelected(row)
                            setForm((f) => ({ ...f, signature: row.signature ?? "" }))
                            setSignatureOpen(true)
                          }}
                        >
                          Signature
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
            <DialogTitle>Add Sender Email</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="outreach@revtrix.in"
              />
              {isDuplicate ? (
                <p className="text-xs text-destructive">
                  This email is already added.
                </p>
              ) : (
                derivedDomain && (
                  <p className="text-xs text-muted-foreground">
                    Domain{" "}
                    <span className="font-medium text-foreground">
                      {derivedDomain.domain}
                    </span>{" "}
                    · {derivedDomain.domain_name}
                  </p>
                )
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Ravi Sharma"
              />
              <p className="text-xs text-muted-foreground">
                Shown as the sender name on outgoing emails.
              </p>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="sig">Signature (optional)</Label>
              <Textarea
                id="sig"
                value={form.signature}
                onChange={(e) => setForm({ ...form, signature: e.target.value })}
                placeholder="Best, {first_name}"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={isDuplicate}>
              Add Email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={signatureOpen} onOpenChange={setSignatureOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Signature — {selected?.email}</DialogTitle>
          </DialogHeader>
          <Textarea
            value={form.signature}
            onChange={(e) => setForm({ ...form, signature: e.target.value })}
            rows={6}
            placeholder="Use tokens: {first_name}, {company}, {role}, {city}"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setSignatureOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveSignature}>Save Signature</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete sender email?"
        description={`This will permanently remove ${selected?.email}. This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />

      <SenderEmailPreviewSheet
        sender={previewSender}
        open={previewOpen}
        onOpenChange={handlePreviewChange}
      />
    </div>
  )
}