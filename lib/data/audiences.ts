import type { Audience } from "@/lib/types"

import { audiences } from "./store"

export { audiences }

export function getAudienceById(id: string): Audience | undefined {
  return audiences.find((a) => a.id === id)
}
