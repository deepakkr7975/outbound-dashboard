import { SequenceBuilderPanel } from "@/components/modules/sequence-builder-panel"

export default async function EditSequencePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <SequenceBuilderPanel sequenceId={id} />
}