import { Badge } from "@/components/ui/badge"
import type { CampaignStatus, LinkedStatus, TransactionStatus } from "@/lib/types"
import { cn } from "@/lib/utils"

const campaignStyles: Record<CampaignStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  scheduled: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  sending: "bg-primary/15 text-primary border-primary/30",
  completed: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  paused: "bg-amber-500/15 text-amber-400 border-amber-500/30",
}

const linkedStyles: Record<LinkedStatus, string> = {
  free: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  linked: "bg-blue-500/15 text-blue-400 border-blue-500/30",
}

const transactionStyles: Record<TransactionStatus, string> = {
  queued: "bg-muted text-muted-foreground",
  sent: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  delivered: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  opened: "bg-primary/15 text-primary border-primary/30",
  clicked: "bg-violet-500/15 text-violet-400 border-violet-500/30",
  replied: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  bounced: "bg-destructive/15 text-destructive border-destructive/30",
  failed: "bg-destructive/15 text-destructive border-destructive/30",
  unsubscribed: "bg-amber-500/15 text-amber-400 border-amber-500/30",
}

export function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  return (
    <Badge variant="outline" className={cn("capitalize", campaignStyles[status])}>
      {status}
    </Badge>
  )
}

export function LinkedStatusBadge({ status }: { status: LinkedStatus }) {
  return (
    <Badge variant="outline" className={cn("capitalize", linkedStyles[status])}>
      {status === "free" ? "🟢 Free" : "🔵 Linked"}
    </Badge>
  )
}

export function TransactionStatusBadge({ status }: { status: TransactionStatus }) {
  return (
    <Badge variant="outline" className={cn("capitalize", transactionStyles[status])}>
      {status}
    </Badge>
  )
}