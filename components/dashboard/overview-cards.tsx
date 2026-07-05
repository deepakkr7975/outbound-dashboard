import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { campaigns, transactions } from "@/lib/data"
import { formatPercent } from "@/lib/format"
import { HugeiconsIcon } from "@hugeicons/react"
import { ChartUpIcon, Mail01Icon, Message01Icon, Megaphone01Icon } from "@hugeicons/core-free-icons"

const totalSent = transactions.filter((t) => t.sent_at).length
const totalOpened = transactions.filter((t) => t.opened_at).length
const totalReplied = transactions.filter((t) => t.replied_at).length
const activeCampaigns = campaigns.filter(
  (c) => c.status === "sending" || c.status === "scheduled"
).length

const cards = [
  {
    label: "Total Sends",
    value: totalSent.toLocaleString(),
    badge: "+18.2%",
    footer: "Across all campaigns",
    subfooter: "Last 30 days",
    icon: Mail01Icon,
    trend: "up" as const,
    href: "/dashboard/analytics",
  },
  {
    label: "Open Rate",
    value: formatPercent(totalOpened, totalSent),
    badge: "+4.1%",
    footer: "First opens tracked",
    subfooter: `${totalOpened} unique opens`,
    icon: ChartUpIcon,
    trend: "up" as const,
    href: "/dashboard/analytics",
  },
  {
    label: "Reply Rate",
    value: formatPercent(totalReplied, totalSent),
    badge: "+2.3%",
    footer: "Positive engagement",
    subfooter: `${totalReplied} replies received`,
    icon: Message01Icon,
    trend: "up" as const,
    href: "/dashboard/leads",
  },
  {
    label: "Active Campaigns",
    value: activeCampaigns.toString(),
    badge: `${campaigns.length} total`,
    footer: "Sending or scheduled",
    subfooter: "Monitor in Campaigns",
    icon: Megaphone01Icon,
    trend: "up" as const,
    href: "/dashboard/campaigns",
  },
]

export function OverviewCards() {
  return (
    <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card">
      {cards.map((card) => (
        <Link key={card.label} href={card.href} className="transition-opacity hover:opacity-90">
        <Card className="@container/card">
          <CardHeader>
            <CardDescription>{card.label}</CardDescription>
            <CardTitle className="text-3xl font-semibold tabular-nums @[250px]/card:text-4xl">
              {card.value}
            </CardTitle>
            <CardAction>
              <Badge variant="outline">
                <HugeiconsIcon icon={card.icon} strokeWidth={2} />
                {card.badge}
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-base">
            <div className="line-clamp-1 flex gap-2 font-medium">
              {card.footer}
              <HugeiconsIcon icon={ChartUpIcon} strokeWidth={2} className="size-5" />
            </div>
            <div className="text-muted-foreground">{card.subfooter}</div>
          </CardFooter>
        </Card>
        </Link>
      ))}
    </div>
  )
}