# Email Automation Platform

FastAPI service for cold email outreach: lead lists, multi-step sequences, campaigns, Gmail sending across rotating sender accounts, and open/click tracking. Sequence copy can be generated with Gemini. State lives in DynamoDB.

## Running locally

```bash
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # then fill it in
uvicorn app.main:app --reload
```

Interactive API docs are at `http://127.0.0.1:8000/docs`.

On startup the app creates any missing DynamoDB tables and starts an APScheduler that polls for due email transactions every minute and resets per-account daily send counters at midnight. Both behaviours are controlled by `RUN_INPROCESS_SCHEDULER`, which defaults to on.

### Configuration

Every setting is an environment variable, read from `.env` locally. See `.env.example` for the full list. The ones that change behaviour rather than just supplying credentials:

- **`API_KEY`** — when set, every endpoint requires it in an `X-API-Key` header. **When unset, auth is disabled entirely.** That's the intended default for local dev and a serious mistake on a public URL.
- **`APP_BASE_URL`** — the public origin used to build unsubscribe links and tracking URLs. If it's unset, outgoing email is sent with **no open or click tracking at all**, silently. Must be a publicly reachable HTTPS origin in production.
- **`RUN_INPROCESS_SCHEDULER`** — runs the cron jobs and table setup inside the API process. Leave on for local and any always-on host; turn it off on serverless (see below).
- **`ENABLE_LEGACY_SCHEDULER`** — polls the deprecated `/emails/*` direct-scheduling endpoints. On by default.
- **`GEMINI_API_KEY`** — required for the `/ai/sequences/*` endpoints. Without it, those routes fail; the rest of the API is unaffected.

### Gmail OAuth

`GOOGLE_REDIRECT_URI` must exactly match an authorized redirect URI on your Google OAuth client, and must point at `/gmail/callback` — locally, `http://127.0.0.1:8000/gmail/callback`. Hit `GET /email-accounts/connect` to start the consent flow; the callback stores the refresh token that sending uses.

## Endpoints

| Prefix | Purpose |
| --- | --- |
| `/email-accounts` | Connect, list, and manage Gmail sender accounts and their daily limits |
| `/leads` | CSV upload and lead listing |
| `/audiences` | Lead lists |
| `/sequences` | Multi-step sequence definitions |
| `/ai/sequences` | Gemini-backed sequence generation, refinement, and per-step regeneration |
| `/campaigns` | Campaign lifecycle: create, pause, resume, cancel |
| `/transactions` | Per-recipient send records and their event history |
| `/o/{token}`, `/c/{token}/{idx}` | Open pixel and click redirect |
| `/unsubscribe/{transaction_id}` | Recipient-facing opt-out |

`/gmail/callback`, `/unsubscribe`, `/o/`, and `/c/` are exempt from `X-API-Key` auth, since they're hit by Google and by recipients' mail clients rather than by your own frontend.

## Deploying to Modal

`modal_app.py` defines the deployment. The scheduler is the one thing that does not port over unchanged: a Modal web container scales to zero, so an in-process APScheduler would stop ticking whenever no HTTP traffic is arriving, and would double-tick — sending duplicate email — whenever Modal ran more than one container. So on Modal the web app sets `RUN_INPROCESS_SCHEDULER=false`, and the two cron jobs run as Modal scheduled functions with `max_containers=1`, which serializes them.

```bash
pip install modal && modal setup
```

**1. Create the secret.** Same keys as `.env`, plus `RUN_INPROCESS_SCHEDULER=false`. Set a real `API_KEY` here — the URL is public.

```bash
modal secret create email-automation \
  AWS_REGION=... AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=... \
  GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... GOOGLE_REDIRECT_URI=... \
  GEMINI_API_KEY=... GEMINI_MODEL=gemini-2.5-flash \
  USERS_TABLE=users EMAIL_ACCOUNTS_TABLE=email_accounts LEADS_TABLE=leads \
  SCHEDULED_EMAILS_TABLE=scheduled_emails EMAIL_LOGS_TABLE=email_logs \
  LEAD_LISTS_TABLE=lead_lists SEQUENCES_TABLE=sequences \
  SEQUENCE_STEPS_TABLE=sequence_steps CAMPAIGNS_TABLE=campaigns \
  EMAIL_TRANSACTIONS_TABLE=email_transactions \
  API_KEY=... RUN_INPROCESS_SCHEDULER=false
```

**2. Create the tables once**, rather than on every cold start:

```bash
modal run modal_app.py::init_tables
```

**3. Deploy, then close the URL loop.**

```bash
modal deploy modal_app.py
```

This prints your web URL. Two settings depend on a URL you don't have until after the first deploy, so the first deploy is necessarily provisional: set `APP_BASE_URL` to that URL and `GOOGLE_REDIRECT_URI` to `https://<url>/gmail/callback`, then redeploy. Until you do, **email sends without tracking**. Overwrite the secret with `modal secret create email-automation --force ...`, re-passing every key. Add the new redirect URI to your Google OAuth client as well.

`modal serve modal_app.py` gives a live-reloading temporary URL, which is the easier way to test the OAuth callback before committing to a deploy.

### Notes on the Modal setup

- **`reset_daily_counters` runs at midnight UTC.** If daily send limits should reset on a local day boundary, pass a timezone: `modal.Cron("0 0 * * *", timezone="Asia/Kolkata")`.
- **`min_containers=1`** keeps one web container warm, because the open pixel and click redirect are loaded by recipients' mail clients and a cold start there is a visibly slow image or link. Drop it to cut cost.
- **The legacy `process_scheduled_emails` poller is not deployed.** If you still need the `/emails/*` direct-scheduling path, add it as another `modal.Period(minutes=1)` function in the same shape as the others.
- **Gemini auth uses `GEMINI_API_KEY`.** `ai_sequence_service.py` can fall back to a Vertex service-account key at `research_lab_service_key.json`, but that file is gitignored and is deliberately not copied into the image. To use the Vertex path, put the JSON in a secret value and write it to disk at runtime — don't bake a key into the image.
