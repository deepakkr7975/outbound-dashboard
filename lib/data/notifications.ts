import notificationsData from "@/data/notifications.json"

export interface Notification {
  id: string
  title: string
  message: string
  time: string
  read: boolean
  type: "campaign" | "reply" | "bounce" | "system"
}

export const notifications = notificationsData as Notification[]