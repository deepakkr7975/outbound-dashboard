from fastapi import APIRouter, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.responses import RedirectResponse
from typing import List, Optional
import os
import urllib.parse
from datetime import timezone
import uuid

from app.models.schemas import (
    ConnectEmailRequest, EmailAccount, 
    ScheduleEmailRequest, ScheduledEmail, 
    TestEmailRequest, Lead,
    BulkScheduleRequest, BulkScheduleFilterRequest,
    UpdateLimitRequest, UpdateActiveRequest,
    UpdateSignatureRequest, UpdateEmailAccountRequest, Audience
)
from app.services import gmail_service
from app.services.csv_service import parse_leads_csv
from app.services.lead_service import upsert_leads
from app.repositories import dynamodb_repo

router = APIRouter()

DEFAULT_USER_ID = "default-user-id"

def extract_domain_info(email: str):
    if "@" not in email:
        return "", ""
    domain = email.split("@", 1)[1].lower()
    domain_name = domain.split(".")[0].replace("-", " ").title()
    return domain, domain_name


@router.get("/email-accounts/connect")
async def connect_email():
    try:
        url = gmail_service.get_authorization_url()
        return {"authorization_url": url}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/gmail/callback")
async def oauth_callback(code: str):
    try:
        data = gmail_service.exchange_code(code)
        
        # Check if email account already exists
        existing_accounts = dynamodb_repo.scan_table("email_accounts")
        existing_account = next((acc for acc in existing_accounts if acc.get("email") == data["email"]), None)
        
        if existing_account:
            existing_account["access_token"] = data.get("access_token") or existing_account.get("access_token")
            if data.get("refresh_token"):
                existing_account["refresh_token"] = data["refresh_token"]
            existing_account["status"] = "verified"
            
            # Ensure domain fields exist for legacy accounts
            if not existing_account.get("domain"):
                domain, domain_name = extract_domain_info(existing_account["email"])
                existing_account["domain"] = domain
                existing_account["domain_name"] = domain_name

            dynamodb_repo.put_item("email_accounts", existing_account)
            account_id = existing_account["id"]
        else:
            domain, domain_name = extract_domain_info(data["email"])
            account = EmailAccount(
                user_id=DEFAULT_USER_ID, 
                email=data["email"],
                domain=domain,
                domain_name=domain_name,
                status="verified",
                refresh_token=data.get("refresh_token"),
                access_token=data.get("access_token"),
                is_active=True,
                daily_limit=30,
                sent_today=0
            )
            dynamodb_repo.put_item("email_accounts", account.model_dump())
            account_id = account.id

        # Send the user back into the dashboard rather than showing raw JSON.
        frontend = os.getenv("FRONTEND_URL", "http://localhost:3000")
        connected = urllib.parse.quote(data.get("email", ""))
        return RedirectResponse(
            url=f"{frontend}/dashboard/sender-emails?connected={connected}",
            status_code=303,
        )
    except Exception as e:
        frontend = os.getenv("FRONTEND_URL", "http://localhost:3000")
        err = urllib.parse.quote(str(e))
        return RedirectResponse(
            url=f"{frontend}/dashboard/sender-emails?connect_error={err}",
            status_code=303,
        )

@router.post("/email-accounts")
async def create_email_account(request: ConnectEmailRequest):
    domain, domain_name = extract_domain_info(request.email)
    account = EmailAccount(
        user_id=DEFAULT_USER_ID,
        email=request.email,
        domain=domain,
        domain_name=domain_name,
        status="pending_verification",
        is_active=True,
        daily_limit=30,
        sent_today=0
    )
    dynamodb_repo.put_item("email_accounts", account.model_dump())
    return {
        "id": account.id,
        "email": account.email,
        "domain": account.domain,
        "domain_name": account.domain_name,
        "status": account.status,
        "connected_at": account.created_at
    }

@router.get("/email-accounts")
async def get_email_accounts():
    accounts = dynamodb_repo.scan_table("email_accounts")
    campaigns = dynamodb_repo.scan_table("campaigns")
    response_list = []
    for acc in accounts:
        acc_id = acc.get("id")
        # Check if this account is linked to any active campaign
        linked_count = sum(
            1 for c in campaigns
            if acc_id in c.get("sender_email_ids", [])
            and c.get("status") in ("scheduled", "running", "paused")
        )
        response_list.append({
            "account_id": acc_id,
            "id": acc_id,
            "email": acc.get("email"),
            "domain": acc.get("domain"),
            "domain_name": acc.get("domain_name"),
            "status": acc.get("status", "pending_verification"),
            "connected_at": acc.get("created_at"),
            "is_active": acc.get("is_active", True),
            "daily_limit": int(acc.get("daily_limit", 30)),
            "sent_today": int(acc.get("sent_today", 0)),
            "signature_name": acc.get("signature_name"),
            "signature_title": acc.get("signature_title"),
            "signature_company": acc.get("signature_company"),
            "signature_phone": acc.get("signature_phone"),
            "signature_html": acc.get("signature_html"),
            "is_linked": linked_count > 0,
            "linked_campaign_count": linked_count
        })
    return response_list

@router.patch("/email-accounts/{id}")
async def update_email_account(id: str, request: UpdateEmailAccountRequest):
    account = dynamodb_repo.get_item("email_accounts", {"id": id})
    if not account:
        raise HTTPException(status_code=404, detail="Email account not found")
    
    if request.domain_name is not None:
        account["domain_name"] = request.domain_name

    dynamodb_repo.put_item("email_accounts", account)
    return {
        "id": account.get("id"),
        "email": account.get("email"),
        "domain": account.get("domain"),
        "domain_name": account.get("domain_name"),
        "connected_at": account.get("created_at")
    }

@router.patch("/email-accounts/{id}/limit")
async def update_email_limit(id: str, request: UpdateLimitRequest):
    account = dynamodb_repo.get_item("email_accounts", {"id": id})
    if not account:
        raise HTTPException(status_code=404, detail="Email account not found")
    
    account["daily_limit"] = request.daily_limit
    dynamodb_repo.put_item("email_accounts", account)
    return {"message": "Daily limit updated successfully", "daily_limit": request.daily_limit}

@router.patch("/email-accounts/{id}/active")
async def update_email_active(id: str, request: UpdateActiveRequest):
    account = dynamodb_repo.get_item("email_accounts", {"id": id})
    if not account:
        raise HTTPException(status_code=404, detail="Email account not found")
    
    account["is_active"] = request.is_active
    dynamodb_repo.put_item("email_accounts", account)
    return {"message": "Account active status updated successfully", "is_active": request.is_active}

@router.delete("/email-accounts/{id}")
async def delete_email_account(id: str):
    account = dynamodb_repo.get_item("email_accounts", {"id": id})
    if not account:
        raise HTTPException(status_code=404, detail="Email account not found")
    
    # Check if linked to any active campaign
    campaigns = dynamodb_repo.scan_table("campaigns")
    active_campaigns = [
        c for c in campaigns
        if id in c.get("sender_email_ids", [])
        and c.get("status") in ("scheduled", "running", "paused")
    ]
    if active_campaigns:
        names = ", ".join(c.get("name", "Unnamed") for c in active_campaigns)
        raise HTTPException(
            status_code=409,
            detail=f"Cannot delete: account is linked to active campaigns: {names}"
        )
    
    # Delete the account
    dynamodb_repo.delete_item("email_accounts", {"id": id})
    return {"message": "Email account deleted successfully"}

@router.patch("/email-accounts/{id}/signature")
async def update_email_signature(id: str, request: UpdateSignatureRequest):
    account = dynamodb_repo.get_item("email_accounts", {"id": id})
    if not account:
        raise HTTPException(status_code=404, detail="Email account not found")
    
    update_data = request.model_dump(exclude_none=True)
    for key, value in update_data.items():
        account[key] = value
    account["updated_at"] = __import__("datetime").datetime.utcnow().isoformat() + "Z"
    dynamodb_repo.put_item("email_accounts", account)
    return {"message": "Signature updated successfully", "updated_fields": list(update_data.keys())}

@router.get("/email-accounts/{id}/linked-campaigns")
async def get_linked_campaigns(id: str):
    account = dynamodb_repo.get_item("email_accounts", {"id": id})
    if not account:
        raise HTTPException(status_code=404, detail="Email account not found")
    
    campaigns = dynamodb_repo.scan_table("campaigns")
    linked = [
        {
            "campaign_id": c.get("id"),
            "name": c.get("name"),
            "status": c.get("status"),
            "schedule_at": c.get("schedule_at")
        }
        for c in campaigns
        if id in c.get("sender_email_ids", [])
    ]
    return {"linked_campaigns": linked, "count": len(linked)}

@router.get("/email-accounts/{account_id}/status")
async def check_account_status(account_id: str):

    account_dict = dynamodb_repo.get_item("email_accounts", {"id": account_id})
    if not account_dict:
        raise HTTPException(status_code=404, detail="Account not found")
        
    return {"email": account_dict.get("email"), "status": account_dict.get("status", "verified")}



@router.post("/leads/upload", tags=["Leads"])
async def upload_leads(
    name: str = Form(...),
    description: str = Form(None),
    tags: str = Form(None),
    file: UploadFile = File(...)
):
    """
    Upload a CSV of leads and create an Audience automatically.
    Tags should be comma-separated (e.g. 'marketing,klipkanvas').
    """
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="File must be a CSV")

    content = await file.read()
    try:
        parsed_leads = parse_leads_csv(content)

        # Parse tags from comma-separated string
        tag_list = []
        if tags:
            tag_list = [t.strip() for t in tags.split(",") if t.strip()]

        # Insert leads, deduplicating by email against existing leads
        lead_ids, reused_count = upsert_leads(parsed_leads, tag_list)

        # Create Audience
        audience = Audience(
            name=name,
            description=description,
            file_name=file.filename,
            tags=tag_list,
            lead_ids=lead_ids,
            num_leads=len(lead_ids)
        )
        dynamodb_repo.put_item("audiences", audience.model_dump())

        return {
            "message": "Upload completed successfully",
            "new_leads": len(lead_ids) - reused_count,
            "reused_leads": reused_count,
            "audience": {
                "id": audience.id,
                "name": audience.name,
                "description": audience.description,
                "file_name": audience.file_name,
                "tags": audience.tags,
                "num_leads": audience.num_leads,
                "created_at": audience.created_at
            }
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/leads", tags=["Leads"])
async def get_leads(limit: int = 100, company: Optional[str] = None):
    leads = dynamodb_repo.scan_table("leads")
    
    if company:
        leads = [lead for lead in leads if lead.get("company") == company]
        
    return {"leads": leads[:limit]}

@router.post("/emails/bulk-schedule")
async def bulk_schedule_emails(request: BulkScheduleRequest):
    if not request.lead_ids:
        raise HTTPException(status_code=400, detail="lead_ids cannot be empty")
        
    account_dict = dynamodb_repo.get_item("email_accounts", {"id": request.account_id})
    if not account_dict:
        raise HTTPException(status_code=404, detail="Email account not found")
        
    scheduled_emails = []
    failed_count = 0

    for lead_id in request.lead_ids:
        lead_dict = dynamodb_repo.get_item("leads", {"id": lead_id})
        if not lead_dict:
            failed_count += 1
            continue

        # Store raw templates — variable replacement happens at send time
        # in the APScheduler cron job using the full lead dict.
        scheduled_email = ScheduledEmail(
            lead_id=lead_id,
            account_id=request.account_id,
            subject=request.subject,
            body=request.body,
            send_at=request.send_at.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        )
        scheduled_emails.append(scheduled_email.model_dump())
        
    if scheduled_emails:
        dynamodb_repo.batch_write_items("scheduled_emails", scheduled_emails)
        
    return {
        "scheduled_count": len(scheduled_emails),
        "failed_count": failed_count
    }

@router.post("/emails/bulk-schedule-by-filter")
async def bulk_schedule_by_filter(request: BulkScheduleFilterRequest):
    account_dict = dynamodb_repo.get_item("email_accounts", {"id": request.account_id})
    if not account_dict:
        raise HTTPException(status_code=404, detail="Email account not found")
        
    leads = dynamodb_repo.scan_table("leads")
    
    # Apply filters
    for key, value in request.filters.items():
        leads = [lead for lead in leads if lead.get(key) == value]
        
    if not leads:
        return {"scheduled_count": 0, "failed_count": 0, "message": "No leads matched filters"}
        
    scheduled_emails = []

    for lead_dict in leads:
        # Store raw templates — variable replacement happens at send time
        # in the APScheduler cron job using the full lead dict.
        scheduled_email = ScheduledEmail(
            lead_id=lead_dict.get("id"),
            account_id=request.account_id,
            subject=request.subject,
            body=request.body,
            send_at=request.send_at.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        )
        scheduled_emails.append(scheduled_email.model_dump())
        
    if scheduled_emails:
        dynamodb_repo.batch_write_items("scheduled_emails", scheduled_emails)
        
    return {
        "scheduled_count": len(scheduled_emails),
        "failed_count": 0
    }

@router.post("/emails/schedule")
async def schedule_emails(request: ScheduleEmailRequest):
    # Verify account exists
    account_dict = dynamodb_repo.get_item("email_accounts", {"id": request.account_id})
    if not account_dict:
        raise HTTPException(status_code=404, detail="Email account not found")
        
    scheduled_emails = []

    for lead_id in request.lead_ids:
        lead_dict = dynamodb_repo.get_item("leads", {"id": lead_id})
        if not lead_dict:
            continue

        # Store raw templates — variable replacement happens at send time
        # in the APScheduler cron job using the full lead dict.
        scheduled_email = ScheduledEmail(
            lead_id=lead_id,
            account_id=request.account_id,
            subject=request.subject_template,
            body=request.body_template,
            send_at=request.send_at.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        )
        scheduled_emails.append(scheduled_email.model_dump())
        
    if scheduled_emails:
        dynamodb_repo.batch_write_items("scheduled_emails", scheduled_emails)
        
    return {"message": f"Scheduled {len(scheduled_emails)} emails successfully."}

@router.get("/emails/scheduled")
async def get_scheduled_emails():
    emails = dynamodb_repo.scan_table("scheduled_emails")
    return {"scheduled_emails": emails}

@router.get("/unsubscribe/{transaction_id}", tags=["Unsubscribe"])
async def unsubscribe(transaction_id: str):
    """
    Recipient-facing unsubscribe link (embedded in outgoing emails, no auth).
    Marks the transaction unsubscribed and flags the lead so future
    campaign steps skip them.
    """
    from fastapi.responses import HTMLResponse
    from app.services.transaction_service import TransactionService
    from app.models.schemas import current_time_iso

    txn = TransactionService._find_transaction_raw(transaction_id)
    if not txn:
        raise HTTPException(status_code=404, detail="Unsubscribe link is invalid")

    TransactionService.update_transaction(
        transaction_id,
        {"status": "unsubscribed"},
        keys={"PK": txn["PK"], "SK": txn["SK"]}
    )

    lead_id = txn.get("lead_id")
    if lead_id:
        lead = dynamodb_repo.get_item("leads", {"id": lead_id})
        if lead and not lead.get("unsubscribed"):
            lead["unsubscribed"] = True
            lead["unsubscribed_at"] = current_time_iso()
            dynamodb_repo.put_item("leads", lead)

    return HTMLResponse(
        "<html><body style='font-family:sans-serif;text-align:center;padding-top:4rem'>"
        "<h2>You have been unsubscribed.</h2>"
        "<p>You will not receive further emails from this sender.</p>"
        "</body></html>"
    )

@router.post("/emails/test")
async def send_test_email(request: TestEmailRequest):
    account_dict = dynamodb_repo.get_item("email_accounts", {"id": request.account_id})
    if not account_dict:
        raise HTTPException(status_code=404, detail="Email account not found")
        
    refresh_token = account_dict.get("refresh_token")
    if not refresh_token:
        raise HTTPException(status_code=400, detail="Email account has no refresh token. Please reconnect via OAuth.")
    
    try:
        gmail_service.send_email(
            to_email=request.to_email,
            subject=request.subject,
            body=request.body,
            refresh_token=refresh_token
        )
        return {"message": "Test email sent successfully via Gmail."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send email: {e}")


@router.get("/debug/database", tags=["Debug"])
async def dump_database():
    """
    Dump every DynamoDB table for the /test-database dashboard page.
    OAuth tokens are redacted — they must never reach the browser.
    """
    table_names = [
        "users",
        "email_accounts",
        "leads",
        "audiences",
        "sequences",
        "campaigns",
        "email_transactions",
        "scheduled_emails",
        "email_logs",
        "email_events",
    ]
    result = {}
    for table in table_names:
        try:
            items = dynamodb_repo.scan_table(table)
            for item in items:
                for secret in ("refresh_token", "access_token"):
                    if item.get(secret):
                        item[secret] = "***redacted***"
            result[table] = {"count": len(items), "items": items}
        except Exception as e:
            result[table] = {"count": 0, "items": [], "error": str(e)}
    return result
