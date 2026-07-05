"use client"

import Link from "next/link"

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  formatCompactCount,
  getHeaderEmailStats,
} from "@/lib/data/header-email-stats"
import { cn } from "@/lib/utils"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  CalendarClockIcon,
  DeliveredSentIcon,
  SentIcon,
} from "@hugeicons/core-free-icons"

const stats = getHeaderEmailStats()

const items = [
  {
    key: "sent",
    label: "Emails sent",
    value: stats.sent,
    icon: SentIcon,
    tone: "text-blue-400",
    badge: "bg-blue-500/15 text-blue-300",
  },
  {
    key: "scheduled",
    label: "Emails scheduled",
    value: stats.scheduled,
    icon: CalendarClockIcon,
    tone: "text-amber-400",
    badge: "bg-amber-500/15 text-amber-300",
  },
  {
    key: "delivered",
    label: "Emails delivered",
    value: stats.delivered,
    icon: DeliveredSentIcon,
    tone: "text-emerald-400",
    badge: "bg-emerald-500/15 text-emerald-300",
  },
] as const

export function HeaderEmailStats() {
  return (
    <div className="hidden items-center gap-0.5 sm:flex">
      {items.map((item) => (
        <Tooltip key={item.key}>
          <TooltipTrigger
            render={
              <Link
                href="/dashboard/analytics"
                className="flex min-w-12 flex-col items-center gap-1 rounded-md px-2.5 py-2 transition-colors hover:bg-muted/60"
              />
            }
          >
            <span
              className={cn(
                "rounded px-1.5 py-0.5 text-xs font-semibold tabular-nums leading-none",
                item.badge
              )}
            >
              {formatCompactCount(item.value)}
            </span>
            <HugeiconsIcon
              icon={item.icon}
              strokeWidth={2}
              className={cn("size-5", item.tone)}
            />
            <span className="sr-only">
              {item.label}: {item.value.toLocaleString()}
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p className="font-medium">{item.label}</p>
            <p className="text-muted-foreground">
              {item.value.toLocaleString()} total
            </p>
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  )
}