"""
Campaign Service — core business logic for campaign lifecycle.

Handles:
- Campaign creation with lazy step-1 email generation
- Step completion detection and next-step generation
- Due email processing (called by thin scheduler)
- Campaign statistics computation
- Deletion validation
"""

import logging
import os
import random
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
import ulid

from app.models.schemas import (
    CampaignStatus, EmailTransaction, 
    EmailTransactionStatus, current_time_iso
)
from app.repositories import dynamodb_repo
from app.services.account_selection_service import AccountSelectionService
from app.services.transaction_service import TransactionService
from app.services.gmail_service import send_email
from app.services.tracking_service import instrument_html
from app.utils.template import render_template

logger = logging.getLogger(__name__)


class CampaignService:

    # ── Campaign Creation ────────────────────────────────────────────────

    @staticmethod
    def create_campaign(campaign_dict: Dict[str, Any]) -> Dict[str, Any]:
        """
        Save campaign and generate Step 1 emails (lazy generation).
        Campaign should already be validated and built as a dict.
        """
        campaign_dict["status"] = CampaignStatus.SCHEDULED.value
        dynamodb_repo.put_item("campaigns", campaign_dict)

        # Generate emails for step 1 only
        steps = CampaignService._get_ordered_steps(campaign_dict["sequence_id"])
        if steps:
            first_step = steps[0]
            CampaignService.generate_step_transactions(campaign_dict, first_step, steps)

        return campaign_dict

    # ── Lazy Email Generation ────────────────────────────────────────────

    @staticmethod
    def generate_step_transactions(
        campaign: Dict[str, Any],
        step: Dict[str, Any],
        all_steps: List[Dict[str, Any]]
    ):
        """
        Generate EmailTransaction records for ONE step only.
        Uses even-split round-robin for A/B variant assignment if variant B exists.
        """
        audience = dynamodb_repo.get_item("audiences", {"id": campaign["audience_id"]})
        if not audience:
            logger.error(f"Audience {campaign['audience_id']} not found for campaign {campaign['id']}")
            return

        lead_ids = audience.get("lead_ids", [])
        if not lead_ids:
            logger.warning(f"Audience {campaign['audience_id']} has no leads")
            return

        # Calculate scheduled_for for this step
        scheduled_for = CampaignService._calculate_step_time(campaign, step, all_steps)

        # Shuffle lead list for unbiased A/B distribution
        shuffled_leads = list(lead_ids)
        random.shuffle(shuffled_leads)

        # Even-split round-robin variant assignment
        variants = step.get("variants", {})
        has_b = variants.get("b") is not None
        num_variants = 2 if has_b else 1

        # Batch-load all leads once (for subject-line rendering)
        fetched_leads = dynamodb_repo.batch_get_items(
            "leads", [{"id": lid} for lid in shuffled_leads]
        )
        leads_by_id = {l["id"]: l for l in fetched_leads}

        # Drop unsubscribed leads before variant assignment
        shuffled_leads = [
            lid for lid in shuffled_leads
            if not (leads_by_id.get(lid) or {}).get("unsubscribed")
        ]

        email_items = []
        for idx, lead_id in enumerate(shuffled_leads):
            if num_variants == 2:
                variant_index = idx % 2
                selected_variant = "b" if variant_index == 1 else "a"
            else:
                selected_variant = "a"

            step_order = int(step.get("step_order", 1))
            txn_id = ulid.new().str

            lead = leads_by_id.get(lead_id)

            # Render subject line immediately
            variant = variants.get(selected_variant)
            if not variant:
                variant = variants.get("a", {"title": "Untitled", "body": ""})
                
            # Pick subject line: new format stores a list, legacy stored a single string
            subject_lines = variant.get("subject_lines", [])
            if subject_lines:
                raw_subject = subject_lines[0]
            else:
                # Backward compat: old sequences stored "title"
                raw_subject = variant.get("title", "Untitled")
            rendered_subject = render_template(raw_subject, lead) if lead else raw_subject
            email = EmailTransaction(
                PK=f"CAMPAIGN#{campaign['id']}",
                SK=f"MSG#{lead_id}#{step_order}",
                transaction_id=txn_id,
                campaign_id=campaign["id"],
                sequence_id=campaign.get("sequence_id", ""),
                step_order=step_order,
                lead_id=lead_id,
                audience_id=campaign.get("audience_id"),
                variant=selected_variant,
                subject_line=rendered_subject,
                status=EmailTransactionStatus.QUEUED.value,
                scheduled_for=scheduled_for
            )
            email_items.append(email.model_dump())

        if email_items:
            dynamodb_repo.batch_write_items("email_transactions", email_items)

        # Update campaign's current step order
        step_order = int(step.get("step_order", 1))
        campaign["current_step_order"] = step_order
        campaign["updated_at"] = current_time_iso()
        dynamodb_repo.put_item("campaigns", campaign)

        logger.info(
            f"Generated {len(email_items)} transactions for campaign '{campaign['name']}' "
            f"step {step_order} (scheduled for {scheduled_for})"
        )

    @staticmethod
    def _calculate_step_time(
        campaign: Dict[str, Any],
        step: Dict[str, Any],
        all_steps: List[Dict[str, Any]]
    ) -> str:
        """
        Calculate the scheduled_at time for a step.
        Step time = campaign.schedule_at + sum(wait_days for steps up to this one).
        """
        schedule_at = datetime.fromisoformat(
            campaign["schedule_at"].replace("Z", "+00:00")
        )

        step_order = int(step.get("step_order", 1))
        cumulative_days = 0
        for s in all_steps:
            if int(s.get("step_order", 0)) <= step_order:
                cumulative_days += int(s.get("wait_days", 0))

        result_time = schedule_at + timedelta(days=cumulative_days)
        return result_time.strftime("%Y-%m-%dT%H:%M:%SZ")

    # ── Email Processing (called by thin scheduler) ──────────────────────

    @staticmethod
    def process_due_transactions():
        """
        Main processing loop called by the scheduler every minute.
        Fetches due transactions, sends them, and checks for step completion.
        """
        now_iso = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")

        # Query due transactions via GSI
        due_transactions = dynamodb_repo.query_gsi(
            table_name="email_transactions",
            index_name="status-scheduled_for-index",
            key_condition_expression="#st = :status AND #sf <= :now",
            expression_values={
                ":status": EmailTransactionStatus.QUEUED.value,
                ":now": now_iso
            },
            expression_names={
                "#st": "status",
                "#sf": "scheduled_for"
            }
        )

        if not due_transactions:
            return

        logger.info(f"Found {len(due_transactions)} due transactions to process")

        # Load all email accounts once for sender selection
        all_accounts = dynamodb_repo.scan_table("email_accounts")

        # Track which campaigns were processed for step-completion check
        processed_campaign_ids = set()

        for txn_record in due_transactions:
            campaign_id = txn_record.get("campaign_id")

            # Load campaign
            campaign = dynamodb_repo.get_item("campaigns", {"id": campaign_id})
            if not campaign:
                logger.warning(f"Campaign {campaign_id} not found, skipping transaction {txn_record.get('transaction_id')}")
                continue

            # Skip if campaign is paused/cancelled/completed
            if campaign.get("status") not in (
                CampaignStatus.SCHEDULED.value,
                CampaignStatus.RUNNING.value
            ):
                continue

            # Update campaign to running on first email send
            if campaign.get("status") == CampaignStatus.SCHEDULED.value:
                campaign["status"] = CampaignStatus.RUNNING.value
                campaign["updated_at"] = current_time_iso()
                dynamodb_repo.put_item("campaigns", campaign)

            # Process this transaction
            CampaignService._send_single_email(
                txn_record, campaign, all_accounts
            )

            processed_campaign_ids.add(campaign_id)

        # Check step completion for each processed campaign
        for campaign_id in processed_campaign_ids:
            campaign = dynamodb_repo.get_item("campaigns", {"id": campaign_id})
            if campaign and campaign.get("status") == CampaignStatus.RUNNING.value:
                CampaignService.check_step_completion(campaign)

    @staticmethod
    def _send_single_email(
        txn_record: Dict[str, Any],
        campaign: Dict[str, Any],
        all_accounts: List[Dict[str, Any]]
    ):
        """Send a single campaign email — template rendering, sender selection, and dispatch."""
        txn_id = txn_record.get("transaction_id")
        lead_id = txn_record.get("lead_id")
        step_order = int(txn_record.get("step_order", 0))
        variant_key = txn_record.get("variant", "a")
        txn_keys = {"PK": txn_record["PK"], "SK": txn_record["SK"]}

        # Claim the transaction (queued -> sending) so a slow cycle or a
        # second app instance can't double-send the same email.
        claimed = dynamodb_repo.update_item(
            "email_transactions",
            txn_keys,
            "SET #st = :sending",
            {":sending": EmailTransactionStatus.SENDING.value, ":queued": EmailTransactionStatus.QUEUED.value},
            {"#st": "status"},
            condition_expression="#st = :queued"
        )
        if not claimed:
            logger.info(f"Transaction {txn_id} already claimed elsewhere, skipping")
            return

        try:
            # Load sequence
            sequence = dynamodb_repo.get_item("sequences", {"sequence_id": campaign.get("sequence_id")})
            if not sequence:
                raise Exception(f"Sequence {campaign.get('sequence_id')} not found")

            # Load sequence step
            steps = sequence.get("steps", [])
            step = next((s for s in steps if s.get("step_order") == step_order), None)
            if not step:
                raise Exception(f"Sequence step {step_order} not found in sequence {sequence.get('sequence_id')}")

            # Load lead data for mail merge
            lead = dynamodb_repo.get_item("leads", {"id": lead_id})
            if not lead:
                raise Exception(f"Lead {lead_id} not found")

            # Skip leads that unsubscribed after this transaction was generated
            if lead.get("unsubscribed"):
                TransactionService.update_transaction(txn_id, {
                    "status": "unsubscribed"
                }, keys=txn_keys)
                logger.info(f"Lead {lead_id} is unsubscribed, skipping email {txn_id}")
                return

            # Select sender from the campaign's sender pool
            selected_account = AccountSelectionService.select_from_pool(
                campaign.get("sender_email_ids", []),
                all_accounts
            )
            if not selected_account:
                logger.warning(
                    f"No available sender for email {txn_id}. "
                    "All accounts at daily limit or inactive."
                )
                # Release the claim so it retries next cycle
                dynamodb_repo.update_item(
                    "email_transactions",
                    txn_keys,
                    "SET #st = :queued",
                    {":queued": EmailTransactionStatus.QUEUED.value},
                    {"#st": "status"}
                )
                return

            refresh_token = selected_account.get("refresh_token")
            if not refresh_token:
                raise Exception(
                    f"Sender {selected_account.get('email')} has no refresh token"
                )

            # Pick the subject variant
            variants = step.get("variants", {})
            variant = variants.get(variant_key)
            if not variant:
                # Fallback to variant a
                variant = variants.get("a", {"title": "Untitled", "body": ""})

            # Pick subject line: new format stores a list, legacy stored a single string
            subject_lines = variant.get("subject_lines", [])
            if subject_lines:
                subject = subject_lines[0]
            else:
                # Backward compat: old sequences stored "title"
                subject = variant.get("title", "Untitled")

            # Build the full email body: opening line + body + reply trigger
            opening_lines = variant.get("opening_lines", [])
            body_parts = []
            if opening_lines:
                body_parts.append(f"<p><strong>{opening_lines[0]}</strong></p>")
            body_parts.append(variant.get("body", ""))
            reply_trigger = variant.get("reply_trigger")
            if reply_trigger:
                body_parts.append(
                    f'<p>Reply "<strong>{reply_trigger}</strong>" and I\'ll share more.</p>'
                )
            body = "\n".join(body_parts)

            # Render mail-merge templates
            rendered_subject = render_template(subject, lead)
            rendered_body = render_template(body, lead)

            # Append unsubscribe footer (required for cold outreach compliance)
            base_url = os.getenv("APP_BASE_URL", "").rstrip("/")
            tracked_urls = []
            if base_url:
                unsubscribe_url = f"{base_url}/unsubscribe/{txn_id}"
                rendered_body += (
                    f'<br><br><p style="font-size:12px;color:#888">'
                    f'<a href="{unsubscribe_url}">Unsubscribe</a></p>'
                )
                # Open/click tracking: rewrite links + append pixel.
                # The unsubscribe link is skipped (points at base_url).
                rendered_body, tracked_urls = instrument_html(
                    rendered_body, f"t-{txn_id}", base_url
                )

            # Append signature if sender has one
            signature_html = selected_account.get("signature_html")
            if not signature_html:
                # Build a basic signature from fields
                sig_parts = []
                if selected_account.get("signature_name"):
                    sig_parts.append(f"<b>{selected_account['signature_name']}</b>")
                if selected_account.get("signature_title"):
                    sig_parts.append(selected_account["signature_title"])
                if selected_account.get("signature_company"):
                    sig_parts.append(selected_account["signature_company"])
                if selected_account.get("signature_phone"):
                    sig_parts.append(selected_account["signature_phone"])
                if sig_parts:
                    signature_html = "<br>".join(sig_parts)

            # Send email
            provider_msg_id = send_email(
                to_email=lead.get("email"),
                subject=rendered_subject,
                body=rendered_body,
                refresh_token=refresh_token,
                signature_html=signature_html
            )

            # Update email_transaction record via TransactionService
            now_iso = current_time_iso()
            TransactionService.update_transaction(txn_id, {
                "status": "sent",
                "provider": "gmail",
                "provider_message_id": provider_msg_id if provider_msg_id else None,
                "sender_email_id": selected_account.get("id"),
                "tracked_urls": tracked_urls if tracked_urls else None
            }, keys=txn_keys)

            # Update sender account counters
            selected_account["sent_today"] = int(selected_account.get("sent_today", 0)) + 1
            selected_account["last_used_at"] = now_iso
            dynamodb_repo.put_item("email_accounts", selected_account)

            # Log
            log_entry = {
                "email_id": txn_id,
                "lead_id": lead_id,
                "sender_account_id": selected_account.get("id"),
                "sender_email": selected_account.get("email"),
                "sent_at": now_iso,
                "status": "sent"
            }
            dynamodb_repo.put_item("email_logs", log_entry)

            logger.info(
                f"Sent campaign email {txn_id} to {lead.get('email')} "
                f"via {selected_account.get('email')}"
            )

        except Exception as e:
            logger.error(f"Failed to send campaign email {txn_id}: {e}")

            TransactionService.update_transaction(txn_id, {
                "status": "failed",
                "error_message": str(e)
            }, keys=txn_keys)

            # Log failure
            log_entry = {
                "email_id": txn_id,
                "lead_id": lead_id,
                "sender_account_id": "",
                "sender_email": "",
                "sent_at": current_time_iso(),
                "status": "failed"
            }
            dynamodb_repo.put_item("email_logs", log_entry)

    # ── Step Completion & Next-Step Generation ───────────────────────────

    @staticmethod
    def check_step_completion(campaign: Dict[str, Any]):
        """
        After processing emails, check if the current step is fully done.
        If so, generate emails for the next step (lazy generation).
        If no more steps, mark campaign as completed.
        """
        campaign_id = campaign["id"]
        current_order = int(campaign.get("current_step_order", 0))

        # Get all transactions for this campaign via PK
        all_transactions = dynamodb_repo.query_table(
            table_name="email_transactions",
            key_condition_expression="#pk = :pk",
            expression_values={":pk": f"CAMPAIGN#{campaign_id}"},
            expression_names={"#pk": "PK"}
        )

        # Filter to current step
        current_step_txns = [
            t for t in all_transactions
            if int(t.get("step_order", 0)) == current_order
        ]

        if not current_step_txns:
            return

        # Check if all are done (anything that isn't QUEUED or in-flight SENDING)
        not_done_statuses = (
            EmailTransactionStatus.QUEUED.value,
            EmailTransactionStatus.SENDING.value
        )
        all_done = all(
            t.get("status") not in not_done_statuses
            for t in current_step_txns
        )

        if not all_done:
            return

        # Current step is complete — check for next step
        all_steps = CampaignService._get_ordered_steps(campaign["sequence_id"])
        current_step_idx = next(
            (i for i, s in enumerate(all_steps) if int(s.get("step_order", 0)) == current_order),
            None
        )

        if current_step_idx is not None and current_step_idx + 1 < len(all_steps):
            # Generate next step's emails
            next_step = all_steps[current_step_idx + 1]
            logger.info(
                f"Step {current_order} complete for campaign '{campaign['name']}'. "
                f"Generating step {next_step['step_order']} transactions."
            )
            CampaignService.generate_step_transactions(campaign, next_step, all_steps)
        else:
            # All steps done — mark campaign as completed
            campaign["status"] = CampaignStatus.COMPLETED.value
            campaign["updated_at"] = current_time_iso()
            dynamodb_repo.put_item("campaigns", campaign)
            logger.info(f"Campaign '{campaign['name']}' completed!")

    @staticmethod
    def _get_ordered_steps(sequence_id: str) -> List[Dict[str, Any]]:
        """Fetch and sort all steps for a sequence."""
        sequence = dynamodb_repo.get_item("sequences", {"sequence_id": sequence_id})
        if not sequence:
            return []
        steps = sequence.get("steps", [])
        return sorted(steps, key=lambda s: int(s.get("step_order", 0)))


    # ── Validation ───────────────────────────────────────────────────────

    @staticmethod
    def validate_campaign_delete(campaign_id: str) -> Tuple[bool, str]:
        """Check if campaign can be deleted. Returns (allowed, reason)."""
        campaign = dynamodb_repo.get_item("campaigns", {"id": campaign_id})
        if not campaign:
            return False, "Campaign not found"

        if campaign.get("status") == CampaignStatus.RUNNING.value:
            # Check for queued transactions
            txns = dynamodb_repo.query_table(
                table_name="email_transactions",
                key_condition_expression="#pk = :pk",
                expression_values={":pk": f"CAMPAIGN#{campaign_id}"},
                expression_names={"#pk": "PK"}
            )
            pending = [
                t for t in txns
                if t.get("status") in (
                    EmailTransactionStatus.QUEUED.value,
                    EmailTransactionStatus.SENDING.value
                )
            ]
            if pending:
                return False, f"Cannot delete: campaign has {len(pending)} queued emails"

        return True, "OK"
