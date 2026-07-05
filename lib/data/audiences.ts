import audiencesData from "@/data/audiences.json"
import type { Audience } from "@/lib/types"

export const audiences = audiencesData as Audience[]

export function getAudienceById(id: string): Audience | undefined {
  return audiences.find((a) => a.id === id)
}