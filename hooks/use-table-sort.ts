"use client"

import * as React from "react"

export type SortDirection = "asc" | "desc"

interface SortState<K extends string> {
  column: K | null
  direction: SortDirection
}

function compareValues(
  a: unknown,
  b: unknown,
  direction: SortDirection
): number {
  const multiplier = direction === "asc" ? 1 : -1

  if (a == null && b == null) return 0
  if (a == null) return 1 * multiplier
  if (b == null) return -1 * multiplier

  if (typeof a === "number" && typeof b === "number") {
    return (a - b) * multiplier
  }

  if (typeof a === "boolean" && typeof b === "boolean") {
    return (Number(a) - Number(b)) * multiplier
  }

  return (
    String(a).localeCompare(String(b), undefined, {
      numeric: true,
      sensitivity: "base",
    }) * multiplier
  )
}

export function sortByColumn<T, K extends string>(
  data: T[],
  column: K | null,
  direction: SortDirection | null,
  accessors: Record<K, (row: T) => unknown>
): T[] {
  if (!column || !direction) return data

  const accessor = accessors[column]
  return [...data].sort((a, b) =>
    compareValues(accessor(a), accessor(b), direction)
  )
}

export function useTableSort<K extends string>(defaultColumn?: K) {
  const [sortState, setSortState] = React.useState<SortState<K>>({
    column: defaultColumn ?? null,
    direction: "asc",
  })

  const toggle = React.useCallback((nextColumn: K) => {
    setSortState((prev) => {
      if (prev.column === nextColumn) {
        return {
          column: nextColumn,
          direction: prev.direction === "asc" ? "desc" : "asc",
        }
      }
      return { column: nextColumn, direction: "asc" }
    })
  }, [])

  const sort = React.useCallback(
    <T,>(data: T[], accessors: Record<K, (row: T) => unknown>) =>
      sortByColumn(
        data,
        sortState.column,
        sortState.direction,
        accessors
      ),
    [sortState.column, sortState.direction]
  )

  return {
    column: sortState.column,
    direction: sortState.direction,
    toggle,
    sort,
  }
}