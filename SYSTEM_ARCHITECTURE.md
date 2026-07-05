# Email Automation Platform - System Architecture & Documentation

This document serves as a comprehensive overview of the Email Automation Platform. It is intended to provide necessary context for adding new features, troubleshooting, and understanding the core domain models and logic flow.

## 1. Project Overview
The platform is a full-featured cold email outreach automation tool. It allows users to upload leads, group them into Audiences, create multi-step email sequences (with A/B testing), connect sender email accounts via OAuth (Gmail), and schedule campaigns.

**Tech Stack:**
- **Backend:** Python, FastAPI
- **Database:** DynamoDB (via Boto3)
- **Task Scheduling:** APScheduler (Background jobs for sending emails based on scheduled times)

---

## 2. Core Domain Models (DynamoDB Tables)

### `leads`
Represents an individual contact.
- **Fields:** `id`, `name`, `email`, `company`, `tags` (List of strings), `created_at`
- **Note:** Supports extra dynamic fields from CSV uploads for mail-merge variables.
- **Why `tags` exist:** tags are a filtering/searching aid, not a membership mechanism.

  ```
  tags
    ↓
  Filtering
  Searching
  Future segmentation
  ```

  **Campaigns do NOT use `tags` to determine who receives an email.** Campaign membership is always resolved through an Audience's `lead_ids` array (see below). Tags exist purely so a user can slice and search the Leads table later (e.g., "show me all leads tagged `q1-launch`"), independent of which campaigns have actually been sent.

### `audiences`
Represents a reusable collection of Lead IDs.
- **Fields:** `id`, `name`, `description`, `file_name`, `tags`, `lead_ids` (List of Lead IDs), `num_leads`, `created_at`, `updated_at`
- **Behavior:** `lead_ids` is the source of truth for campaign membership — it's a stable, explicit snapshot of who belongs to the audience, so membership doesn't shift if a lead's attributes change later. When an Audience is created via CSV upload, its `tags` are also appended to the `tags` array of each associated Lead, purely so those leads can be found via search/filter later. That `tags` write is a side effect for discoverability; it has no bearing on which campaigns a lead receives.

### `email_accounts`
OAuth-connected sender accounts.
- **Fields:** `id`, `user_id`, `email`, `domain`, `status`, `refresh_token`, `access_token`, `daily_limit`, `sent_today`, `last_used_at`, `is_active`
- **Signature Fields:** `signature_name`, `signature_title`, `signature_company`, `signature_phone`, `signature_html`

### `sequences` & `sequence_steps`
Defines the template and timing schema for a campaign — sequences store templates and timing only, nothing execution-related.

- **Sequence:** `sequence_id`, `name`, `total_steps`, `has_ab_testing`, `steps` (List of step objects)
- **Step object schema:**
  - `step_order` — position of this step in the sequence (1st, 2nd, 3rd...)
  - `wait_days` — delay before this step fires, relative to the previous step
  - `variants` — a map of the content for this step:
    - `a` — required. `{ title, body }`
    - `b` — optional. `{ title, body }` or `null`

  ```
  variants.b
    ↓
  can be null
  ```

  When `variants.b` is `null`, the sequence has no A/B split for that step and the scheduler must fall back to always assigning variant `a` — this must be handled explicitly wherever the A/B split logic runs, rather than assumed to always have two options.

### `campaigns`
The orchestration entity linking an Audience, a Sequence, and a pool of Sender Email Accounts.
- **Fields:** `id`, `name`, `sender_email_ids` (Sender pool), `sequence_id`, `audience_id`, `schedule_at`, `status` (draft, scheduled, running, paused, completed, cancelled), `current_step_order`
- **Logic:** Follows a "Lazy Generation" model. When a campaign is created, it only generates the `email_transactions` rows for Step 1.

### `email_transactions`
Individual, per-send tracking record for one email sent to one lead in one campaign step. Stores runtime execution state and engagement analytics.

- **Keys:**
  - `PK` — Partition key, groups all sends of one campaign together. Format: `CAMPAIGN#{campaign_id}`. Example: `CAMPAIGN#camp_winter`
  - `SK` — Sort key, uniquely locates this send within the campaign. Format: `MSG#{lead_id}#{step_order}`. Example: `MSG#lead_123#1`

- **Identifiers & Linkage:**
  - `transaction_id` — Unique ID for this single send (one email to one lead in one campaign). A ULID works well since it's also time-sortable. Example: `txn_01HXAB3K9P`
  - `campaign_id` — Which campaign this send belongs to. Keeps overlapping leads across campaigns from colliding, since every send is stamped with its campaign. Example: `camp_winter`
  - `sequence_id` — Which sequence drove this send. Currently 1:1 with the campaign, but stored independently for future flexibility (e.g., campaigns that swap sequences mid-run). Example: `seq_x`
  - `step_order` — Which email in the sequence this is (1st, 2nd, 3rd). Example: `1`
  - `lead_id` — The recipient of this email. This is the Lead's internal ID, not an email address. Example: `lead_123`
  - `sender_email_id` — The actual sender address used; matters when a campaign rotates through several senders. Example: `snd_1`
  - `audience_id` — Which Audience the lead came in through. Optional, useful for slicing stats by audience. Example: `aud_q1`
  - `variant` — The A/B variant that was sent. The key field for A/B stats. Example: `A`

- **Content:**
  - `subject_line` — Rendered subject line actually sent.
  - `template_version` — Version tag of the template used, for tracking template performance over time.

- **Status:**
  - `status` — Current state of this email. One of: `queued`, `sending` (claimed by a scheduler cycle, dispatch in flight), `sent`, `delivered`, `opened`, `clicked`, `replied`, `bounced`, `failed`, `cancelled`, `unsubscribed`. Example: `replied`

- **Timestamps:**
  - `created_at` — When the row was first written (queued). Example: `2026-01-05T09:00:00Z`
  - `scheduled_for` — When the email is meant to go out, derived from the step's wait days. Example: `2026-01-05T09:00:00Z`
  - `sent_at` — When the email actually left the system. Example: `2026-01-05T09:00:04Z`
  - `delivered_at` — When the provider confirmed delivery.
  - `opened_at` — Timestamp of the first open. Stays empty until the first open arrives, and doubles as a duplicate guard so repeat open webhooks don't inflate counts. Example: `2026-01-05T14:22:00Z`
  - `clicked_at` — Timestamp of the first click. Empty until the first click. Example: `null`
  - `replied_at` — When the lead replied. Example: `2026-01-08T10:15:00Z`
  - `bounced_at` — When the email bounced, if it did. Example: `null`

- **Engagement counters:**
  - `open_count` — Total number of opens, since providers fire repeat open events. Pairs with `opened_at` (which marks the first one). Example: `3`
  - `click_count` — Total number of clicks. Example: `0`

- **Delivery diagnostics:**
  - `provider` — Sending provider used (e.g., `ses`).
  - `provider_message_id` — Provider-side message ID, for cross-referencing webhook events and support tickets.
  - `bounce_type` — If it bounced, whether it was hard (dead address) or soft (temporary). Example: `null`
  - `error_message` — The failure reason, if the send failed. Example: `null`

**Example record:**
```json
{
  "transaction_id": "txn_01HXAB3K9P",
  "PK": "CAMPAIGN#camp_winter",
  "SK": "MSG#lead_123#1",

  "campaign_id": "camp_winter",
  "sequence_id": "seq_x",
  "step_order": 1,
  "lead_id": "lead_123",
  "sender_email_id": "snd_1",
  "audience_id": "aud_q1",
  "variant": "A",

  "subject_line": "Quick question, Sarah",
  "template_version": "v2",

  "status": "replied",

  "created_at": "2026-01-05T09:00:00Z",
  "scheduled_for": "2026-01-05T09:00:00Z",
  "sent_at": "2026-01-05T09:00:04Z",
  "delivered_at": "2026-01-05T09:00:11Z",
  "opened_at": "2026-01-05T14:22:00Z",
  "clicked_at": null,
  "replied_at": "2026-01-08T10:15:00Z",
  "bounced_at": null,

  "open_count": 3,
  "click_count": 0,

  "provider": "ses",
  "provider_message_id": "0100018d-aef2-7c3a",
  "bounce_type": null,
  "error_message": null
}
```

---

## 3. Core Workflows & Logic

### Upload Workflow
The entry point for getting leads into the system and grouped into a targetable Audience:

```
Upload CSV
    ↓
Create Leads (deduplicated by email)
    ↓
Generate lead_ids
    ↓
Create Audience
    ↓
Store lead_ids
    ↓
Return audience id
```

### Campaign Execution & Lazy Generation (`campaign_service.py`)
1. **Creation:** When a campaign is created, `generate_step_transactions()` is called for `step_order = 1`, writing one `email_transactions` row per lead (`PK = CAMPAIGN#{campaign_id}`, `SK = MSG#{lead_id}#1`) with `status = queued`.
2. **A/B Split:** It shuffles the `lead_ids` from the Audience and distributes them evenly across available variants (e.g., 50% get Variant A, 50% get Variant B) using round-robin, stamping each row's `variant` field accordingly. If the step's `variants.b` is `null`, every lead is assigned variant `a`.
3. **Scheduler Processing:** A background cron job (`APScheduler` in `app/scheduler/cron.py`) polls the `email_transactions` table using a Global Secondary Index (`status-scheduled_for-index`) every minute. It picks up rows where `status = queued` and `scheduled_for <= now`. Before dispatching, each row is **claimed** via a conditional update (`queued → sending`) so a slow cycle or a second app instance cannot double-send; if no sender account is available the claim is released back to `queued` for retry.
4. **Sending & Mail Merge:**
    - Fetches the Lead data.
    - Resolves variables (e.g., `{{name}}`) using a Jinja-like mail-merge renderer.
    - Uses the `AccountSelectionService` to dynamically pick an active sender from the campaign's `sender_email_ids` pool that hasn't hit its `daily_limit`.
    - Dispatches the email via Gmail API, records `provider` / `provider_message_id`, and updates `status` to `sent` with `sent_at` set.
5. **Delivery & Engagement Tracking:** Opens and clicks are captured natively (see "Open/Click Tracking" below); other transitions (`delivered`, `replied`, `bounced`) arrive via `PATCH /transactions/{id}`. The corresponding `email_transactions` row is updated in place: `delivered_at`/`status=delivered`, `opened_at` + `open_count` (first-open-guarded) /`status=opened`, `clicked_at` + `click_count`/`status=clicked`, `replied_at`/`status=replied`, or `bounced_at` + `bounce_type`/`status=bounced`. Failed sends set `status=failed` with `error_message`. Engagement statuses only move the funnel forward (a late pixel hit never downgrades `replied` to `opened`) and never overwrite terminal statuses.
6. **Next-Step Generation:** After processing, the scheduler checks if all `email_transactions` rows for the `current_step_order` are in a terminal state (sent or a later status, or failed). If they are, it dynamically generates the rows for the *next* step (`current_step_order + 1`), calculating the new `scheduled_for` based on `wait_days`. If no steps remain, the campaign is marked `completed`.

### Lazy Generation, End to End

```
Campaign creation
      ↓
Only Step 1 Email Transactions created
      ↓
Scheduler finishes Step 1
      ↓
Creates Step 2
      ↓
Scheduler finishes Step 2
      ↓
Creates Step 3
      ↓
      ...
      ↓
Campaign Completed
```

### Open/Click Tracking (`tracking_service.py`)

Brevo/Kit-style tracking, applied to **both** sending flows at send time:

1. **Instrumentation** — `instrument_html(html, token, base_url)` rewrites every external link to `{APP_BASE_URL}/c/{token}/{idx}` (originals stored in order on the send record as `tracked_urls`) and appends a 1x1 pixel `{APP_BASE_URL}/o/{token}`. Links pointing at `APP_BASE_URL` itself (the unsubscribe link) are not tracked.
2. **Tokens** — per-send IDs with a flow prefix: `t-{transaction_id}` (campaign flow) or `s-{scheduled_email_id}` (direct flow). No separate token table.
3. **Open endpoint** (`GET /o/{token}`, no auth) — always returns the GIF; logs an event; updates `opened_at`/`open_count`/`status=opened` unless the hit is bot-suspect.
4. **Click endpoint** (`GET /c/{token}/{idx}`, no auth) — looks up `tracked_urls[idx]` on the send record and 302-redirects; unknown token/idx → 404. Not an open redirect: the destination never comes from the request.
5. **`email_events` table** — one row per hit: `token` (PK), `event_id` (SK, ULID), `type` (`open`/`click`), `url`, `user_agent`, `is_bot_suspect`, `created_at`. Readable via `GET /transactions/{id}/events`.
6. **Bot filtering** — an open is flagged `is_bot_suspect` (logged but not counted) if the user-agent matches proxy/prefetch markers (GoogleImageProxy, YahooMailProxy, bot/crawler/spider, curl…) or the hit lands < 2 seconds after `sent_at`. Clicks are treated as ground truth and always count. Unique opens = rows with `opened_at`, not raw event counts.

Bounce/complaint ingestion is not implemented: the Gmail API offers no delivery webhooks. Future options: poll the sender inbox for NDR bounce messages, or switch sending to SES/SendGrid and feed their webhooks into `email_events`.

### Email Transaction Status Flow

Rather than a flat status list, the statuses form a small set of lifecycle paths:

**Normal path**
```
queued
  ↓
sent
  ↓
delivered
  ↓
opened
  ↓
clicked
  ↓
replied
```

**Failure path**
```
queued
  ↓
failed
```

**Bounce path**
```
sent
  ↓
bounced
```

A transaction can stop at any point along the normal path (e.g., `sent` but never `opened`) — reaching `replied` isn't guaranteed, and the later stages are best-effort based on whether the recipient engages and whether the provider fires the corresponding webhook.

---

## 4. Recent Architectural Changes to Note

**Planned rename: "Audiences" → "Lead Lists" (NOT yet done):**
- A full rename from `Audience` to `Lead List` is planned but has **not** been applied to the codebase. Today the DynamoDB table is `audiences`, the API routes are grouped under `/audiences`, and campaigns/transactions reference `audience_id`.
- When the rename lands it will be its own PR touching domain models, workflows, campaigns, API route names, and this document.
- The `Lead` schema includes a `tags: List[str]` field, used for search/filtering only (see Section 2).

**Expanding `campaign_emails` into `email_transactions`:**
- The original `campaign_emails` table (fields: `id`, `campaign_id`, `lead_id`, `step_order`, `selected_variant`, `sender_email_id`, `status: pending/sent/failed`, `scheduled_at`, `sent_at`) has been superseded by `email_transactions`.
- Key schema changes: single-table key design (`PK = CAMPAIGN#{campaign_id}`, `SK = MSG#{lead_id}#{step_order}`), a dedicated time-sortable `transaction_id` (ULID), a much richer `status` enum (`queued, sending, sent, delivered, opened, clicked, replied, bounced, failed, cancelled, unsubscribed`) in place of the old three-value one, and new engagement/diagnostic fields (`open_count`, `click_count`, `bounce_type`, `provider`, `provider_message_id`, `error_message`, `template_version`, `subject_line`).
- The scheduler's GSI moves from `status-scheduled_at-index` to `status-scheduled_for-index` to match the renamed timestamp field.
- A second GSI, `transaction_id-index`, supports direct lookup by `transaction_id` (used by `PATCH /transactions/{id}`); it is retrofitted onto existing tables at app startup.
- Anything referencing `campaign_emails`, `selected_variant`, `scheduled_at`, or `generate_step_emails()` should be updated to `email_transactions`, `variant`, `scheduled_for`, and `generate_step_transactions()` respectively.

**Streamlit frontend removed:**
- The Streamlit frontend (`streamlit_app/`, `api_client.py`, Streamlit pages, and related TODOs) has been dropped from the project. This document now describes backend architecture only.

---

## 5. File Structure

```
app/
├── api/
├── database/
├── models/
├── repositories/
├── scheduler/
├── services/
├── utils/
├── main.py
```

- `app/api/`: FastAPI routers (`audience_routes.py`, `campaign_routes.py`, `sequence_routes.py`, `transaction_routes.py`, `routes.py`) plus `deps.py` (API-key auth dependency).
- `app/models/`: Pydantic models for request validation and data structures.
- `app/services/`: Core business logic (`campaign_service.py`, `account_selection_service.py`, `gmail_service.py`).
- `app/repositories/`: Generic wrapper for DynamoDB CRUD operations and GSI querying.
- `app/scheduler/`: APScheduler cron jobs (`cron.py`) that process `email_transactions`.
- `app/database/`: DynamoDB table definitions and connection setup.
- `app/utils/`: Shared helpers (mail-merge rendering, ID generation, etc.).

---

## 6. Architecture Diagram

```
Sender Email Accounts
        │
        ▼
    Audiences
        │
        ├── lead_ids
        └── tags
        │
        ▼
    Sequences
        │
        ▼
    Campaigns
        │
        ▼
  Email Transactions
        │
        ▼
     Scheduler
        │
        ▼
    Gmail / SES
```

---

## 7. Design Principles

A quick reference for where logic belongs, to help future contributors avoid putting responsibilities in the wrong place:

- **Leads** — Store recipient information.
- **Audiences** — Store reusable collections of Lead IDs.
- **Sequences** — Store email templates and timing only.
- **Campaigns** — Orchestrate sender accounts, lead lists, and sequences.
- **Email Transactions** — Store runtime execution state and engagement analytics.
- **Scheduler** — Execute pending email transactions and generate the next sequence step.
- **Email Accounts** — Manage OAuth, sender rotation, signatures, and sending limits.
