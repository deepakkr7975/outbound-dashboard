# 🚀 Outbound Dashboard (Kallix)

[![Next.js](https://img.shields.io/badge/Next.js-16.2-black?style=flat&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2-blue?style=flat&logo=react)](https://react.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-2.0-009688?style=flat&logo=fastapi)](https://fastapi.tiangolo.com/)
[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=flat&logo=python)](https://python.org)
[![AWS DynamoDB](https://img.shields.io/badge/AWS-DynamoDB-4053D6?style=flat&logo=amazon-aws)](https://aws.amazon.com/dynamodb/)
[![Google Gemini](https://img.shields.io/badge/Google-Gemini_2.5_Flash-8E75B2?style=flat&logo=google)](https://deepmind.google/technologies/gemini/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?style=flat&logo=tailwindcss)](https://tailwindcss.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

An enterprise-ready, full-stack cold email outreach and automated campaign platform. Outbound Dashboard streamlines multi-sender mailbox rotation, lead audience management, drag-and-drop multi-step sequences with native A/B testing, Gemini-powered AI copywriting, and granular real-time email transaction analytics.

---

## 📸 Screenshots

| **Dashboard Overview & Metrics** | **Audience & Lead Management** |
|:---:|:---:|
| ![Dashboard Overview](simulate-test/ss/01_dashboard-overview.png) | ![Audiences Panel](simulate-test/ss/04_audiences.png) |

| **Campaign Orchestration** | **Multi-Step Sequences & Timelines** |
|:---:|:---:|
| ![Campaigns Panel](simulate-test/ss/06_campaigns.png) | ![Sequences Panel](simulate-test/ss/08_sequences.png) |

---

## 📑 Table of Contents

- [Key Features](#-key-features)
- [System Architecture](#-system-architecture)
- [Tech Stack](#-tech-stack)
- [Database Schema (DynamoDB)](#-database-schema-dynamodb)
- [Project Directory Structure](#-project-directory-structure)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [1. Backend Setup (FastAPI)](#1-backend-setup-fastapi)
  - [2. Frontend Setup (Next.js)](#2-frontend-setup-nextjs)
- [Google Cloud OAuth 2.0 Configuration](#-google-cloud-oauth-20-configuration)
- [Environment Variables](#-environment-variables)
- [API Reference](#-api-reference)
- [Deployment](#-deployment)
  - [Backend on Modal (Serverless)](#backend-on-modal-serverless)
  - [Frontend on Vercel](#frontend-on-vercel)
- [End-to-End Simulation & Testing](#-end-to-end-simulation--testing)
- [License](#-license)

---

## ✨ Key Features

### 📬 1. Multi-Sender Inbox Rotation & Warmup Safeguards
- **Native Gmail Integration**: Seamless OAuth 2.0 connection to link Google Workspace and Gmail accounts securely.
- **Round-Robin Sender Rotation**: Distribute outbound volume evenly across multiple linked mailboxes to protect sender reputation and avoid spam filters.
- **Inbox Linked Status**: Visual indicators distinguishing `free` inboxes from those actively `linked` to live campaigns.
- **Daily Quotas & Counters**: Enforces daily send limits per inbox with automatic midnight counter resets.
- **Dynamic Signature Management**: Built-in rich HTML editor supporting personalized tokens (`{first_name}`, `{company}`, `{role}`, `{city}`).

### 👥 2. Audiences & Lead Management
- **Smart CSV Ingestion**: Upload lead spreadsheets with interactive column mapping (`email`, `name`, `role`, `company`, `city`).
- **Automatic Deduplication**: Prevent duplicate outreach by automatically deduplicating leads within audiences.
- **Tagging & Segmentation**: Categorize leads into targeted segments using custom tags.
- **Contact History**: Real-time status indicators tracking whether a lead has been contacted and which campaign step they are currently on.

### ⚡ 3. Sequences & Drag-and-Drop Workflow Builder
- **Visual Step Builder**: Reorder outreach steps dynamically using `@dnd-kit` drag-and-drop.
- **Cadence & Wait Days**: Configure customizable delay periods (`wait_days`) between sequence steps (e.g., Step 1: Immediate, Step 2: +3 days, Step 3: +4 days).
- **Template Variables**: Dynamically render recipient attributes directly in subject lines and email bodies.

### 🧪 4. Built-In A/B Split Testing
- **Multi-Variant Subject Lines & Bodies**: Define Variant A and Variant B for any step to test hooks, calls-to-action, or entire email bodies.
- **Granular Conversion Split**: Compare open, click, and reply rates across variants to double down on winning copy.

### 🤖 5. AI Sequence Generation (Google Gemini 2.5)
- **Prompt-to-Sequence Generation**: Describe your target persona, product value proposition, and tone to generate complete multi-step sequences in seconds.
- **Knowledge Upload (PDF / DOCX)**: Upload case studies, whitepapers, or marketing collateral to train the AI copy generator on your product context.
- **Smart Refinement**: Regenerate individual steps, rewrite opening hooks, or request tone adjustments directly from the UI.

### 🚀 6. Campaign Orchestration
- **5-Step Launch Wizard**: Step-by-step campaign creation (Details ➔ Select Senders ➔ Attach Sequence ➔ Target Audience ➔ Schedule).
- **Timezone-Aware Delivery**: Schedule campaigns to initiate outreach at optimal recipient local times.
- **Full Lifecycle Management**: Draft, schedule, run, pause, resume, or cancel campaigns on demand.

### 📈 7. Granular Event Tracking & Funnel Analytics
- **ULID-Indexed Transactions**: Every dispatch is tracked at the individual recipient-step level.
- **Open Tracking**: Invisible 1x1 transparent tracking pixel (`/o/{token}`) with bot-filter heuristics.
- **Click Tracking**: High-speed redirect engine (`/c/{token}/{idx}`) recording link interactions.
- **One-Click Unsubscribe**: Built-in opt-out mechanism (`/unsubscribe/{transaction_id}`) updating lead preferences instantly.
- **Interactive Visualizations**: Conversion funnels, status distributions, and timeline charts powered by Recharts.
- **CSV Data Export**: Export transactional records and metrics for offline analysis.

### 🛠 8. Live Database Inspector
- **In-App DynamoDB Viewer**: Built-in `/test-database` inspector allowing developers to query and inspect all underlying DynamoDB tables with automatic credential redaction.

---

## 🏗 System Architecture

```mermaid
flowchart TD
    subgraph Frontend ["Frontend (Next.js 16 App Router)"]
        UI[User Dashboard & Control Center]
        Builder[Drag-and-Drop Sequence Builder]
        Wizard[Campaign Launch Wizard]
        Analytics[Real-Time Analytics & Funnels]
        DBViewer[Live Database Inspector]
    end

    subgraph Backend ["Backend (FastAPI Engine)"]
        API[REST API Gateway]
        Auth[API Key & OAuth Middleware]
        AISvc[Gemini 2.5 AI Service]
        Sched[APScheduler Engine]
        Tracker[Tracking & Redirect Engine]
    end

    subgraph External ["External Services & Infrastructure"]
        Dynamo[(AWS DynamoDB Tables)]
        Gemini[Google Gemini API]
        Gmail[Gmail API / OAuth 2.0]
        Recipients[Email Recipients]
    end

    UI -->|HTTP REST / JSON| API
    Builder -->|HTTP REST / JSON| API
    Wizard -->|HTTP REST / JSON| API
    Analytics -->|HTTP REST / JSON| API
    DBViewer -->|/debug/database| API

    API --> Auth
    API --> AISvc
    AISvc -->|Prompt & Context| Gemini
    API --> Dynamo

    Sched -->|Poll Due Transactions Every 1m| Dynamo
    Sched -->|Round-Robin Dispatch| Gmail
    Gmail -->|Delivers Outreach Email| Recipients

    Recipients -->|1x1 Pixel Load /o/{token}| Tracker
    Recipients -->|Link Click /c/{token}/{idx}| Tracker
    Recipients -->|Unsubscribe /unsubscribe/{id}| Tracker
    Tracker -->|Record Event & Timestamps| Dynamo
```

---

## 💻 Tech Stack

| Domain | Technology | Description |
|---|---|---|
| **Frontend Framework** | [Next.js 16](https://nextjs.org/) | App Router, Server Components & Client Hooks |
| **Frontend UI & Styling** | [React 19](https://react.dev/), [Tailwind CSS v4](https://tailwindcss.com/) | Modern UI styling, animations, and responsive layouts |
| **Component System** | [shadcn/ui](https://ui.shadcn.com/), [Base UI](https://base-ui.com/) | Accessible, customizable headless components |
| **Tables & Charts** | [TanStack Table v8](https://tanstack.com/table), [Recharts](https://recharts.org/) | Virtualized data tables and interactive analytics charts |
| **Drag & Drop** | [@dnd-kit](https://dndkit.com/) | Sortable sequence step timeline builder |
| **Backend Framework** | [FastAPI](https://fastapi.tiangolo.com/) | High-performance Python async REST API |
| **AI Engine** | [Google Gemini 2.5 Flash](https://deepmind.google/technologies/gemini/) (`google-genai`) | Cold outreach sequence generation & refinement |
| **Database** | [Amazon DynamoDB](https://aws.amazon.com/dynamodb/) (`boto3`) | High-throughput serverless NoSQL datastore |
| **Scheduler** | [APScheduler](https://apscheduler.readthedocs.io/) | In-process cron polling for due transactions and quota resets |
| **Email Protocol** | [Gmail REST API](https://developers.google.com/gmail/api) | Multi-account OAuth 2.0 authenticated email dispatch |
| **Serverless Deployment** | [Modal](https://modal.com/) (`modal_app.py`) | Containerized serverless deployment with scheduled jobs |

---

## 🗄 Database Schema (DynamoDB)

The platform utilizes a structured DynamoDB architecture designed for high write throughput and zero-collision tracking:

| Table Name | Primary Key | Key Attributes / Purpose |
|---|---|---|
| `email_accounts` | `id` (String) | Sender email, OAuth refresh token, daily send limit, `sent_today`, linked status, and campaign IDs |
| `leads` | `id` (String) | Lead contact details (`email`, `name`, `role`, `company`, `city`), `audience_id`, `emails_sent` count |
| `lead_lists` (audiences) | `id` (String) | Audience name, description, tags, source CSV name, and total member count |
| `sequences` | `sequence_id` (String) | Outreach template metadata, step count, A/B testing flag, AI-generated flag |
| `sequence_steps` | `id` (String) | Step order, `wait_days`, Variant A (subject + body), Variant B (optional split test) |
| `campaigns` | `campaign_id` (String) | Campaign state, linked sender accounts, sequence ID, audience ID, schedule timestamp, status |
| `email_transactions` | Partition: `PK` (`CAMPAIGN#<id>`)<br>Sort: `SK` (`MSG#<lead_id>#<step>`) | Granular transaction record: timestamps (`queued`, `sent`, `delivered`, `opened`, `clicked`, `replied`, `bounced`), variant (`A`/`B`), open/click counters |
| `users` | `id` (String) | User profiles and authentication records |

---

## 📁 Project Directory Structure

```text
outbound-dashboard/
├── app/                                # Next.js App Router
│   ├── dashboard/                      # Dashboard views
│   │   ├── account/                    # Account settings & profile
│   │   ├── analytics/                  # Performance analytics & metrics
│   │   ├── audiences/                  # Audience lists & CSV upload
│   │   ├── campaigns/                  # Campaign manager & launch wizard
│   │   ├── export/                     # Export logs & transaction reports
│   │   ├── leads/                      # Contact database & lead records
│   │   ├── sender-emails/              # Mailbox management & Gmail OAuth
│   │   ├── sequences/                  # Sequence timeline builder & AI generator
│   │   └── settings/                   # System & platform configuration
│   ├── test-database/                  # In-app DynamoDB viewer
│   ├── globals.css                     # Global CSS & Tailwind design tokens
│   └── layout.tsx                      # Root application layout
├── components/                         # React UI Components
│   ├── modules/                        # Feature panels (Campaigns, Sequences, etc.)
│   ├── ui/                             # shadcn/ui base design system primitives
│   ├── app-sidebar.tsx                 # Navigation sidebar
│   ├── chart-area-interactive.tsx      # Recharts analytics charts
│   └── data-table.tsx                  # TanStack filterable data table
├── lib/                                # Frontend core utilities & API client
│   ├── api.ts                          # Type-safe HTTP client for FastAPI backend
│   └── types.ts                        # TypeScript interfaces & domain types
├── fastapi-backend/                    # Python FastAPI Backend
│   ├── app/
│   │   ├── api/                        # API route controllers
│   │   │   ├── ai_sequence_routes.py   # Gemini AI sequence endpoints
│   │   │   ├── audience_routes.py      # Lead lists & CSV processing
│   │   │   ├── campaign_routes.py      # Campaign execution & lifecycle
│   │   │   ├── sequence_routes.py      # Sequence CRUD & step reordering
│   │   │   ├── tracking_routes.py      # Open pixel, click redirect, unsubscribe
│   │   │   └── transaction_routes.py   # Transactional audit log & analytics
│   │   ├── database/                   # DynamoDB initialization & schema creation
│   │   ├── repositories/               # DynamoDB query & scan abstraction
│   │   ├── scheduler/                  # APScheduler jobs (dispatch & quota reset)
│   │   ├── services/                   # Business logic (Gmail, Gemini AI, Campaign)
│   │   └── main.py                     # FastAPI application factory & CORS setup
│   ├── modal_app.py                    # Serverless Modal deployment script
│   ├── requirements.txt                # Python dependencies
│   └── .env.example                    # Backend environment configuration template
├── simulate-test/                      # Integration test scripts & screenshot assets
└── PRD_Email_Dashboard_Functional.md   # Functional product requirement document
```

---

## 🚀 Getting Started

### Prerequisites

Ensure you have the following installed on your local environment:
- **Node.js**: v18.18.0 or later (v20+ recommended)
- **Python**: v3.10 or later (v3.11 recommended)
- **AWS Account**: With permissions to create/read/write Amazon DynamoDB tables
- **Google Cloud Console Account**: For Gmail API OAuth 2.0 client credentials
- **Google Gemini API Key**: For AI sequence generation features

---

### 1. Backend Setup (FastAPI)

1. **Navigate to the backend directory**:
   ```bash
   cd fastapi-backend
   ```

2. **Create and activate a Python virtual environment**:
   ```bash
   python3 -m venv venv
   source venv/bin/activate    # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment variables**:
   ```bash
   cp .env.example .env
   ```
   Open `.env` in your editor and enter your credentials (see [Environment Variables](#-environment-variables) below).

5. **Start the FastAPI development server**:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```

> **Note**: On startup, the backend automatically checks and creates any missing DynamoDB tables in your configured AWS region.
> Interactive API Swagger documentation is available at: **`http://127.0.0.1:8000/docs`**

---

### 2. Frontend Setup (Next.js)

1. **Navigate to the repository root**:
   ```bash
   cd ..   # Return to outbound-dashboard/
   ```

2. **Install Node.js dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables**:
   ```bash
   cp .env.local.example .env.local
   ```
   Verify that `NEXT_PUBLIC_API_URL` points to your backend instance:
   ```env
   NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
   ```

4. **Run the Next.js development server**:
   ```bash
   npm run dev
   ```

5. **Open your browser**:
   Navigate to **`http://localhost:3000`** to access the Outbound Dashboard.

---

## 🔑 Google Cloud OAuth 2.0 Configuration

To allow Outbound Dashboard to send cold emails via Gmail accounts:

1. Open the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project (e.g., `Outbound-Dashboard`).
3. Enable the **Gmail API** under **APIs & Services ➔ Library**.
4. Configure the **OAuth Consent Screen**:
   - User Type: **External** (or Internal for Google Workspace domains).
   - Scopes required:
     - `https://www.googleapis.com/auth/gmail.send`
     - `https://www.googleapis.com/auth/gmail.readonly`
     - `https://www.googleapis.com/auth/userinfo.email`
5. Create Credentials:
   - Navigate to **Credentials ➔ Create Credentials ➔ OAuth Client ID**.
   - Application type: **Web Application**.
   - Name: `Outbound Dashboard Local`.
   - **Authorized redirect URIs**:
     - `http://127.0.0.1:8000/gmail/callback` (Local Development)
     - `https://your-backend-domain.com/gmail/callback` (Production)
6. Copy the **Client ID** and **Client Secret** into your `fastapi-backend/.env`.
7. In the dashboard under **Sender Emails**, click **Connect Gmail** to authorize sender inboxes.

---

## ⚙️ Environment Variables

### Backend (`fastapi-backend/.env`)

| Variable | Required | Description | Example |
|---|---|---|---|
| `AWS_REGION` | **Yes** | AWS Region for DynamoDB | `us-east-1` |
| `AWS_ACCESS_KEY_ID` | **Yes** | AWS Access Key ID with DynamoDB permissions | `AKIAIOSFODNN7EXAMPLE` |
| `AWS_SECRET_ACCESS_KEY` | **Yes** | AWS Secret Access Key | `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` |
| `GOOGLE_CLIENT_ID` | **Yes** | Google OAuth 2.0 Client ID | `xxx.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | **Yes** | Google OAuth 2.0 Client Secret | `GOCSPX-xxxxxx` |
| `GOOGLE_REDIRECT_URI` | **Yes** | OAuth redirect URI callback URL | `http://127.0.0.1:8000/gmail/callback` |
| `GEMINI_API_KEY` | Optional | Google Gemini API Key for AI Sequence generator | `AIzaSy...` |
| `GEMINI_MODEL` | Optional | Model identifier for Gemini | `gemini-2.5-flash` |
| `API_KEY` | Optional | API security token (enforces `X-API-Key` header) | *Disabled locally if empty* |
| `APP_BASE_URL` | **Yes** (Prod) | Public URL for open tracking pixel and click redirects | `http://127.0.0.1:8000` |
| `RUN_INPROCESS_SCHEDULER`| Optional | Enable background cron in FastAPI process | `true` |
| `CORS_ORIGINS` | Optional | Allowed CORS origins for API requests | `http://localhost:3000` |

### Frontend (`.env.local`)

| Variable | Required | Description | Example |
|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | **Yes** | Base URL pointing to the FastAPI backend | `http://127.0.0.1:8000` |

---

## 📡 API Reference

Interactive OpenAPI documentation is generated live at `http://127.0.0.1:8000/docs`. Key routes include:

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/email-accounts` | List all sender inboxes with daily quotas and linked statuses |
| `GET` | `/email-accounts/connect` | Initialize Google OAuth 2.0 consent flow |
| `GET` | `/gmail/callback` | Google OAuth callback handler storing refresh tokens |
| `POST` | `/audiences` | Create a lead audience and process CSV spreadsheet upload |
| `GET` | `/audiences/{id}/leads` | Retrieve paginated leads within a specific audience |
| `POST` | `/sequences` | Create a multi-step sequence with wait-days and A/B variants |
| `PUT` | `/sequences/{id}/steps/reorder` | Update step order following drag-and-drop actions |
| `POST` | `/ai/sequences/generate` | Generate complete sequence copy via Google Gemini 2.5 |
| `POST` | `/ai/sequences/refine` | Refine sequence tone or regenerate specific step copy |
| `POST` | `/campaigns` | Create and schedule a new multi-sender campaign |
| `POST` | `/campaigns/{id}/pause` | Pause an active sending campaign |
| `POST` | `/campaigns/{id}/resume` | Resume a paused campaign |
| `GET` | `/transactions` | Query granular transaction logs with filterable status |
| `GET` | `/o/{token}` | Transparent 1x1 open-tracking pixel handler |
| `GET` | `/c/{token}/{idx}` | Link-click redirect tracker |
| `GET` | `/unsubscribe/{id}` | Recipient one-click unsubscribe handler |
| `GET` | `/debug/database` | Dumps table schemas and contents with masked credentials |

---

## ☁️ Deployment

### Backend on Modal (Serverless)

The backend includes a native [`modal_app.py`](fastapi-backend/modal_app.py) configuration for deployment to [Modal](https://modal.com):

1. **Install and configure Modal**:
   ```bash
   pip install modal
   modal setup
   ```

2. **Create the environment secret**:
   ```bash
   modal secret create email-automation \
     AWS_REGION=us-east-1 \
     AWS_ACCESS_KEY_ID=your_key \
     AWS_SECRET_ACCESS_KEY=your_secret \
     GOOGLE_CLIENT_ID=your_google_id \
     GOOGLE_CLIENT_SECRET=your_google_secret \
     GOOGLE_REDIRECT_URI=https://<your-modal-app>.modal.run/gmail/callback \
     GEMINI_API_KEY=your_gemini_key \
     RUN_INPROCESS_SCHEDULER=false
   ```

3. **Deploy to production**:
   ```bash
   modal deploy modal_app.py
   ```

> Modal automatically handles zero-scale serverless execution while keeping dedicated scheduled cron functions running for email dispatch and counter resets.

### Frontend on Vercel

1. Push your repository to GitHub.
2. Import the project into [Vercel](https://vercel.com).
3. Set the Root Directory to `./`.
4. Configure the environment variable:
   - `NEXT_PUBLIC_API_URL`: Your deployed FastAPI backend URL.
5. Deploy.

---

## 🧪 End-to-End Simulation & Testing

The repository includes a simulation suite located in [`simulate-test/`](simulate-test/):

```bash
# Run the automated test suite
python simulate-test/run_tests.py
```

This validates API health, database connections, lead imports, sequence creation, campaign dispatch pipelines, and tracking endpoints.

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
