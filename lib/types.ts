export type LinkedStatus = "free" | "linked"

/** Whether the mailbox has completed the Gmail OAuth connect (can send) or is
 * still a placeholder created via the manual "Add Email" shortcut. */
export type VerificationStatus = "verified" | "pending_verification"

export type CampaignStatus =
  | "draft"
  | "scheduled"
  | "sending"
  | "completed"
  | "paused"
  | "cancelled"
  | "failed"

export type TransactionStatus =
  | "queued"
  | "sent"
  | "delivered"
  | "opened"
  | "clicked"
  | "replied"
  | "bounced"
  | "failed"
  | "unsubscribed"

export type ABVariant = "A" | "B"

export interface SenderEmail {
  id: string
  email: string
  name: string | null
  domain: string
  domain_name: string
  signature: string | null
  verification_status: VerificationStatus
  linked_status: LinkedStatus
  linked_campaign_ids: string[]
  created_at: string
  updated_at: string
}

export interface Audience {
  id: string
  name: string
  description: string
  file_name: string
  tags: string[]
  member_count: number
  created_at: string
  updated_at: string
}

export interface Lead {
  id: string
  audience_id: string
  email: string
  name: string
  role: string
  company: string
  city: string
  emails_sent: number
  created_at: string
}

export interface SequenceStepVariant {
  /**
   * First subject line — kept for the existing table/detail UI. Derived from
   * `subject_lines[0]` for AI/new-format sequences, or the legacy `title`.
   */
  title: string
  body: string
  /** New backend format: multiple subject-line options (AI A/B). */
  subject_lines?: string[]
  /** New backend format: opening hook options rendered before the body. */
  opening_lines?: string[]
  /** New backend format: e.g. reply "YES" to book — appended to the email. */
  reply_trigger?: string | null
}

export interface SequenceStep {
  step_order: number
  wait_days: number
  variants: {
    a: SequenceStepVariant
    b: SequenceStepVariant | null
  }
}

export interface Sequence {
  sequence_id: string
  name: string
  description: string
  total_steps: number
  has_ab_testing: boolean
  is_ai_generated: boolean
  steps: SequenceStep[]
  is_scheduled: boolean
  is_completed: boolean
  sequence_completion: number
  sequence_steps: Record<string, number>
  created_at: string
  updated_at: string
}

export interface CampaignSchedule {
  date: string
  time: string
  timezone: string
}

export interface Campaign {
  campaign_id: string
  name: string
  description: string
  sender_email_ids: string[]
  sequence_id: string
  audience_id: string
  schedule: CampaignSchedule
  is_scheduled: boolean
  is_completed: boolean
  status: CampaignStatus
  sent_count: number
  total_count: number
  created_at: string
  updated_at: string
}

export interface EmailTransaction {
  transaction_id: string
  PK: string
  SK: string
  campaign_id: string
  sequence_id: string
  step_order: number
  lead_id: string
  sender_email_id: string
  audience_id: string
  variant: ABVariant
  subject_line: string
  template_version: string
  status: TransactionStatus
  created_at: string
  scheduled_for: string
  sent_at: string | null
  delivered_at: string | null
  opened_at: string | null
  clicked_at: string | null
  replied_at: string | null
  bounced_at: string | null
  open_count: number
  click_count: number
  provider: string
  provider_message_id: string
  bounce_type: "hard" | "soft" | null
  error_message: string | null
}