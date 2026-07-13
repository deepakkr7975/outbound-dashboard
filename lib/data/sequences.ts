import type { Sequence } from "@/lib/types"

import { sequences } from "./store"

export { sequences }

export function getSequenceById(id: string): Sequence | undefined {
  return sequences.find((s) => s.sequence_id === id)
}
