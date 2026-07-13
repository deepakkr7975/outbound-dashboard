"use client"

import * as React from "react"
import { toast } from "sonner"

import { PageHeader } from "@/components/dashboard/page-header"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"

export function AccountPanel() {
  const [form, setForm] = React.useState({
    name: "Alex Morgan",
    email: "alex@revtrix.in",
    workspace: "revtrix",
    domain: "revtrix.in",
    role: "Admin",
  })

  function handleSave() {
    toast.success("Account updated")
  }

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <PageHeader
        title="Account"
        description="Manage your profile and workspace identity"
      />

      <div className="grid gap-4 px-4 lg:max-w-3xl lg:px-6">
        <Card className="dark:bg-card">
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <div className="flex items-center gap-4">
              <Avatar className="size-16 rounded-xl">
                <AvatarImage src="/avatars/user.svg" alt={form.name} />
                <AvatarFallback className="rounded-xl text-lg">AM</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-lg font-medium">{form.name}</p>
                <p className="text-sm text-muted-foreground">{form.email}</p>
                <Badge variant="outline" className="mt-2">
                  {form.role}
                </Badge>
              </div>
            </div>

            <Separator />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="acct-name">Full name</Label>
                <Input
                  id="acct-name"
                  value={form.name}
                  onChange={(e) =>
                    setForm({ ...form, name: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="acct-email">Email</Label>
                <Input
                  id="acct-email"
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm({ ...form, email: e.target.value })
                  }
                />
              </div>
            </div>

            <Button onClick={handleSave} className="w-fit">
              Save profile
            </Button>
          </CardContent>
        </Card>

        <Card className="dark:bg-card">
          <CardHeader>
            <CardTitle>Workspace</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="acct-workspace">Workspace name</Label>
              <Input
                id="acct-workspace"
                value={form.workspace}
                onChange={(e) =>
                  setForm({ ...form, workspace: e.target.value })
                }
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="acct-domain">Sending domain</Label>
              <Input
                id="acct-domain"
                value={form.domain}
                onChange={(e) =>
                  setForm({ ...form, domain: e.target.value })
                }
              />
            </div>
            <div className="sm:col-span-2">
              <Button variant="outline" onClick={handleSave}>
                Update workspace
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}