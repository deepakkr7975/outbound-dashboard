from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime
import logging
import os
from app.repositories import dynamodb_repo
from app.services.gmail_service import send_email
from app.services.account_selection_service import AccountSelectionService
from app.services.tracking_service import instrument_html
from app.utils.template import render_template

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def process_scheduled_emails():
    logger.info("Checking for pending scheduled emails...")
    now_iso = datetime.utcnow().isoformat() + "Z"
    
    # Query DynamoDB GSI for status='pending' and send_at <= now
    pending_emails = dynamodb_repo.query_gsi(
        table_name="scheduled_emails",
        index_name="status-send_at-index",
        key_condition_expression="#st = :status AND #sa <= :now",
        expression_values={
            ":status": "pending",
            ":now": now_iso
        },
        expression_names={
            "#st": "status",
            "#sa": "send_at"
        }
    )
    
    if not pending_emails:
        logger.info("No pending emails to send.")
        return
        
    logger.info(f"Found {len(pending_emails)} emails to send.")
    
    # Load all accounts once per cron execution to select from
    accounts = dynamodb_repo.scan_table("email_accounts")
    
    for email_record in pending_emails:
        email_id = email_record.get('id')
        lead_id = email_record.get('lead_id')
        subject = email_record.get('subject')
        body = email_record.get('body')
        
        # Select sender account
        selected_account = AccountSelectionService.select_account(accounts)
        if not selected_account:
            logger.warning(f"No active email account under daily limit available for email {email_id}. Keep status as pending.")
            break # Break early: if all accounts are exhausted, subsequent emails will also fail to find accounts
            
        try:
            refresh_token = selected_account.get("refresh_token")
            if not refresh_token:
                raise Exception(f"Selected account {selected_account.get('email')} has no refresh token.")
            
            # Get lead data — used both for the recipient address and template rendering
            lead_dict = dynamodb_repo.get_item("leads", {"id": lead_id})
            if not lead_dict:
                raise Exception("Lead not found")

            to_email = lead_dict.get("email")

            # Render mail-merge variables using the FULL lead dict.
            # Any {{placeholder}} that matches a lead field is replaced;
            # unknown placeholders (e.g. {{phone}} when absent) are left unchanged.
            rendered_subject = render_template(subject, lead_dict)
            rendered_body = render_template(body, lead_dict)

            # Open/click tracking: rewrite links + append pixel (token s-{id})
            base_url = os.getenv("APP_BASE_URL", "").rstrip("/")
            tracked_urls = []
            if base_url:
                rendered_body, tracked_urls = instrument_html(
                    rendered_body, f"s-{email_id}", base_url
                )

            # Send Email
            send_email(to_email, rendered_subject, rendered_body, refresh_token)

            # Update scheduled email status (+ tracking metadata; sent_at
            # feeds the too-fast-open bot heuristic)
            dynamodb_repo.update_item(
                "scheduled_emails",
                {"id": email_id},
                "SET #st = :sent, sent_at = :sent_at, tracked_urls = :urls",
                {
                    ":sent": "sent",
                    ":sent_at": datetime.utcnow().isoformat() + "Z",
                    ":urls": tracked_urls
                },
                {"#st": "status"}
            )
            
            # Update selected email account sent counter and last_used_at in memory & DB
            selected_account["sent_today"] = selected_account.get("sent_today", 0) + 1
            now_used_iso = datetime.utcnow().isoformat() + "Z"
            selected_account["last_used_at"] = now_used_iso
            dynamodb_repo.put_item("email_accounts", selected_account)
            
            # Create successful email log
            log_entry = {
                "email_id": email_id,
                "lead_id": lead_id,
                "sender_account_id": selected_account.get("id"),
                "sender_email": selected_account.get("email"),
                "sent_at": now_used_iso,
                "status": "sent"
            }
            dynamodb_repo.put_item("email_logs", log_entry)
            logger.info(f"Successfully sent email {email_id} to {to_email} using {selected_account.get('email')}")
            
        except Exception as e:
            logger.error(f"Failed to send email {email_id}: {e}")
            # Mark as failed
            dynamodb_repo.update_item(
                "scheduled_emails",
                {"id": email_id},
                "SET #st = :failed",
                {":failed": "failed"},
                {"#st": "status"}
            )
            
            # Update selected email account last_used_at in memory & DB (do not increment sent_today)
            now_used_iso = datetime.utcnow().isoformat() + "Z"
            selected_account["last_used_at"] = now_used_iso
            dynamodb_repo.put_item("email_accounts", selected_account)
            
            # Create failed email log
            log_entry = {
                "email_id": email_id,
                "lead_id": lead_id,
                "sender_account_id": selected_account.get("id"),
                "sender_email": selected_account.get("email"),
                "sent_at": now_used_iso,
                "status": "failed"
            }
            dynamodb_repo.put_item("email_logs", log_entry)

def reset_daily_counters():
    logger.info("Running daily reset job for email accounts sent counters...")
    try:
        accounts = dynamodb_repo.scan_table("email_accounts")
        for acc in accounts:
            if acc.get("sent_today", 0) != 0:
                acc["sent_today"] = 0
                dynamodb_repo.put_item("email_accounts", acc)
        logger.info("Successfully reset sent counters for all accounts.")
    except Exception as e:
        logger.error(f"Failed to reset daily counters: {e}")

def process_email_transactions():
    """
    Thin scheduler job for campaign-driven transactions.
    All business logic lives in CampaignService.
    """
    logger.info("Checking for due email transactions...")
    try:
        from app.services.campaign_service import CampaignService
        CampaignService.process_due_transactions()
    except Exception as e:
        logger.error(f"Error processing email transactions: {e}")

def start_scheduler():
    scheduler = BackgroundScheduler()
    # Direct-scheduling poller for the /emails/* endpoints (scheduled_emails
    # table). Runs alongside the campaign engine; set ENABLE_LEGACY_SCHEDULER=false to disable.
    legacy_enabled = os.getenv("ENABLE_LEGACY_SCHEDULER", "true").lower() in ("1", "true", "yes")
    if legacy_enabled:
        scheduler.add_job(process_scheduled_emails, 'interval', minutes=1)
    # Campaign-driven email processing every minute
    scheduler.add_job(process_email_transactions, 'interval', minutes=1)
    # Reset daily limit counters at midnight
    scheduler.add_job(reset_daily_counters, 'cron', hour=0, minute=0)
    scheduler.start()
    logger.info(
        f"Scheduler started (campaign processing{' + legacy scheduled_emails' if legacy_enabled else ''})."
    )
    return scheduler
