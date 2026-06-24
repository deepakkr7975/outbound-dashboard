# Email Outreach Platform MVP

Phase 1 (MVP) implementation of the email outreach platform using FastAPI, AWS DynamoDB, and AWS SES.

## Tech Stack
- **Backend**: FastAPI
- **Database**: AWS DynamoDB
- **Email Provider**: AWS SES
- **Scheduler**: APScheduler
- **Package Manager**: pip

## Setup Instructions

1. **Create Virtual Environment and Install Dependencies**
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```

2. **Configure Environment Variables**
   Copy `.env.example` to `.env` and fill in your AWS credentials.
   ```bash
   cp .env.example .env
   ```
   Ensure your AWS IAM user has permissions for:
   - `dynamodb:*`
   - `ses:*`

3. **Run the Application**
   ```bash
   uvicorn app.main:app --reload
   ```
   *Note: On the first run, the app will automatically create the necessary DynamoDB tables (`users`, `email_accounts`, `leads`, `scheduled_emails`). This may take a few seconds.*

## API Endpoints

- `POST /email-accounts/connect`: Verifies an email address using AWS SES.
- `GET /email-accounts/{account_id}/status`: Checks SES verification status.
- `POST /leads/upload`: Uploads a CSV file with `name`, `email`, and `company` headers.
- `GET /leads`: Lists uploaded leads.
- `POST /emails/schedule`: Schedules emails to leads.
- `GET /emails/scheduled`: Lists scheduled emails.
- `POST /emails/test`: Sends an immediate test email.
