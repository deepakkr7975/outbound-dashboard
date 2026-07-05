import { audiences } from "@/lib/data/audiences"
import { campaigns } from "@/lib/data/campaigns"
import { getLeadById, getLeadTransactions } from "@/lib/data/leads"
import { getSequenceById } from "@/lib/data/sequences"
import { transactions } from "@/lib/data/transactions"
import { formatDate, formatPercent } from "@/lib/format"
import type { ExportReportInput } from "@/lib/exports/types"
import type { Lead, Sequence } from "@/lib/types"

export function buildLeadsExport(
  leads: Lead[],
  filters?: Record<string, string>
): ExportReportInput {
  const contacted = leads.filter((l) => l.emails_sent > 0).length
  return {
    source: "leads",
    title: "Leads export",
    description: `${leads.length} leads exported from the leads list`,
    filters,
    metrics: [
      { label: "Total leads", value: leads.length },
      { label: "Contacted", value: contacted },
      { label: "Not contacted", value: leads.length - contacted },
      { label: "Avg emails sent", value: leads.length ? (leads.reduce((s, l) => s + l.emails_sent, 0) / leads.length).toFixed(1) : "0" },
    ],
    columns: [
      { key: "name", label: "Name" },
      { key: "email", label: "Email" },
      { key: "role", label: "Role" },
      { key: "company", label: "Company" },
      { key: "city", label: "City" },
      { key: "audience", label: "Audience" },
      { key: "emails_sent", label: "Emails Sent" },
      { key: "added", label: "Added" },
    ],
    rows: leads.map((lead) => ({
      name: lead.name,
      email: lead.email,
      role: lead.role,
      company: lead.company,
      city: lead.city,
      audience:
        audiences.find((a) => a.id === lead.audience_id)?.name ?? "—",
      emails_sent: lead.emails_sent,
      added: formatDate(lead.created_at),
    })),
  }
}

export function buildLeadDetailExport(leadId: string): ExportReportInput | null {
  const lead = getLeadById(leadId)
  if (!lead) return null
  const audience = audiences.find((a) => a.id === lead.audience_id)
  const leadTxns = getLeadTransactions(lead.id)

  return {
    source: "lead",
    title: `Lead: ${lead.name}`,
    description: lead.email,
    metrics: [
      { label: "Emails sent", value: lead.emails_sent },
      { label: "Campaigns", value: new Set(leadTxns.map((t) => t.campaign_id)).size },
      { label: "Transactions", value: leadTxns.length },
      { label: "Audience", value: audience?.name ?? "—" },
    ],
    columns: [
      { key: "campaign", label: "Campaign" },
      { key: "step", label: "Step" },
      { key: "variant", label: "Variant" },
      { key: "status", label: "Status" },
      { key: "sent", label: "Sent" },
    ],
    rows:
      leadTxns.length > 0
        ? leadTxns.map((txn) => ({
            campaign:
              campaigns.find((c) => c.campaign_id === txn.campaign_id)?.name ??
              txn.campaign_id,
            step: txn.step_order,
            variant: txn.variant,
            status: txn.status,
            sent: txn.sent_at ? formatDate(txn.sent_at) : "—",
          }))
        : [
            {
              campaign: "—",
              step: "—",
              variant: "—",
              status: "No activity",
              sent: "—",
            },
          ],
  }
}

export function buildSequencesExport(
  sequences: Sequence[],
  filters?: Record<string, string>
): ExportReportInput {
  const scheduled = sequences.filter((s) => s.is_scheduled).length
  const abEnabled = sequences.filter((s) => s.has_ab_testing).length
  return {
    source: "sequences",
    title: "Sequences export",
    description: `${sequences.length} sequences exported`,
    filters,
    metrics: [
      { label: "Total sequences", value: sequences.length },
      { label: "Scheduled", value: scheduled },
      { label: "A/B enabled", value: abEnabled },
      { label: "Total completions", value: sequences.reduce((s, seq) => s + seq.sequence_completion, 0) },
    ],
    columns: [
      { key: "name", label: "Name" },
      { key: "steps", label: "Steps" },
      { key: "ab", label: "A/B" },
      { key: "scheduled", label: "Scheduled" },
      { key: "completed", label: "Completed" },
      { key: "completions", label: "Completions" },
      { key: "updated", label: "Updated" },
    ],
    rows: sequences.map((seq) => ({
      name: seq.name,
      steps: seq.total_steps,
      ab: seq.has_ab_testing ? "Yes" : "No",
      scheduled: seq.is_scheduled ? "Yes" : "No",
      completed: seq.is_completed ? "Yes" : "No",
      completions: seq.sequence_completion,
      updated: formatDate(seq.updated_at),
    })),
  }
}

export function buildSequenceDetailExport(
  sequenceId: string
): ExportReportInput | null {
  const sequence = getSequenceById(sequenceId)
  if (!sequence) return null
  const linked = campaigns.filter((c) => c.sequence_id === sequenceId)

  return {
    source: "sequence",
    title: `Sequence: ${sequence.name}`,
    description: sequence.description,
    metrics: [
      { label: "Steps", value: sequence.total_steps },
      { label: "Completions", value: sequence.sequence_completion },
      { label: "A/B testing", value: sequence.has_ab_testing ? "Yes" : "No" },
      { label: "Linked campaigns", value: linked.length },
    ],
    columns: [
      { key: "step", label: "Step" },
      { key: "wait_days", label: "Wait (days)" },
      { key: "subject_a", label: "Subject A" },
      { key: "subject_b", label: "Subject B" },
      { key: "sends", label: "Sends" },
    ],
    rows: sequence.steps.map((step) => {
      const stepKey = `email ${step.step_order}`
      return {
        step: step.step_order,
        wait_days: step.wait_days,
        subject_a: step.variants.a.title,
        subject_b: step.variants.b?.title ?? "—",
        sends: sequence.sequence_steps[stepKey] ?? 0,
      }
    }),
  }
}

export function buildAnalyticsExport(
  campaignId: string,
  statusFilter: string,
  stepFilter: string
): ExportReportInput {
  const campaign = campaigns.find((c) => c.campaign_id === campaignId)
  const campaignTxns = transactions.filter((t) => t.campaign_id === campaignId)

  const sent = campaignTxns.filter((t) => t.sent_at).length
  const delivered = campaignTxns.filter((t) => t.delivered_at).length
  const opened = campaignTxns.filter((t) => t.opened_at).length
  const clicked = campaignTxns.filter((t) => t.clicked_at).length
  const replied = campaignTxns.filter((t) => t.replied_at).length
  const bounced = campaignTxns.filter((t) => t.bounced_at).length

  const filteredTxns = campaignTxns.filter((t) => {
    const matchesStatus = statusFilter === "all" || t.status === statusFilter
    const matchesStep =
      stepFilter === "all" || t.step_order === Number(stepFilter)
    return matchesStatus && matchesStep
  })

  return {
    source: "analytics",
    title: `Analytics: ${campaign?.name ?? campaignId}`,
    description: "Campaign performance and transaction log",
    filters: {
      campaign: campaign?.name ?? campaignId,
      status: statusFilter,
      step: stepFilter,
    },
    metrics: [
      { label: "Sent", value: sent },
      { label: "Delivered", value: delivered },
      { label: "Opened", value: opened },
      { label: "Clicked", value: clicked },
      { label: "Replied", value: replied },
      { label: "Bounced", value: bounced },
      { label: "Open rate", value: formatPercent(opened, sent) },
      { label: "Reply rate", value: formatPercent(replied, sent) },
    ],
    columns: [
      { key: "lead", label: "Lead" },
      { key: "step", label: "Step" },
      { key: "variant", label: "Variant" },
      { key: "subject", label: "Subject" },
      { key: "status", label: "Status" },
      { key: "sent_at", label: "Sent At" },
    ],
    rows: filteredTxns.map((txn) => ({
      lead: txn.SK.split("#")[1],
      step: txn.step_order,
      variant: txn.variant,
      subject: txn.subject_line,
      status: txn.status,
      sent_at: txn.sent_at ? formatDate(txn.sent_at) : "—",
    })),
  }
}

export function downloadExportCsv(report: {
  title: string
  columns: { key: string; label: string }[]
  rows: Record<string, string | number>[]
}) {
  const header = report.columns.map((c) => c.label).join(",")
  const body = report.rows
    .map((row) =>
      report.columns
        .map((col) => {
          const val = String(row[col.key] ?? "")
          return val.includes(",") ? `"${val.replace(/"/g, '""')}"` : val
        })
        .join(",")
    )
    .join("\n")
  const blob = new Blob([`${header}\n${body}`], { type: "text/csv" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${report.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.csv`
  a.click()
  URL.revokeObjectURL(url)
}