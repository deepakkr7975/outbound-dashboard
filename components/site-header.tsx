"use client"

import { usePathname } from "next/navigation"

import { HeaderEmailStats } from "@/components/dashboard/header-email-stats"
import { NotificationsMenu } from "@/components/dashboard/notifications-menu"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/dashboard/sender-emails": "Sender Emails",
  "/dashboard/audiences": "Audiences",
  "/dashboard/leads": "Leads",
  "/dashboard/sequences": "Sequences",
  "/dashboard/campaigns": "Campaigns",
  "/dashboard/analytics": "Analytics",
  "/dashboard/export": "Export",
  "/dashboard/account": "Account",
  "/dashboard/settings": "Settings",
}

function getPageTitle(pathname: string): string {
  if (pageTitles[pathname]) return pageTitles[pathname]
  if (pathname.startsWith("/dashboard/leads/")) return "Lead Details"
  if (pathname.startsWith("/dashboard/campaigns/")) return "Campaign Details"
  if (pathname.startsWith("/dashboard/audiences/")) return "Audience Details"
  if (pathname.includes("/sequences/") && pathname.endsWith("/edit")) {
    return "Sequence Builder"
  }
  if (pathname.startsWith("/dashboard/sequences/new")) return "New Sequence"
  if (pathname.startsWith("/dashboard/sequences/")) return "Sequence Details"
  return "Dashboard"
}

export function SiteHeader() {
  const pathname = usePathname()
  const title = getPageTitle(pathname)

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-2 px-4 lg:gap-3 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-1 h-5 data-vertical:self-auto"
        />
        <h1 className="text-lg font-medium">{title}</h1>
        <Badge variant="outline" className="ml-1 hidden text-sm sm:inline-flex">
          revtrix.in
        </Badge>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <HeaderEmailStats />
          <NotificationsMenu />
        </div>
      </div>
    </header>
  )
}