from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks
from typing import List, Optional
import os
from datetime import timezone

from app.models.schemas import (
    ConnectEmailRequest, EmailAccount, 
    ScheduleEmailRequest, ScheduledEmail, 
    TestEmailRequest, Lead,
    BulkScheduleRequest, BulkScheduleFilterRequest,
    UpdateLimitRequest, UpdateActiveRequest
)
from app.services import gmail_service
from app.services.csv_service import parse_leads_csv
from app.utils.template import render_template
from app.repositories import dynamodb_repo

router = APIRouter()

DEFAULT_USER_ID = "default-user-id"

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
            dynamodb_repo.put_item("email_accounts", existing_account)
            account_id = existing_account["id"]
        else:
            account = EmailAccount(
                user_id=DEFAULT_USER_ID, 
                email=data["email"],
                status="verified",
                refresh_token=data.get("refresh_token"),
                access_token=data.get("access_token"),
                is_active=True,
                daily_limit=30,
                sent_today=0
            )
            dynamodb_repo.put_item("email_accounts", account.model_dump())
            account_id = account.id
            
        return {"message": "Email connected successfully.", "account_id": account_id}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/email-accounts")
async def get_email_accounts():
    accounts = dynamodb_repo.scan_table("email_accounts")
    response_list = []
    for acc in accounts:
        response_list.append({
            "account_id": acc.get("id"),
            "email": acc.get("email"),
            "is_active": acc.get("is_active", True),
            "daily_limit": int(acc.get("daily_limit", 30)),
            "sent_today": int(acc.get("sent_today", 0))
        })
    return response_list

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

@router.get("/email-accounts/{account_id}/status")
async def check_account_status(account_id: str):

    account_dict = dynamodb_repo.get_item("email_accounts", {"id": account_id})
    if not account_dict:
        raise HTTPException(status_code=404, detail="Account not found")
        
    return {"email": account_dict.get("email"), "status": account_dict.get("status", "verified")}

@router.post("/leads/upload")
async def upload_leads(file: UploadFile = File(...)):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="File must be a CSV")
        
    content = await file.read()
    try:
        parsed_leads = parse_leads_csv(content)
        leads_to_insert = [Lead(**lead).model_dump() for lead in parsed_leads]
        
        # Batch insert
        dynamodb_repo.batch_write_items("leads", leads_to_insert)
        
        return {"message": f"Successfully uploaded {len(leads_to_insert)} leads."}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/leads")
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
            
        variables = {
            "name": lead_dict.get("name", ""),
            "company": lead_dict.get("company", ""),
            "email": lead_dict.get("email", "")
        }
        
        rendered_subject = render_template(request.subject, variables)
        rendered_body = render_template(request.body, variables)
        
        scheduled_email = ScheduledEmail(
            lead_id=lead_id,
            account_id=request.account_id,
            subject=rendered_subject,
            body=rendered_body,
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
        variables = {
            "name": lead_dict.get("name", ""),
            "company": lead_dict.get("company", ""),
            "email": lead_dict.get("email", "")
        }
        
        rendered_subject = render_template(request.subject, variables)
        rendered_body = render_template(request.body, variables)
        
        scheduled_email = ScheduledEmail(
            lead_id=lead_dict.get("id"),
            account_id=request.account_id,
            subject=rendered_subject,
            body=rendered_body,
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
            
        variables = {
            "name": lead_dict.get("name", ""),
            "company": lead_dict.get("company", ""),
            "email": lead_dict.get("email", "")
        }
        
        rendered_subject = render_template(request.subject_template, variables)
        rendered_body = render_template(request.body_template, variables)
        
        scheduled_email = ScheduledEmail(
            lead_id=lead_id,
            account_id=request.account_id,
            subject=rendered_subject,
            body=rendered_body,
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
