# Product Requirements Document — Email Campaign Dashboard

| Field | Value |
|---|---|
| Product | Cold Email Campaign Dashboard (Kallix) |
| Version | v1.0 |
| Status | Draft |
| Last Updated | 03 July 2026 |

---

## 1. Overview

### 1.1 Purpose
A self-serve email outreach dashboard that lets a user manage **sender email accounts**, **audiences (leads)**, **multi-step email sequences (with A/B testing)**, and **campaigns** that bind all three together with a schedule. Every individual send is tracked as an **email transaction** for granular analytics (opens, clicks, replies, bounces).

### 1.2 Goals
- Manage sender inboxes and their availability (free vs. linked to a campaign).
- Upload and organize audiences of leads via CSV with tagging.
- Build reusable, ordered email sequences with per-step wait days and optional A/B subject-line testing.
- Launch scheduled campaigns mapping: **N sender emails → 1 sequence → 1 audience → schedule**.
- Track every send at transaction level and roll stats up to step, variant, and campaign level.

### 1.3 Non-Goals (v1)
- Inbox/reply management (unified inbox).
- Multi-sequence campaigns (a campaign links to exactly **one** sequence).

### 1.4 Core Entity Relationships
```
SenderEmail (N) ──┐
Audience   (1) ───┼──► Campaign (1) ──► Sequence (1, N steps, optional A/B)
Schedule   (1) ───┘          │
                             ▼
                    EmailTransaction (one row per email per lead per step)
```

---

## 2. Global UI Layout

- Left sidebar navigation (72–240px, collapsible): **Dashboard, Sender Emails, Audiences, Sequences, Campaigns, Analytics**.
- Top bar: global search, workspace/domain indicator (`kallix`), user menu.
- Content area: page header (title + primary action button, right-aligned) → filter bar → data table/cards.

### 2.1 Interaction Patterns
- Destructive actions require a confirmation modal before execution.
- Empty states: centered message + primary CTA when a list has no items.
- Toasts: bottom-right for success, error, and info feedback.

---

## 3. Module 1 — Sender Emails

### 3.1 Panel Description
A table-based panel listing all sender email accounts available on the platform. Each sender belongs to a sending **domain** (the actual DNS domain mail is sent from, e.g. `kallix.in`) under a **domain_name** (the platform/brand label, e.g. `kallix`). The panel surfaces each email's **linked status** — whether it is *Free* or *Linked* to one or more campaigns — so users instantly know which inboxes are safe to reuse, edit, or delete.

### 3.2 Data Model — `sender_email`
| Field | Type | Notes |
|---|---|---|
| `id` | UUID | e.g. `snd_1` |
| `email` | string | Unique, validated |
| `domain` | string | Actual sending domain — e.g. `kallix.in` |
| `domain_name` | string | Platform/brand name — e.g. `kallix` |
| `signature` | rich text (HTML) | Appended to outgoing emails |
| `linked_status` | enum | `free` \| `linked` |
| `linked_campaign_ids` | list[UUID] | Populated when linked |
| `created_at` / `updated_at` | ISO 8601 | — |

### 3.3 Table Columns
`Email` · `Domain` (`kallix.in`) · `Domain Name` (`kallix`) · `Status` (badge: 🟢 Free / 🔵 Linked) · `Linked Campaigns` (count, click → drill-down) · `Signature` (Set / Not set) · `Created` · `⋮ Actions`

### 3.4 Actions
| Action | Trigger | Behavior | Validation / Rules |
|---|---|---|---|
| **Add Email** | Primary button, top-right | Modal: `email`, `domain`, `domain_name`, optional `signature` (rich-text editor with `{first_name}`-style token support) | Email format + uniqueness check; domain must be a verified sending domain |
| **Check Linked Status** | Inline badge / row click | Shows `free` or `linked`; if linked, expands the list of campaign names it is attached to | Status computed live from campaign associations |
| **Add / Edit Signature** | Row action `⋮ → Signature` | Rich-text modal with live preview; save updates `signature` and `updated_at` | Max 10 KB HTML; sanitize scripts |
| **Delete Email** | Row action `⋮ → Delete` (danger) | Confirmation modal → hard delete | **Blocked if `linked_status = linked`** — show error toast: "Unlink from campaign(s) X, Y before deleting." |

---

## 4. Module 2 — Audiences (Leads)

### 4.1 Panel Description
A two-level panel. **Level 1** is the audience list: named groups of leads created via CSV upload, with description, tags, and member counts. **Level 2** (drill-down) is the audience detail view: a paginated table of every lead (sender target) in that audience, including a per-lead flag showing whether emails have been sent to them or not.

### 4.2 Data Model — `audience`
| Field | Type | Notes |
|---|---|---|
| `id` | UUID | e.g. `7ab28193-e04a-4565-adb0-f7dc5ebf050d` |
| `name` | string | e.g. `Internship` |
| `description` | string | e.g. `Testing Audience` |
| `csv` | file ref | Source CSV; `file_name` retained |
| `tag` | list[string] | Comma-input chips — e.g. `marketing_head, klipkanvas` |
| `member_count` | int | Denormalized lead count (`num_leads`) |
| `created_at` / `updated_at` | ISO 8601 | — |

**Create/Import API response** must return: `msg`, `aud_name`, `aud_id`, `file_name`, `num_leads`.

### 4.3 Data Model — `lead` (audience member)
| Field | Type | Example |
|---|---|---|
| `id` | UUID | `b5c88bf3-6349-4af7-9966-63c05c0519f7` |
| `email` | string | `emma.davis@example.com` |
| `name` | string | `Emma Davis` |
| `role` | string | `Customer Success Manager` |
| `company` | string | `HubSpot` |
| `city` | string | `Boston` |
| `emails_sent` | bool/int | Whether/how many emails this lead has received |
| `created_at` | ISO 8601 | `2026-06-28T11:30:24.724515Z` |

### 4.4 Actions
| Action | Trigger | Behavior | Validation / Rules |
|---|---|---|---|
| **Add Audience** | Primary button "New Audience" | Modal/wizard: `name`, `description`, `tags` (chip input), **CSV upload** with column-mapping step (email, name, role, company, city) | CSV required; dedupe by email within audience; return `{msg, aud_name, aud_id, file_name, num_leads}` |
| **Edit Audience** | Row action `⋮ → Edit` | Edit `name`, `description`, `tags`; optionally append new CSV (merge, dedupe) | Name required |
| **Delete Leads from Audience** | Detail view: row checkbox(es) → "Remove selected" | Accepts a **single lead id (str) or a list of ids** in one call; confirmation modal shows count | Decrement `member_count`; leads already contacted keep their transaction history |
| **List All Audiences** | Panel default view | Table: `Name` · `Description` · `Tags` (chips) · `Members` · `File` · `Created` | Search by name; filter by tag |
| **List Audience Details** | Row click | Lead table with `Name` · `Email` · `Role` · `Company` · `City` · `Emails Sent` (✅/–) · `Added` | Paginated (50/page), searchable, sortable |
| **Delete Audience** | Row action `⋮ → Delete` (danger) | Confirmation modal | Blocked if audience is attached to a scheduled/running campaign |

---

## 5. Module 3 — Sequences

### 5.1 Panel Description
The sequence builder panel. A **sequence** is an ordered list of emails (steps) sent to a lead over time. Each step has a `step_order`, a `wait_days` value (**days before this step is sent**, relative to the previous step; step 1 is `wait_days: 0`), and content **variants**. When `has_ab_testing` is true, a step may carry **two titles (A and B)** — and step 1 may carry two full variants — while a single shared body is also supported; when false, only variant `a` exists and `b` is `null`. The panel lists all sequences with schedule/completion state and opens into a vertical step-timeline builder.

### 5.2 Data Model — `sequence`
| Field | Type | Notes |
|---|---|---|
| `sequence_id` | string | e.g. `seq_x` |
| `name` | string | e.g. `Winter Outreach` |
| `description` | string | e.g. `This is for the Winter Collection` |
| `total_steps` | int | Derived from `steps[]` |
| `has_ab_testing` | bool | If `true`, steps may define variant `b` |
| `steps` | list[Step] | Ordered by `step_order` |
| `is_scheduled` | bool | Linked to a scheduled campaign |
| `is_completed` | bool | All linked sends finished |
| `sequence_completion` | int | **Count of leads who have completed the entire sequence** (received all steps) |
| `sequence_steps` | JSON map | Per-step sent counters — `{"email 1": int, "email 2": int, ..., "email n": int}` |
| `created_at` / `updated_at` | ISO 8601 | — |

**Step object**
| Field | Type | Notes |
|---|---|---|
| `step_order` | int | 1-based, unique per sequence, re-orderable |
| `wait_days` | int | Days to wait **before** sending this step (step 1 = 0) |
| `variants.a` | `{title, body}` | Always present |
| `variants.b` | `{title, body}` \| null | Only when A/B testing is on for this step; may share body with `a` (two titles, one body) |

Personalization tokens supported in title & body: `{first_name}`, `{company}`, `{role}`, `{city}`.

### 5.3 List View — Filters & Columns
**Filters:** `name` (string match, debounced search) · `is_scheduled` (All / Yes / No) · `is_completed` (All / Yes / No)

**Columns:** `Name` · `Description` · `Steps` (`total_steps`) · `A/B` (chip if enabled) · `Scheduled` · `Completed` · `Completions` (`sequence_completion`) · `Updated` · `⋮ Actions`

### 5.4 Actions
| Action | Trigger | Behavior | Validation / Rules |
|---|---|---|---|
| **List Sequences** | Panel default | Filterable table above | — |
| **Add Sequence** | Primary button "New Sequence" | Full-page builder: name + description → add steps in order. Per step: title(s) + body, `wait_days` (separation time in days), A/B toggle. Steps are drag-re-orderable; order is saved explicitly as `step_order` | Every step **must** have title (A, and B if A/B on) and body; ≥1 step; `wait_days ≥ 0`; step 1 forced to `wait_days: 0`; **step order must be explicitly persisted** (known gap: order was previously not being added — this is a P0 fix) |
| **Edit Sequence** | Row action `⋮ → Edit` | Same builder pre-filled. Editable: titles (add/remove B variant), bodies, **step order** (drag), **`wait_days` separation** | Same validations as Add; warn if sequence is linked to a scheduled campaign ("changes affect pending sends") |
| **Delete Sequence** | Row action `⋮ → Delete` (danger) | Confirmation modal | **Blocked if the sequence is linked to any campaign that has been sent (or is sending/scheduled).** Error toast lists blocking campaigns. Unlinked/draft-only sequences delete freely |

---

## 6. Module 4 — Campaigns

### 6.1 Panel Description
The command center. A **campaign** binds: campaign details (name, description) + **sender emails (one or many, rotated)** + **exactly one sequence** + **one audience** + a **schedule (date + time)**. The panel shows all campaigns with lifecycle state, supports rich filtering, and includes a dedicated **Linked Emails** view mapping every campaign to the sender emails attached to it.

### 6.2 Data Model — `campaign`
| Field | Type | Notes |
|---|---|---|
| `campaign_id` | string | e.g. `camp_winter` |
| `name` / `description` | string | Campaign details |
| `sender_email_ids` | list[UUID] | **Single or list**; multiple senders rotate per send |
| `sequence_id` | string | Exactly **1** sequence |
| `audience_id` | UUID | Target audience |
| `schedule` | `{date, time, timezone}` | When step 1 begins; later steps derive from `wait_days` |
| `is_scheduled` / `is_completed` | bool | Lifecycle flags |
| `status` | enum | `draft` \| `scheduled` \| `sending` \| `completed` \| `paused` |
| `created_at` / `updated_at` | ISO 8601 | — |

### 6.3 List View — Filters & Columns
**Filters:** `name` (string match) · `is_scheduled` · `is_completed` · `sequence` (dropdown of sequences)

**Columns:** `Name` · `Sequence` · `Audience` · `Senders` (count, hover → emails) · `Schedule` · `Status` (badge) · `Progress` (sent/total) · `⋮ Actions`

### 6.4 Actions
| Action | Trigger | Behavior | Validation / Rules |
|---|---|---|---|
| **List Campaigns** | Panel default | Filterable table above | — |
| **Add Campaign** | Primary button "New Campaign" | 5-step wizard: ① Details (name, description) → ② Senders (multi-select of **free/eligible** sender emails; single or list) → ③ Sequence (pick exactly 1; preview steps inline) → ④ Audience (pick 1; shows `member_count`) → ⑤ Schedule (date + time picker + timezone) → Review & Launch | All five sections required; schedule must be in the future; selected senders become `linked` |
| **Edit Campaign** | Row action `⋮ → Edit` | Same wizard pre-filled; can change details, sender list, sequence, audience, schedule | Editing a `sending` campaign restricted to details + adding senders; changing sequence/audience only while `draft`/`scheduled` |
| **Delete Campaign** | Row action `⋮ → Delete` (danger) | Confirmation modal | **Blocked when any linked sender email is scheduled** (pending sends exist). Error toast: "Cancel or complete scheduled sends before deleting." |
| **Show Linked Emails** | Tab "Linked Emails" within panel | Matrix/table view: every campaign row expanded with its linked sender emails, each email's domain and status | Read-only; email click → Sender Emails panel filtered to it |

---

## 7. Module 5 — Email Transactions & Analytics

### 7.1 Panel Description
Read-only analytics layer built on the **Email Transaction table** — one row per single send (**one email → one lead → one campaign → one step**). Powers campaign dashboards, per-step funnels, and A/B variant comparison. Backed by DynamoDB with campaign-partitioned keys so all sends of a campaign are co-located, and per-lead-per-step sort keys so overlapping leads across campaigns never collide.

### 7.2 Data Model — `email_transaction`
| Field | Type | Description | Example |
|---|---|---|---|
| `transaction_id` | ULID | Unique ID per single send; time-sortable | `txn_01HXAB3K9P` |
| `PK` | string | Partition key — groups all sends of one campaign | `CAMPAIGN#camp_winter` |
| `SK` | string | Sort key — locates a send within the campaign | `MSG#sarah@acme.com#1` |
| `campaign_id` | string | Owning campaign; stamps every send so overlapping leads across campaigns don't collide | `camp_winter` |
| `sequence_id` | string | Sequence that drove this send (1:1 with campaign today; stored for future flexibility) | `seq_x` |
| `step_order` | int | Which email in the sequence (1st, 2nd, 3rd…) | `1` |
| `lead_id` | string | Recipient | `sarah@acme.com` |
| `sender_email_id` | string | Actual sender used — matters under sender rotation | `snd_1` |
| `audience_id` | string | Audience the lead came from (optional; slices stats by audience) | `aud_q1` |
| `variant` | enum `A`\|`B` | A/B variant sent — the key field for A/B stats | `A` |
| `subject_line` | string | Rendered subject | `Quick question, Sarah` |
| `template_version` | string | Content version | `v2` |
| `status` | enum | `queued` · `sent` · `delivered` · `opened` · `clicked` · `replied` · `bounced` · `failed` · `unsubscribed` | `replied` |
| `created_at` | ISO 8601 | Row first written (queued) | `2026-01-05T09:00:00Z` |
| `scheduled_for` | ISO 8601 | Planned send time, derived from step `wait_days` | `2026-01-05T09:00:00Z` |
| `sent_at` | ISO 8601 | Left the system | `2026-01-05T09:00:04Z` |
| `delivered_at` | ISO 8601 | Provider-confirmed delivery | `2026-01-05T09:00:11Z` |
| `opened_at` | ISO 8601 \| null | **First** open; doubles as duplicate guard against repeat open webhooks | `2026-01-05T14:22:00Z` |
| `clicked_at` | ISO 8601 \| null | First click | `null` |
| `replied_at` | ISO 8601 \| null | Lead replied | `2026-01-08T10:15:00Z` |
| `bounced_at` | ISO 8601 \| null | Bounce time, if any | `null` |
| `open_count` | int | Total opens (providers fire repeat events); pairs with `opened_at` | `3` |
| `click_count` | int | Total clicks | `0` |
| `provider` | string | Sending provider | `ses` |
| `provider_message_id` | string | Provider reference | `0100018d-aef2-7c3a` |
| `bounce_type` | enum \| null | `hard` (dead address) \| `soft` (temporary) | `null` |
| `error_message` | string \| null | Failure reason if send failed | `null` |

### 7.3 Panel Views & Actions
| View / Action | Behavior |
|---|---|
| **Campaign Overview** | Per-campaign cards: Sent, Delivered, Opened, Clicked, Replied, Bounced (count + %); status badges by transaction status |
| **Step Funnel** | Bar/funnel per `step_order` using `sequence_steps` counters — "email 1: n, email 2: n, …" — plus **Sequence Completion** stat (leads who finished all steps) |
| **A/B Comparison** | Variant A vs B split for open/click/reply rates per step; only for sequences with `has_ab_testing = true` |
| **Transaction Log** | Filterable table of raw transactions: filter by status, step, variant, sender, audience; export CSV |
| **Webhook Ingestion (system)** | Provider events update `status` + timestamps; repeat opens increment `open_count` but never overwrite `opened_at` (dedupe guard) |

---

## 8. Business Rules Summary (Hard Constraints)

1. **Sender email deletion** — blocked while the email is linked to any campaign.
2. **Sequence deletion** — blocked if linked to any campaign that has been sent, is sending, or is scheduled.
3. **Campaign deletion** — blocked while any of its sender emails has scheduled (pending) sends.
4. **Campaign composition** — exactly 1 sequence, exactly 1 audience, ≥1 sender email, valid future schedule.
5. **Sequence steps** — every step requires title (A, plus B when A/B enabled) and body; `step_order` must be explicitly persisted (P0 fix); step 1 `wait_days = 0`.
6. **Lead removal** — accepts a single id (string) or list of ids; historical transactions are never deleted.
7. **Open dedupe** — `opened_at` written once; subsequent opens only increment `open_count`.

---

## 9. Success Metrics

- Time-to-first-campaign < 10 minutes from signup.
- CSV import success rate > 98% (with clear per-row error reporting).
- Zero orphaned transactions (every row resolvable to campaign + sequence + lead).
- A/B stats available within 5 minutes of webhook receipt.

## 10. Open Questions

1. Sender rotation strategy — round-robin per lead vs. sticky sender per lead across all steps?
2. Should `unsubscribed` leads be globally suppressed across all audiences, or per-campaign?
3. Daily send limits / warm-up caps per sender email?
4. Timezone handling — send in campaign timezone or each lead's local timezone?