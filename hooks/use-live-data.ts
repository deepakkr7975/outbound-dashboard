"use client"

import * as React from "react"

import { getVersion, isLoaded, loadAll, subscribe } from "@/lib/data/store"

/**
 * Subscribes a component to the live data store and kicks off the initial
 * API load. Returns `{ ready, version }` — `ready` flips to true after the
 * first successful hydration; `version` bumps on every (re)hydration so it
 * can be used as an effect dependency to sync local component state.
 */
export function useLiveData(): { ready: boolean; version: number } {
  const version = React.useSyncExternalStore(
    subscribe,
    getVersion,
    () => 0
  )

  React.useEffect(() => {
    loadAll().catch((error) => {
      console.error("Failed to load data from API:", error)
    })
  }, [])

  return { ready: isLoaded(), version }
}
