# Outbound Dashboard

Single source of truth for the email-automation app. This one project contains
**both** the frontend and the backend:

```
outbound-dashboard/
├── app/ components/ lib/ hooks/   # Next.js frontend (App Router)
└── fastapi-backend/               # FastAPI backend (campaigns, sequences,
                                   #   AI sequences, leads, tracking) on DynamoDB
```

The frontend talks to the backend over HTTP (`NEXT_PUBLIC_API_URL`, default
`http://127.0.0.1:8000`) — see [lib/api.ts](lib/api.ts). It does not import
backend code directly.

## Getting Started

### 1. Backend (`fastapi-backend/`)

```bash
cd fastapi-backend
python3 -m venv venv
./venv/bin/python -m pip install -r requirements.txt

# Configure secrets (AWS, Google OAuth, GEMINI_API_KEY, …)
cp .env.example .env   # then edit .env

# Run on http://127.0.0.1:8000
./venv/bin/python -m uvicorn app.main:app --reload --port 8000
```

`.env`, `venv/`, and `research_lab_service_key.json` are git-ignored — they hold
secrets / environment-specific state and must not be committed.

### 2. Frontend

```bash
# from the repo root (outbound-dashboard/)
npm install
npm run dev            # http://localhost:3000
```

`.env.local` sets `NEXT_PUBLIC_API_URL=http://127.0.0.1:8000`. Point it at a
deployed backend URL for staging/production.

## Backend API surface (selected)

- `GET /email-accounts`, `GET /leads`, `GET /audiences`, `GET /sequences`,
  `GET /campaigns`, `GET /transactions` — data the dashboard hydrates from.
- `/ai/sequences/*` — Gemini-powered sequence generation, refine, regenerate-step
  (requires `GEMINI_API_KEY`).
- `/debug/database` — dumps every DynamoDB table (secrets redacted) for the
  `/dashboard`-adjacent `/test-database` page.

CORS allows `localhost:3000/3001` by default; override with the `CORS_ORIGINS`
env var (comma-separated) for other origins.

## Notes

- The backend was previously maintained as a separate `Email-Automation`
  project. It now lives here in `fastapi-backend/` as the single source of truth.
- Built with [Next.js](https://nextjs.org) (App Router) and
  [FastAPI](https://fastapi.tiangolo.com).
