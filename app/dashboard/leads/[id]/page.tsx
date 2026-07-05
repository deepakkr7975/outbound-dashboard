import { LeadDetailPanel } from "@/components/modules/lead-detail-panel"

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <LeadDetailPanel leadId={id} />
}