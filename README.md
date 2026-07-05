# Email Automation Platform

Cold email outreach automation: upload leads into Audiences, build multi-step Sequences (with A/B testing), connect Gmail sender accounts via OAuth, and run drip Campaigns with per-send tracking.

See `SYSTEM_ARCHITECTURE.md` for the full domain model and logic flow.

## Tech Stack
- **Backend**: FastAPI (Python)
- **Database**: AWS DynamoDB (boto3)
- **Email Provider**: Gmail API (OAuth)
- **Scheduler**: APScheduler (in-process, polls every minute)

## Setup

1. **Create virtual environment and install dependencies**
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```

2. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   Fill in:
   - AWS credentials with DynamoDB permissions
   - Google OAuth client (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`) with the Gmail send scope
   - `API_KEY` — optional; when set, every endpoint (except `/gmail/callback` and `/unsubscribe`) requires the `X-API-Key` header
   - `APP_BASE_URL` — public base URL, used to build unsubscribe links

3. **Run**
   ```bash
   uvicorn app.main:app --reload
   ```
   On first run the app creates all DynamoDB tables and GSIs (including retrofitting `transaction_id-index` onto an existing `email_transactions` table).

4. **Tests**
   ```bash
   python -m pytest tests/ -v
   ```

## Core API

Interactive docs at `/docs`.

### Sender accounts
- `GET /email-accounts/connect` — start Gmail OAuth; `GET /gmail/callback` completes it
- `GET /email-accounts` — list accounts with daily limits, signatures, linked-campaign info
- `PATCH /email-accounts/{id}/limit` / `/active` / `/signature` — manage an account
- `DELETE /email-accounts/{id}` — blocked while linked to active campaigns

### Leads & audiences
- `POST /leads/upload` — CSV upload (`name`, `email`, `company` required; extra columns become mail-merge variables). Deduplicates by email and creates an Audience.
- `GET /leads` — list leads
- `GET /audiences` / `GET /audiences/{id}` — list / detail with resolved leads
- `POST /audiences/{id}/leads` — append leads (CSV or existing lead IDs) to an audience
- `PUT /audiences/{id}` / `DELETE /audiences/{id}`

### Sequences & campaigns
- `POST /sequences` — multi-step templates with optional A/B variants per step
- `POST /campaigns` — link audience + sequence + sender pool; generates step-1 transactions immediately (lazy generation)
- `GET /campaigns` — list with per-campaign stats
- `POST /campaigns/{id}/pause` / `/resume` / `/cancel`

### Transactions & tracking
- `GET /transactions` — filterable per-send records (status, variant, campaign, lead…)
- `PATCH /transactions/{id}` — status transitions (delivered/opened/clicked/replied/bounced), with automatic timestamps and counters
- `GET /transactions/{id}/events` — raw open/click event log for a send (includes bot-flagged events)
- `GET /unsubscribe/{transaction_id}` — recipient unsubscribe link (no auth)

### Open/click tracking (automatic)
Every outgoing email (both flows) is instrumented before sending:
- A 1x1 pixel (`GET /o/{token}`) records opens
- Links are rewritten to `GET /c/{token}/{idx}`, which logs the click and 302-redirects to the original URL (destinations are stored server-side at send time — not taken from the request, so the endpoint is not an open redirect)
- Every hit is logged to the `email_events` table with the user-agent; opens from image proxies/prefetchers (GoogleImageProxy etc.) or arriving <2s after send are flagged `is_bot_suspect` and don't count as engagement. Clicks always count.
- Requires `APP_BASE_URL` to be a publicly reachable domain (HTTPS recommended for deliverability).

### Direct email scheduling (non-campaign flow)
`POST /emails/schedule`, `POST /emails/bulk-schedule`, `POST /emails/bulk-schedule-by-filter`, `GET /emails/scheduled` — schedule one-off emails to leads without a campaign/sequence. Their scheduler job runs by default; set `ENABLE_LEGACY_SCHEDULER=false` to disable it.
