"use client"

import { useRouter } from "next/navigation"

import { CampaignStatusBadge } from "@/components/dashboard/status-badge"
import { useLiveData } from "@/hooks/use-live-data"
import { campaigns, transactions } from "@/lib/data"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export function DashboardOverviewTables() {
  const router = useRouter()
  useLiveData()
  const recentCampaigns = campaigns.slice(0, 3)
  const recentTxns = transactions.slice(0, 5)

  return (
    <div className="grid gap-4 px-4 lg:grid-cols-2 lg:px-6">
      <div>
        <h3 className="mb-3 text-lg font-medium">Active Campaigns</h3>
        <div className="overflow-hidden rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Progress</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentCampaigns.map((c) => (
                <TableRow
                  key={c.campaign_id}
                  className="cursor-pointer"
                  onClick={() =>
                    router.push(`/dashboard/campaigns/${c.campaign_id}`)
                  }
                >
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>
                    <CampaignStatusBadge status={c.status} />
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {c.sent_count}/{c.total_count}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
      <div>
        <h3 className="mb-3 text-lg font-medium">Recent Transactions</h3>
        <div className="overflow-hidden rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lead</TableHead>
                <TableHead>Step</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentTxns.map((t) => (
                <TableRow
                  key={t.transaction_id}
                  className="cursor-pointer"
                  onClick={() =>
                    router.push(`/dashboard/leads/${t.lead_id}`)
                  }
                >
                  <TableCell className="font-medium">
                    {t.SK.split("#")[1]}
                  </TableCell>
                  <TableCell>{t.step_order}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {t.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}