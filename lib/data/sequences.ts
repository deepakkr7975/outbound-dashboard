import sequencesData from "@/data/sequences.json"
import type { Sequence } from "@/lib/types"

export const sequences = sequencesData as Sequence[]

export function getSequenceById(id: string): Sequence | undefined {
  return sequences.find((s) => s.sequence_id === id)
}