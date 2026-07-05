import { AudienceDetailPanel } from "@/components/modules/audience-detail-panel"

export default async function AudienceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <AudienceDetailPanel audienceId={id} />
}