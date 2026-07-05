"use client"

import * as React from "react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { notifications as initialNotifications } from "@/lib/data/notifications"
import { formatDateTime } from "@/lib/format"
import { cn } from "@/lib/utils"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  AlertCircleIcon,
  Mail01Icon,
  Message01Icon,
  Notification03Icon,
  Settings05Icon,
} from "@hugeicons/core-free-icons"

const typeStyles = {
  campaign: "bg-primary/15 text-primary",
  reply: "bg-emerald-500/15 text-emerald-400",
  bounce: "bg-destructive/15 text-destructive",
  system: "bg-muted text-muted-foreground",
}

const typeIcons = {
  campaign: Mail01Icon,
  reply: Message01Icon,
  bounce: AlertCircleIcon,
  system: Settings05Icon,
}

export function NotificationsMenu() {
  const [items, setItems] = React.useState(initialNotifications)
  const [open, setOpen] = React.useState(false)
  const unread = items.filter((n) => !n.read).length
  const unreadItems = items.filter((n) => !n.read)
  const readItems = items.filter((n) => n.read)

  function markAllRead() {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  function markRead(id: string) {
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    )
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-lg"
            className="relative"
            aria-label={
              unread > 0
                ? `Notifications, ${unread} unread`
                : "Notifications"
            }
          />
        }
      >
        <HugeiconsIcon icon={Notification03Icon} strokeWidth={2} className="size-6" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex min-w-5 items-center justify-center rounded-full bg-primary px-1 py-0.5 text-[10px] font-semibold text-primary-foreground ring-2 ring-background">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <p className="text-sm font-semibold">Notifications</p>
            <p className="text-xs text-muted-foreground">
              {unread > 0
                ? `${unread} unread message${unread === 1 ? "" : "s"}`
                : "You're all caught up"}
            </p>
          </div>
          {unread > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={markAllRead}
            >
              Mark all read
            </Button>
          )}
        </div>

        <div className="max-h-80 overflow-y-auto">
          {items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
              <HugeiconsIcon
                icon={Notification03Icon}
                strokeWidth={2}
                className="size-8 text-muted-foreground/50"
              />
              <p className="text-sm text-muted-foreground">No notifications yet</p>
            </div>
          ) : (
            <>
              {unreadItems.length > 0 && (
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="px-4 pt-3 text-xs text-muted-foreground">
                    New
                  </DropdownMenuLabel>
                  {unreadItems.map((notif) => (
                    <NotificationItem
                      key={notif.id}
                      notif={notif}
                      onRead={() => markRead(notif.id)}
                    />
                  ))}
                </DropdownMenuGroup>
              )}
              {readItems.length > 0 && (
                <DropdownMenuGroup>
                  {unreadItems.length > 0 && <DropdownMenuSeparator />}
                  <DropdownMenuLabel className="px-4 pt-2 text-xs text-muted-foreground">
                    Earlier
                  </DropdownMenuLabel>
                  {readItems.map((notif) => (
                    <NotificationItem
                      key={notif.id}
                      notif={notif}
                      onRead={() => markRead(notif.id)}
                    />
                  ))}
                </DropdownMenuGroup>
              )}
            </>
          )}
        </div>

        <div className="border-t px-4 py-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-full justify-center text-xs"
            render={<Link href="/dashboard/settings" />}
            onClick={() => setOpen(false)}
          >
            Notification settings
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function NotificationItem({
  notif,
  onRead,
}: {
  notif: (typeof initialNotifications)[number]
  onRead: () => void
}) {
  const Icon = typeIcons[notif.type]

  return (
    <DropdownMenuItem
      className={cn(
        "mx-1 mb-1 flex cursor-pointer items-start gap-3 rounded-lg px-3 py-3",
        !notif.read && "bg-primary/5"
      )}
      onClick={onRead}
    >
      <div
        className={cn(
          "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md",
          typeStyles[notif.type]
        )}
      >
        <HugeiconsIcon icon={Icon} strokeWidth={2} className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <span className="text-sm font-medium leading-snug">{notif.title}</span>
          {!notif.read && (
            <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" />
          )}
        </div>
        <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
          {notif.message}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {formatDateTime(notif.time)}
        </p>
      </div>
    </DropdownMenuItem>
  )
}