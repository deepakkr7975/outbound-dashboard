"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/dashboard/confirm-dialog"
import { DetailRow } from "@/components/dashboard/detail-row"
import { getAudienceById } from "@/lib/data/audiences"
import { campaigns } from "@/lib/data/campaigns"
import { getLeadsByAudience } from "@/lib/data/leads"
import { formatDate } from "@/lib/format"
import type { Lead } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowLeft01Icon,
  CheckmarkCircle01Icon,
  Edit01Icon,
  File01Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons"

export function AudienceDetailPanel({ audienceId }: { audienceId: string }) {
  const router = useRouter()
  const audience = getAudienceById(audienceId)
  const [leads, setLeads] = React.useState<Lead[]>(
    () => getLeadsByAudience(audienceId)
  )
  const [search, setSearch] = React.useState("")
  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  const [removeOpen, setRemoveOpen] = React.useState(false)
  const [editOpen, setEditOpen] = React.useState(false)
  const [meta, setMeta] = React.useState({
    name: audience?.name ?? "",
    description: audience?.description ?? "",
    tags: audience?.tags.join(", ") ?? "",
  })

  const linkedCampaigns = campaigns.filter((c) => c.audience_id === audienceId)
  const contacted = leads.filter((l) => l.emails_sent > 0).length

  const filtered = leads.filter(
    (lead) =>
      lead.name.toLowerCase().includes(search.toLowerCase()) ||
      lead.email.toLowerCase().includes(search.toLowerCase()) ||
      lead.company.toLowerCase().includes(search.toLowerCase())
  )

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(filtered.map((l) => l.id)) : new Set())
  }

  function toggleOne(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  function handleRemove() {
    const count = selected.size
    setLeads((prev) => prev.filter((l) => !selected.has(l.id)))
    setSelected(new Set())
    toast.success(`Removed ${count} lead${count === 1 ? "" : "s"}`)
  }

  function handleSaveMeta() {
    toast.success("Audience updated")
    setEditOpen(false)
  }

  if (!audience) {
    return (
      <div className="flex flex-col items-center gap-4 py-16">
        <p className="text-muted-foreground">Audience not found</p>
        <Button render={<Link href="/dashboard/audiences" />}>
          Back to Audiences
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="flex flex-col gap-4 px-4 lg:px-6">
        <Button
          variant="ghost"
          size="sm"
          className="w-fit"
          render={<Link href="/dashboard/audiences" />}
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
          Back to Audiences
        </Button>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl border bg-muted/50">
              <HugeiconsIcon
                icon={UserGroupIcon}
                strokeWidth={2}
                className="size-6 text-muted-foreground"
              />
            </div>
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">
                {meta.name || audience.name}
              </h2>
              <p className="mt-1 max-w-2xl text-base text-muted-foreground">
                {meta.description || audience.description}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {audience.tags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <HugeiconsIcon icon={Edit01Icon} strokeWidth={2} />
              Edit
            </Button>
            <Button
              render={
                <Link href={`/dashboard/leads?audience=${audience.id}`} />
              }
            >
              View all leads
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 px-4 sm:grid-cols-2 lg:grid-cols-4 lg:px-6">
        <Card className="dark:bg-card">
          <CardHeader className="pb-2">
            <CardDescription>Members</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {leads.length.toLocaleString()}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="dark:bg-card">
          <CardHeader className="pb-2">
            <CardDescription>Contacted</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{contacted}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="dark:bg-card">
          <CardHeader className="pb-2">
            <CardDescription>Campaigns</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {linkedCampaigns.length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="dark:bg-card">
          <CardHeader className="pb-2">
            <CardDescription>Source file</CardDescription>
            <CardTitle className="flex items-center gap-2 text-base font-medium">
              <HugeiconsIcon icon={File01Icon} strokeWidth={2} className="size-4" />
              <span className="truncate">{audience.file_name}</span>
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Tabs defaultValue="members" className="px-4 lg:px-6">
        <TabsList>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="overview">Overview</TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Input
              placeholder="Search members…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
            {selected.size > 0 && (
              <Button variant="destructive" onClick={() => setRemoveOpen(true)}>
                Remove selected ({selected.size})
              </Button>
            )}
          </div>
          <div className="overflow-hidden rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={
                        filtered.length > 0 &&
                        filtered.every((l) => selected.has(l.id))
                      }
                      onCheckedChange={(c) => toggleAll(!!c)}
                    />
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>Emails Sent</TableHead>
                  <TableHead>Added</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="h-24 text-center text-muted-foreground"
                    >
                      No members match your search
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((lead) => (
                    <TableRow
                      key={lead.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/dashboard/leads/${lead.id}`)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selected.has(lead.id)}
                          onCheckedChange={(c) => toggleOne(lead.id, !!c)}
                        />
                      </TableCell>
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
                        {lead.emails_sent > 0 ? (
                          <Badge variant="outline" className="gap-1">
                            <HugeiconsIcon
                              icon={CheckmarkCircle01Icon}
                              strokeWidth={2}
                              className="size-3"
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
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="overview" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="dark:bg-card">
              <CardHeader>
                <CardTitle className="text-lg">Details</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2.5">
                <DetailRow label="Created" value={formatDate(audience.created_at)} />
                <DetailRow label="Updated" value={formatDate(audience.updated_at)} />
                <DetailRow label="Source file" value={audience.file_name} />
                <DetailRow label="Total members" value={leads.length} />
              </CardContent>
            </Card>

            <Card className="dark:bg-card">
              <CardHeader>
                <CardTitle className="text-lg">Linked campaigns</CardTitle>
                <CardDescription>
                  Campaigns using this audience
                </CardDescription>
              </CardHeader>
              <CardContent>
                {linkedCampaigns.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No campaigns linked yet
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {linkedCampaigns.map((c) => (
                      <Button
                        key={c.campaign_id}
                        variant="outline"
                        size="sm"
                        className="h-auto justify-start py-2"
                        render={
                          <Link href={`/dashboard/campaigns/${c.campaign_id}`} />
                        }
                      >
                        {c.name}
                      </Button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit audience</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="aud-name">Name</Label>
              <Input
                id="aud-name"
                value={meta.name}
                onChange={(e) => setMeta({ ...meta, name: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="aud-desc">Description</Label>
              <Input
                id="aud-desc"
                value={meta.description}
                onChange={(e) =>
                  setMeta({ ...meta, description: e.target.value })
                }
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="aud-tags">Tags (comma-separated)</Label>
              <Input
                id="aud-tags"
                value={meta.tags}
                onChange={(e) => setMeta({ ...meta, tags: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveMeta}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        title="Remove selected leads?"
        description={`This will remove ${selected.size} lead(s) from this audience. Transaction history is preserved.`}
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={handleRemove}
      />
    </div>
  )
}