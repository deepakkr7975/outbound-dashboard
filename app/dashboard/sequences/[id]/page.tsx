import { SequenceDetailPanel } from "@/components/modules/sequence-detail-panel"

export default async function SequenceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <SequenceDetailPanel sequenceId={id} />
}