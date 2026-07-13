"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"

import { TransactionPreviewSheet } from "@/components/modules/transaction-preview-sheet"
import { ExportButton } from "@/components/dashboard/export-button"
import { FilterBar } from "@/components/dashboard/filter-bar"
import { PageHeader } from "@/components/dashboard/page-header"
import { TransactionStatusBadge } from "@/components/dashboard/status-badge"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { cn } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { campaigns } from "@/lib/data/campaigns"
import { sequences, getSequenceById } from "@/lib/data/sequences"
import { useExports } from "@/hooks/use-exports"
import { useLiveData } from "@/hooks/use-live-data"
import { useUrlPreview } from "@/hooks/use-url-preview"
import { buildAnalyticsExport } from "@/lib/exports/builders"
import { getTransactionById, transactions } from "@/lib/data/transactions"
import type { EmailTransaction } from "@/lib/types"
import { formatDateTime, formatPercent } from "@/lib/format"
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts"

const chartConfig = {
  sent: { label: "Sent", color: "var(--chart-1)" },
  opened: { label: "Opened", color: "var(--chart-2)" },
  replied: { label: "Replied", color: "var(--chart-4)" },
} satisfies ChartConfig

const distributionConfig = {
  sent: { label: "Sent", color: "var(--chart-1)" },
  delivered: { label: "Delivered", color: "var(--chart-2)" },
  opened: { label: "Opened", color: "var(--chart-3)" },
  clicked: { label: "Clicked", color: "var(--chart-4)" },
  replied: { label: "Replied", color: "var(--chart-5)" },
  bounced: { label: "Bounced", color: "hsl(var(--destructive))" },
} satisfies ChartConfig

export function AnalyticsPanel() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { previewId, setPreviewId } = useUrlPreview()
  const { addExport } = useExports()
  const { version } = useLiveData()
  const [campaignFilter, setCampaignFilter] = React.useState(
    () => searchParams.get("campaign") ?? "camp_winter"
  )
  const [statusFilter, setStatusFilter] = React.useState("all")
  const [stepFilter, setStepFilter] = React.useState("all")
  const [previewTxn, setPreviewTxn] = React.useState<EmailTransaction | null>(null)
  const [previewOpen, setPreviewOpen] = React.useState(false)

  React.useEffect(() => {
    const campaign = searchParams.get("campaign")
    if (campaign) setCampaignFilter(campaign)
  }, [searchParams])

  React.useEffect(() => {
    if (previewId) {
      const txn = getTransactionById(previewId)
      if (txn) {
        setPreviewTxn(txn)
        setPreviewOpen(true)
      }
    }
  }, [previewId, version])

  function openPreview(txn: EmailTransaction) {
    setPreviewTxn(txn)
    setPreviewOpen(true)
    setPreviewId(txn.transaction_id)
  }

  function handlePreviewChange(open: boolean) {
    setPreviewOpen(open)
    if (!open) setPreviewId(null)
  }

  const campaignTxns = transactions.filter(
    (t) => t.campaign_id === campaignFilter
  )
  const sequence = getSequenceById(
    campaigns.find((c) => c.campaign_id === campaignFilter)?.sequence_id ?? ""
  )

  const sent = campaignTxns.filter((t) => t.sent_at).length
  const delivered = campaignTxns.filter((t) => t.delivered_at).length
  const opened = campaignTxns.filter((t) => t.opened_at).length
  const clicked = campaignTxns.filter((t) => t.clicked_at).length
  const replied = campaignTxns.filter((t) => t.replied_at).length
  const bounced = campaignTxns.filter((t) => t.bounced_at).length

  const funnelData = sequence
    ? Object.entries(sequence.sequence_steps).map(([step, count]) => ({
        step: step.replace("email ", "Email "),
        sent: count,
        opened: Math.round(count * 0.45),
        replied: Math.round(count * 0.08),
      }))
    : []

  const filteredTxns = campaignTxns.filter((t) => {
    const matchesStatus = statusFilter === "all" || t.status === statusFilter
    const matchesStep =
      stepFilter === "all" || t.step_order === Number(stepFilter)
    return matchesStatus && matchesStep
  })

  const abStats = sequence?.has_ab_testing
    ? (["A", "B"] as const).map((variant) => {
        const variantTxns = campaignTxns.filter((t) => t.variant === variant)
        const vSent = variantTxns.length
        const vOpened = variantTxns.filter((t) => t.opened_at).length
        const vReplied = variantTxns.filter((t) => t.replied_at).length
        return {
          variant,
          sent: vSent,
          openRate: formatPercent(vOpened, vSent),
          replyRate: formatPercent(vReplied, vSent),
        }
      })
    : []

  const stats = [
    { key: "sent", label: "Sent", count: sent, pct: "100%" },
    { key: "delivered", label: "Delivered", count: delivered, pct: formatPercent(delivered, sent) },
    { key: "opened", label: "Opened", count: opened, pct: formatPercent(opened, sent) },
    { key: "clicked", label: "Clicked", count: clicked, pct: formatPercent(clicked, sent) },
    { key: "replied", label: "Replied", count: replied, pct: formatPercent(replied, sent) },
    { key: "bounced", label: "Bounced", count: bounced, pct: formatPercent(bounced, sent) },
  ]

  const distributionData = stats
    .filter((s) => s.count > 0)
    .map((s) => ({
      metric: s.key,
      value: s.count,
      fill: `var(--color-${s.key})`,
    }))

  function handleExport() {
    addExport(buildAnalyticsExport(campaignFilter, statusFilter, stepFilter))
    toast.success("Analytics report saved to Export", {
      action: {
        label: "View",
        onClick: () => router.push("/dashboard/export"),
      },
    })
  }

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <PageHeader
        title="Analytics"
        description="Campaign performance, step funnels, and transaction logs"
        actions={<ExportButton onClick={handleExport} />}
      />
      <div className="px-4 lg:px-6">
        <Select value={campaignFilter} onValueChange={(v) => setCampaignFilter(v ?? "camp_winter")}>
          <SelectTrigger className="w-full sm:w-64">
            <SelectValue placeholder="Select campaign" />
          </SelectTrigger>
          <SelectContent>
            {campaigns.map((c) => (
              <SelectItem key={c.campaign_id} value={c.campaign_id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="px-4 lg:px-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="dark:bg-card">
            <CardHeader className="pb-3">
              <CardTitle>Campaign metrics</CardTitle>
              <CardDescription>
                Engagement breakdown for the selected campaign
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 overflow-hidden rounded-xl border bg-muted/20">
                {stats.map((stat, index) => (
                  <div
                    key={stat.label}
                    className={cn(
                      "flex flex-col gap-2 p-5",
                      index % 2 === 0 && "border-r border-border",
                      index < 4 && "border-b border-border"
                    )}
                  >
                    <p className="text-sm font-medium text-muted-foreground">
                      {stat.label}
                    </p>
                    <p className="text-3xl font-semibold tabular-nums">
                      {stat.count}
                    </p>
                    <Badge variant="outline" className="w-fit">
                      {stat.pct}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="dark:bg-card">
            <CardHeader>
              <CardTitle>Metric distribution</CardTitle>
              <CardDescription>
                Share of each engagement metric for the selected campaign
              </CardDescription>
            </CardHeader>
            <CardContent>
              {distributionData.length > 0 ? (
                <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
                  <ChartContainer
                    config={distributionConfig}
                    className="mx-auto aspect-square h-[260px] w-full max-w-[260px] shrink-0"
                  >
                    <PieChart>
                      <ChartTooltip
                        content={
                          <ChartTooltipContent
                            hideLabel
                            nameKey="metric"
                          />
                        }
                      />
                      <Pie
                        data={distributionData}
                        dataKey="value"
                        nameKey="metric"
                        innerRadius="42%"
                        outerRadius="70%"
                        paddingAngle={2}
                        strokeWidth={2}
                      >
                        {distributionData.map((entry) => (
                          <Cell key={entry.metric} fill={entry.fill} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ChartContainer>

                  <ul className="flex min-w-0 flex-1 flex-col gap-3">
                    {stats
                      .filter((s) => s.count > 0)
                      .map((stat) => {
                        const total = stats.reduce((sum, s) => sum + s.count, 0)
                        const share =
                          total > 0
                            ? ((stat.count / total) * 100).toFixed(1)
                            : "0"
                        return (
                          <li
                            key={stat.key}
                            className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 px-3 py-2.5"
                          >
                            <div className="flex items-center gap-2.5">
                              <span
                                className="size-3 shrink-0 rounded-full"
                                style={{
                                  backgroundColor: `var(--color-${stat.key})`,
                                }}
                              />
                              <span className="text-sm font-medium">
                                {stat.label}
                              </span>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-semibold tabular-nums">
                                {stat.count}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {share}%
                              </p>
                            </div>
                          </li>
                        )
                      })}
                  </ul>
                </div>
              ) : (
                <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
                  No metrics to display for this campaign
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {funnelData.length > 0 && (
        <div className="px-4 lg:px-6">
          <Card className="dark:bg-card">
            <CardHeader>
              <CardTitle>Step Funnel</CardTitle>
              <CardDescription>
                Sends per step · Sequence completion:{" "}
                {sequence?.sequence_completion ?? 0} leads
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
                <BarChart data={funnelData}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="step"
                    tickLine={false}
                    axisLine={false}
                    tick={{
                      fill: "hsl(var(--foreground))",
                      fontSize: 14,
                      fontWeight: 600,
                    }}
                  />
                  <YAxis tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="sent" fill="var(--color-sent)" radius={4} />
                  <Bar dataKey="opened" fill="var(--color-opened)" radius={4} />
                  <Bar dataKey="replied" fill="var(--color-replied)" radius={4} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {abStats.length > 0 && (
        <div className="px-4 lg:px-6">
          <Card className="dark:bg-card">
            <CardHeader>
              <CardTitle>A/B Comparison</CardTitle>
              <CardDescription>Open and reply rates by variant</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Variant</TableHead>
                      <TableHead>Sent</TableHead>
                      <TableHead>Open Rate</TableHead>
                      <TableHead>Reply Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {abStats.map((row) => (
                      <TableRow key={row.variant}>
                        <TableCell>
                          <Badge variant="secondary">Variant {row.variant}</Badge>
                        </TableCell>
                        <TableCell>{row.sent}</TableCell>
                        <TableCell>{row.openRate}</TableCell>
                        <TableCell>{row.replyRate}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex flex-col gap-4 px-4 lg:px-6">
        <h3 className="text-lg font-medium">Transaction Log</h3>
        <FilterBar
          filters={[
            {
              id: "status",
              label: "Status",
              value: statusFilter,
              options: [
                { label: "All statuses", value: "all" },
                { label: "Sent", value: "sent" },
                { label: "Delivered", value: "delivered" },
                { label: "Opened", value: "opened" },
                { label: "Clicked", value: "clicked" },
                { label: "Replied", value: "replied" },
                { label: "Bounced", value: "bounced" },
              ],
              onChange: setStatusFilter,
            },
            {
              id: "step",
              label: "Step",
              value: stepFilter,
              options: [
                { label: "All steps", value: "all" },
                ...Array.from(
                  new Set(campaignTxns.map((t) => t.step_order))
                ).map((s) => ({ label: `Step ${s}`, value: String(s) })),
              ],
              onChange: setStepFilter,
            },
          ]}
        />
        <div className="overflow-hidden rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lead</TableHead>
                <TableHead>Step</TableHead>
                <TableHead>Variant</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sent At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTxns.map((txn) => (
                <TableRow
                  key={txn.transaction_id}
                  className="cursor-pointer"
                  onClick={() => openPreview(txn)}
                >
                  <TableCell className="font-medium">{txn.SK.split("#")[1]}</TableCell>
                  <TableCell>{txn.step_order}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{txn.variant}</Badge>
                  </TableCell>
                  <TableCell className="max-w-48 truncate text-muted-foreground">
                    {txn.subject_line}
                  </TableCell>
                  <TableCell>
                    <TransactionStatusBadge status={txn.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {txn.sent_at ? formatDateTime(txn.sent_at) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <TransactionPreviewSheet
        transaction={previewTxn}
        open={previewOpen}
        onOpenChange={handlePreviewChange}
      />
    </div>
  )
}