import { OverviewCards } from "@/components/dashboard/overview-cards"
import { OverviewChart } from "@/components/dashboard/overview-chart"
import { PageHeader } from "@/components/dashboard/page-header"
import { DashboardOverviewTables } from "@/components/modules/dashboard-overview-tables"

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <PageHeader
        title="Overview"
        description="Monitor outbound performance, campaigns, and recent activity"
      />
      <OverviewCards />
      <div className="px-4 lg:px-6">
        <OverviewChart />
      </div>
      <DashboardOverviewTables />
    </div>
  )
}