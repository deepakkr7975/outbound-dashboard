"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

export function useUrlPreview(param = "preview") {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const previewId = searchParams.get(param)

  const setPreviewId = React.useCallback(
    (id: string | null) => {
      const params = new URLSearchParams(searchParams.toString())
      if (id) params.set(param, id)
      else params.delete(param)
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [param, pathname, router, searchParams]
  )

  return { previewId, setPreviewId }
}