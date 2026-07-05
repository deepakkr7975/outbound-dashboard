"use client"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface PageHeaderAction {
  label: string
  onClick?: () => void
  href?: string
  variant?: "default" | "outline" | "secondary" | "ghost"
}

interface PageHeaderProps {
  title: string
  description?: string
  action?: PageHeaderAction
  actions?: React.ReactNode
}

export function PageHeader({
  title,
  description,
  action,
  actions,
}: PageHeaderProps) {
  const hasActions = action || actions

  return (
    <div className="flex flex-col gap-1 px-4 sm:flex-row sm:items-center sm:justify-between lg:px-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        {description && (
          <p className="text-base text-muted-foreground">{description}</p>
        )}
      </div>
      {hasActions && (
        <div className={cn("flex flex-wrap items-center gap-2")}>
          {actions}
          {action &&
            (action.href ? (
              <Button
                variant={action.variant ?? "default"}
                render={<a href={action.href} />}
              >
                {action.label}
              </Button>
            ) : (
              <Button
                variant={action.variant ?? "default"}
                onClick={action.onClick}
              >
                {action.label}
              </Button>
            ))}
        </div>
      )}
    </div>
  )
}