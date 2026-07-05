"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  DashboardSquare01Icon,
  Mail01Icon,
  UserGroupIcon,
  Contact01Icon,
  LeftToRightListBulletIcon,
  Megaphone01Icon,
  Analytics01Icon,
  CommandIcon,
  FileExportIcon,
} from "@hugeicons/core-free-icons"

const navItems = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: DashboardSquare01Icon,
  },
  {
    title: "Sender Emails",
    url: "/dashboard/sender-emails",
    icon: Mail01Icon,
  },
  {
    title: "Audiences",
    url: "/dashboard/audiences",
    icon: UserGroupIcon,
  },
  {
    title: "Leads",
    url: "/dashboard/leads",
    icon: Contact01Icon,
  },
  {
    title: "Sequences",
    url: "/dashboard/sequences",
    icon: LeftToRightListBulletIcon,
  },
  {
    title: "Campaigns",
    url: "/dashboard/campaigns",
    icon: Megaphone01Icon,
  },
  {
    title: "Analytics",
    url: "/dashboard/analytics",
    icon: Analytics01Icon,
  },
  {
    title: "Export",
    url: "/dashboard/export",
    icon: FileExportIcon,
  },
]

const user = {
  name: "Alex Morgan",
  email: "alex@revtrix.in",
  avatar: "/avatars/shadcn.jpg",
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="data-[slot=sidebar-menu-button]:p-1.5!"
              render={<Link href="/dashboard" />}
            >
              <HugeiconsIcon icon={CommandIcon} strokeWidth={2} className="size-6!" />
              <span className="text-lg font-semibold">Revtrix</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive =
                  item.url === "/dashboard"
                    ? pathname === "/dashboard"
                    : pathname.startsWith(item.url)
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      tooltip={item.title}
                      isActive={isActive}
                      size="default"
                      className="text-[0.9375rem]"
                      render={<Link href={item.url} />}
                    >
                      <HugeiconsIcon icon={item.icon} strokeWidth={2} />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}