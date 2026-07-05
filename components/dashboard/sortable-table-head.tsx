"use client"

import { TableHead } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import type { SortDirection } from "@/hooks/use-table-sort"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  ArrowUpDownIcon,
} from "@hugeicons/core-free-icons"

interface SortableTableHeadProps<K extends string> {
  column: K
  sortColumn: K | null
  sortDirection: SortDirection
  onSort: (column: K) => void
  className?: string
  children: React.ReactNode
}

export function SortableTableHead<K extends string>({
  column,
  sortColumn,
  sortDirection,
  onSort,
  className,
  children,
}: SortableTableHeadProps<K>) {
  const active = sortColumn === column

  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => onSort(column)}
        aria-sort={
          active
            ? sortDirection === "asc"
              ? "ascending"
              : "descending"
            : "none"
        }
        className={cn(
          "inline-flex items-center gap-1 rounded-sm transition-colors",
          "hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
          active ? "text-foreground" : "text-muted-foreground"
        )}
      >
        <span>{children}</span>
        <HugeiconsIcon
          icon={
            active
              ? sortDirection === "asc"
                ? ArrowUp01Icon
                : ArrowDown01Icon
              : ArrowUpDownIcon
          }
          strokeWidth={2}
          className={cn("size-3.5 shrink-0", !active && "opacity-50")}
        />
      </button>
    </TableHead>
  )
}