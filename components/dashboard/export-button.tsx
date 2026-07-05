"use client"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { HugeiconsIcon } from "@hugeicons/react"
import { FileExportIcon } from "@hugeicons/core-free-icons"

interface ExportButtonProps {
  onClick: () => void
  label?: string
  className?: string
  size?: "default" | "sm" | "lg"
}

export function ExportButton({
  onClick,
  label = "Export",
  className,
  size = "default",
}: ExportButtonProps) {
  return (
    <Button
      variant="outline"
      size={size}
      onClick={onClick}
      className={cn("gap-2", className)}
    >
      <HugeiconsIcon icon={FileExportIcon} strokeWidth={2} className="size-4" />
      {label}
    </Button>
  )
}