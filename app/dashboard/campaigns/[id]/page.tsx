import { CampaignDetailPanel } from "@/components/modules/campaign-detail-panel"

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <CampaignDetailPanel campaignId={id} />
}