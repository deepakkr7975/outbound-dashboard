"use client"

import * as React from "react"
import { toast } from "sonner"

import { PageHeader } from "@/components/dashboard/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Checkbox } from "@/components/ui/checkbox"

export function SettingsPanel() {
  const [timezone, setTimezone] = React.useState("America/New_York")
  const [prefs, setPrefs] = React.useState({
    emailReplies: true,
    campaignComplete: true,
    bounces: true,
    weeklyDigest: false,
    desktopNotifications: true,
  })

  function togglePref(key: keyof typeof prefs) {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  function handleSave() {
    toast.success("Settings saved")
  }

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <PageHeader
        title="Settings"
        description="Configure notifications, timezone, and dashboard preferences"
      />

      <div className="grid gap-4 px-4 lg:max-w-3xl lg:px-6">
        <Card className="dark:bg-card">
          <CardHeader>
            <CardTitle>General</CardTitle>
            <CardDescription>Timezone and regional preferences</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid max-w-sm gap-1.5">
              <Label htmlFor="timezone">Default timezone</Label>
              <Select value={timezone} onValueChange={(v) => setTimezone(v ?? timezone)}>
                <SelectTrigger id="timezone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="America/New_York">
                    Eastern (America/New_York)
                  </SelectItem>
                  <SelectItem value="America/Los_Angeles">
                    Pacific (America/Los_Angeles)
                  </SelectItem>
                  <SelectItem value="Europe/London">
                    London (Europe/London)
                  </SelectItem>
                  <SelectItem value="Asia/Kolkata">
                    India (Asia/Kolkata)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card className="dark:bg-card">
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
            <CardDescription>Choose what you want to be notified about</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {(
              [
                {
                  key: "emailReplies" as const,
                  label: "Email replies",
                  desc: "When a lead replies to a campaign email",
                },
                {
                  key: "campaignComplete" as const,
                  label: "Campaign completion",
                  desc: "When a campaign finishes sending all steps",
                },
                {
                  key: "bounces" as const,
                  label: "Bounces",
                  desc: "Hard and soft bounce alerts",
                },
                {
                  key: "weeklyDigest" as const,
                  label: "Weekly digest",
                  desc: "Summary of sends, opens, and replies",
                },
                {
                  key: "desktopNotifications" as const,
                  label: "Desktop notifications",
                  desc: "Browser push notifications for urgent events",
                },
              ] as const
            ).map((item, i, arr) => (
              <React.Fragment key={item.key}>
                <label className="flex cursor-pointer items-start gap-3">
                  <Checkbox
                    checked={prefs[item.key]}
                    onCheckedChange={() => togglePref(item.key)}
                    className="mt-0.5"
                  />
                  <div>
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </div>
                </label>
                {i < arr.length - 1 && <Separator />}
              </React.Fragment>
            ))}
          </CardContent>
        </Card>

        <Button onClick={handleSave} className="w-fit">
          Save settings
        </Button>
      </div>
    </div>
  )
}