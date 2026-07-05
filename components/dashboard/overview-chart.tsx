"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"

import {
  Card,
  CardAction,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group"
import { Button } from "@/components/ui/button"
import { useIsMobile } from "@/hooks/use-mobile"
import {
  chartActivity,
  filterChartByRange,
  getPresetRange,
} from "@/lib/data/chart-activity"
import { formatDate } from "@/lib/format"
import { HugeiconsIcon } from "@hugeicons/react"
import { Calendar01Icon } from "@hugeicons/core-free-icons"

const chartConfig = {
  sends: { label: "Sends", color: "var(--chart-1)" },
  opens: { label: "Opens", color: "var(--chart-2)" },
  replies: { label: "Replies", color: "var(--chart-4)" },
} satisfies ChartConfig

type TimeRange = "30d" | "14d" | "7d" | "custom"

const REFERENCE_DATE = "2026-07-04"

export function OverviewChart() {
  const isMobile = useIsMobile()
  const [timeRange, setTimeRange] = React.useState<TimeRange>("30d")
  const [customStart, setCustomStart] = React.useState("2026-06-01")
  const [customEnd, setCustomEnd] = React.useState(REFERENCE_DATE)
  const [appliedCustom, setAppliedCustom] = React.useState({
    start: "2026-06-01",
    end: REFERENCE_DATE,
  })
  const [customOpen, setCustomOpen] = React.useState(false)

  const filtered = React.useMemo(() => {
    if (timeRange === "custom") {
      return filterChartByRange(
        chartActivity,
        appliedCustom.start,
        appliedCustom.end
      )
    }
    const { start, end } = getPresetRange(timeRange, REFERENCE_DATE)
    return filterChartByRange(chartActivity, start, end)
  }, [timeRange, appliedCustom])

  const rangeLabel =
    timeRange === "custom"
      ? `${formatDate(appliedCustom.start)} – ${formatDate(appliedCustom.end)}`
      : timeRange === "30d"
        ? "Last 30 days"
        : timeRange === "14d"
          ? "Last 14 days"
          : "Last 7 days"

  function applyCustomRange() {
    if (customStart && customEnd && customStart <= customEnd) {
      setAppliedCustom({ start: customStart, end: customEnd })
      setTimeRange("custom")
      setCustomOpen(false)
    }
  }

  return (
    <Card className="@container/card dark:bg-card">
      <CardHeader>
        <CardTitle>Email Activity</CardTitle>
        <CardDescription>
          Sends, opens, and replies across all campaigns · {rangeLabel}
        </CardDescription>
        <CardAction>
          <ToggleGroup
            multiple={false}
            value={timeRange !== "custom" && timeRange ? [timeRange] : []}
            onValueChange={(value) => {
              const next = value[0] as TimeRange | undefined
              if (next && next !== "custom") setTimeRange(next)
            }}
            variant="outline"
            className="hidden *:data-[slot=toggle-group-item]:px-3! @[900px]/card:flex"
          >
            <ToggleGroupItem value="30d">30 days</ToggleGroupItem>
            <ToggleGroupItem value="14d">14 days</ToggleGroupItem>
            <ToggleGroupItem value="7d">7 days</ToggleGroupItem>
            <Dialog open={customOpen} onOpenChange={setCustomOpen}>
              <DialogTrigger
                render={
                  <ToggleGroupItem
                    value="custom"
                    data-state={timeRange === "custom" ? "on" : "off"}
                    onClick={() => setTimeRange("custom")}
                  />
                }
              >
                <HugeiconsIcon icon={Calendar01Icon} strokeWidth={2} className="size-4" />
                Custom
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Custom date range</DialogTitle>
                  <DialogDescription>
                    Choose start and end dates for the activity chart.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-2">
                  <div className="grid gap-1.5">
                    <Label htmlFor="chart-start">Start date</Label>
                    <Input
                      id="chart-start"
                      type="date"
                      value={customStart}
                      onChange={(e) => setCustomStart(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="chart-end">End date</Label>
                    <Input
                      id="chart-end"
                      type="date"
                      value={customEnd}
                      onChange={(e) => setCustomEnd(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCustomOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={applyCustomRange}>Apply range</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </ToggleGroup>

          <div className="flex gap-2 @[900px]/card:hidden">
            <Select
              value={timeRange === "custom" ? "30d" : timeRange}
              onValueChange={(v) => v && setTimeRange(v as TimeRange)}
            >
              <SelectTrigger
                className="flex w-32 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate"
                size="sm"
              >
                <SelectValue placeholder="Range" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="30d" className="rounded-lg">
                  30 days
                </SelectItem>
                <SelectItem value="14d" className="rounded-lg">
                  14 days
                </SelectItem>
                <SelectItem value="7d" className="rounded-lg">
                  7 days
                </SelectItem>
              </SelectContent>
            </Select>
            <Dialog open={customOpen} onOpenChange={setCustomOpen}>
              <DialogTrigger
                render={
                  <Button
                    variant={timeRange === "custom" ? "default" : "outline"}
                    size="sm"
                  />
                }
              >
                <HugeiconsIcon icon={Calendar01Icon} strokeWidth={2} />
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Custom date range</DialogTitle>
                  <DialogDescription>
                    Choose start and end dates for the activity chart.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-2">
                  <div className="grid gap-1.5">
                    <Label htmlFor="chart-start-m">Start date</Label>
                    <Input
                      id="chart-start-m"
                      type="date"
                      value={customStart}
                      onChange={(e) => setCustomStart(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="chart-end-m">End date</Label>
                    <Input
                      id="chart-end-m"
                      type="date"
                      value={customEnd}
                      onChange={(e) => setCustomEnd(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCustomOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={applyCustomRange}>Apply range</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[280px] w-full"
        >
          <AreaChart data={filtered}>
            <defs>
              <linearGradient id="fillSends" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-sends)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-sends)"
                  stopOpacity={0.1}
                />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={isMobile ? 20 : 32}
              tickFormatter={(value) =>
                new Date(value).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })
              }
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(value) =>
                    new Date(value).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })
                  }
                  indicator="dot"
                />
              }
            />
            <Area
              dataKey="sends"
              type="natural"
              fill="url(#fillSends)"
              stroke="var(--color-sends)"
              stackId="a"
            />
            <Area
              dataKey="opens"
              type="natural"
              fill="var(--color-opens)"
              fillOpacity={0.3}
              stroke="var(--color-opens)"
              stackId="b"
            />
            <Area
              dataKey="replies"
              type="natural"
              fill="var(--color-replies)"
              fillOpacity={0.3}
              stroke="var(--color-replies)"
              stackId="c"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}