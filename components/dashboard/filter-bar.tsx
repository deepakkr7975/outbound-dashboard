"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { HugeiconsIcon } from "@hugeicons/react"
import { Cancel01Icon } from "@hugeicons/core-free-icons"

interface FilterOption {
  label: string
  value: string
}

interface SelectFilterConfig {
  id: string
  label: string
  type?: "select"
  placeholder?: string
  value: string
  options: FilterOption[]
  onChange: (value: string) => void
}

interface DateFilterConfig {
  id: string
  label: string
  type: "date"
  value: string
  onChange: (value: string) => void
}

interface TextFilterConfig {
  id: string
  label: string
  type: "text"
  value: string
  placeholder?: string
  onChange: (value: string) => void
  onSubmit?: () => void
  submitLabel?: string
}

export type FilterConfig =
  | SelectFilterConfig
  | DateFilterConfig
  | TextFilterConfig

interface FilterBarProps {
  searchLabel?: string
  searchPlaceholder?: string
  searchValue?: string
  onSearchChange?: (value: string) => void
  filters?: FilterConfig[]
  resultCount?: number
  resultLabel?: string
  activeFilterCount?: number
  onClear?: () => void
  className?: string
}

export function FilterBar({
  searchLabel = "Search",
  searchPlaceholder = "Search…",
  searchValue,
  onSearchChange,
  filters = [],
  resultCount,
  resultLabel = "results",
  activeFilterCount = 0,
  onClear,
  className,
}: FilterBarProps) {
  const fieldCount = filters.length + (onSearchChange ? 1 : 0)

  return (
    <div className={cn("flex flex-col gap-3 px-4 lg:px-6", className)}>
      <div
        className={cn(
          "grid gap-3 rounded-xl border p-4 sm:grid-cols-2",
          fieldCount >= 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"
        )}
      >
        {onSearchChange && (
          <div className="grid gap-1.5">
            <Label htmlFor="filter-search">{searchLabel}</Label>
            <Input
              id="filter-search"
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              className="text-sm"
            />
          </div>
        )}

        {filters.map((filter) => {
          if (filter.type === "date") {
            return (
              <div key={filter.id} className="grid gap-1.5">
                <Label htmlFor={filter.id}>{filter.label}</Label>
                <Input
                  id={filter.id}
                  type="date"
                  value={filter.value}
                  onChange={(e) => filter.onChange(e.target.value)}
                  className="w-full text-sm"
                />
              </div>
            )
          }

          if (filter.type === "text") {
            return (
              <div key={filter.id} className="grid gap-1.5">
                <Label htmlFor={filter.id}>{filter.label}</Label>
                <div className="flex gap-2">
                  <Input
                    id={filter.id}
                    placeholder={filter.placeholder}
                    value={filter.value}
                    onChange={(e) => filter.onChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") filter.onSubmit?.()
                    }}
                    className="flex-1 text-sm"
                  />
                  {filter.onSubmit && (
                    <Button variant="outline" onClick={filter.onSubmit}>
                      {filter.submitLabel ?? "Search"}
                    </Button>
                  )}
                </div>
              </div>
            )
          }

          return (
            <div key={filter.id} className="grid gap-1.5">
              <Label htmlFor={filter.id}>{filter.label}</Label>
              <Select
                value={filter.value}
                onValueChange={(v) => filter.onChange(v ?? "")}
              >
                <SelectTrigger id={filter.id} className="w-full text-sm">
                  <SelectValue placeholder={filter.placeholder ?? filter.label} />
                </SelectTrigger>
                <SelectContent>
                  {filter.options.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )
        })}
      </div>

      {(activeFilterCount > 0 || resultCount != null) && (
        <div className="flex flex-wrap items-center gap-2">
          {resultCount != null && (
            <span className="text-sm text-muted-foreground">
              {resultCount} {resultLabel}
              {activeFilterCount > 0 &&
                ` · ${activeFilterCount} filter${activeFilterCount === 1 ? "" : "s"} active`}
            </span>
          )}
          {filters.map((filter) => {
            if (filter.type === "select" || !filter.type) {
              const active = filter.value !== "all" && filter.value !== ""
              if (!active) return null
              const option = filter.options.find((o) => o.value === filter.value)
              return (
                <Badge key={filter.id} variant="secondary">
                  {filter.label}: {option?.label ?? filter.value}
                </Badge>
              )
            }
            if (filter.type === "date" && filter.value) {
              return (
                <Badge key={filter.id} variant="secondary">
                  {filter.label}: {filter.value}
                </Badge>
              )
            }
            if (filter.type === "text" && filter.value) {
              return (
                <Badge key={filter.id} variant="secondary">
                  {filter.label}: {filter.value}
                </Badge>
              )
            }
            return null
          })}
          {onSearchChange && searchValue && (
            <Badge variant="secondary">
              {searchLabel}: {searchValue}
            </Badge>
          )}
          {onClear && activeFilterCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClear}
              className="h-8 gap-1"
            >
              <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} className="size-4" />
              Clear filters
            </Button>
          )}
        </div>
      )}
    </div>
  )
}