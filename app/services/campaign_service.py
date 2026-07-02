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
import random
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple

from app.models.schemas import (
    CampaignEmail, CampaignStatus, CampaignEmailStatus, current_time_iso
)
from app.repositories import dynamodb_repo
from app.services.account_selection_service import AccountSelectionService
from app.services.gmail_service import send_email
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
            CampaignService.generate_step_emails(campaign_dict, first_step, steps)

        return campaign_dict

    # ── Lazy Email Generation ────────────────────────────────────────────

    @staticmethod
    def generate_step_emails(
        campaign: Dict[str, Any],
        step: Dict[str, Any],
        all_steps: List[Dict[str, Any]]
    ):
        """
        Generate CampaignEmail records for ONE step only.
        Uses even-split round-robin for A/B variant assignment.
        """
        audience = dynamodb_repo.get_item("audiences", {"id": campaign["audience_id"]})
        if not audience:
            logger.error(f"Audience {campaign['audience_id']} not found for campaign {campaign['id']}")
            return

        lead_ids = audience.get("lead_ids", [])
        if not lead_ids:
            logger.warning(f"Audience {campaign['audience_id']} has no members")
            return

        # Calculate scheduled_at for this step
        scheduled_at = CampaignService._calculate_step_time(campaign, step, all_steps)

        # Shuffle audience for unbiased A/B distribution
        shuffled_leads = list(lead_ids)
        random.shuffle(shuffled_leads)

        # Even-split round-robin variant assignment
        variants = step.get("variants", {})
        has_b = variants.get("b") is not None
        num_variants = 2 if has_b else 1

        email_items = []
        for idx, lead_id in enumerate(shuffled_leads):
            variant_index = idx % num_variants
            selected_variant = "b" if variant_index == 1 else "a"

            email = CampaignEmail(
                campaign_id=campaign["id"],
                lead_id=lead_id,
                step_order=int(step.get("step_order", 1)),
                selected_variant=selected_variant,
                status=CampaignEmailStatus.PENDING.value,
                scheduled_at=scheduled_at
            )
            email_items.append(email.model_dump())

        if email_items:
            dynamodb_repo.batch_write_items("campaign_emails", email_items)

        # Update campaign's current step order
        step_order = int(step.get("step_order", 1))
        campaign["current_step_order"] = step_order
        campaign["updated_at"] = current_time_iso()
        dynamodb_repo.put_item("campaigns", campaign)

        logger.info(
            f"Generated {len(email_items)} emails for campaign '{campaign['name']}' "
            f"step {step_order} (scheduled at {scheduled_at})"
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
    def process_due_campaign_emails():
        """
        Main processing loop called by the scheduler every minute.
        Fetches due emails, sends them, and checks for step completion.
        """
        now_iso = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")

        # Query due campaign emails via GSI
        due_emails = dynamodb_repo.query_gsi(
            table_name="campaign_emails",
            index_name="status-scheduled_at-index",
            key_condition_expression="#st = :status AND #sa <= :now",
            expression_values={
                ":status": CampaignEmailStatus.PENDING.value,
                ":now": now_iso
            },
            expression_names={
                "#st": "status",
                "#sa": "scheduled_at"
            }
        )

        if not due_emails:
            return

        logger.info(f"Found {len(due_emails)} due campaign emails to process")

        # Load all email accounts once for sender selection
        all_accounts = dynamodb_repo.scan_table("email_accounts")

        # Track which campaigns were processed for step-completion check
        processed_campaign_ids = set()

        for email_record in due_emails:
            campaign_id = email_record.get("campaign_id")

            # Load campaign
            campaign = dynamodb_repo.get_item("campaigns", {"id": campaign_id})
            if not campaign:
                logger.warning(f"Campaign {campaign_id} not found, skipping email {email_record['id']}")
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

            # Process this email
            CampaignService._send_single_email(
                email_record, campaign, all_accounts
            )

            processed_campaign_ids.add(campaign_id)

        # Check step completion for each processed campaign
        for campaign_id in processed_campaign_ids:
            campaign = dynamodb_repo.get_item("campaigns", {"id": campaign_id})
            if campaign and campaign.get("status") == CampaignStatus.RUNNING.value:
                CampaignService.check_step_completion(campaign)

    @staticmethod
    def _send_single_email(
        email_record: Dict[str, Any],
        campaign: Dict[str, Any],
        all_accounts: List[Dict[str, Any]]
    ):
        """Send a single campaign email — template rendering, sender selection, and dispatch."""
        email_id = email_record.get("id")
        lead_id = email_record.get("lead_id")
        step_order = int(email_record.get("step_order", 0))
        variant_key = email_record.get("selected_variant", "a")

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

            # Select sender from the campaign's sender pool
            selected_account = AccountSelectionService.select_from_pool(
                campaign.get("sender_email_ids", []),
                all_accounts
            )
            if not selected_account:
                logger.warning(
                    f"No available sender for email {email_id}. "
                    "All accounts at daily limit or inactive."
                )
                return  # Leave as pending — will retry next cycle

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

            subject = variant.get("title", "Untitled")
            body = variant.get("body", "")

            # Render mail-merge templates
            rendered_subject = render_template(subject, lead)
            rendered_body = render_template(body, lead)

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
            send_email(
                to_email=lead.get("email"),
                subject=rendered_subject,
                body=rendered_body,
                refresh_token=refresh_token,
                signature_html=signature_html
            )

            # Update campaign email record
            now_iso = current_time_iso()
            email_record["status"] = CampaignEmailStatus.SENT.value
            email_record["sender_email_id"] = selected_account.get("id")
            email_record["sent_at"] = now_iso
            dynamodb_repo.put_item("campaign_emails", email_record)

            # Update sender account counters
            selected_account["sent_today"] = int(selected_account.get("sent_today", 0)) + 1
            selected_account["last_used_at"] = now_iso
            dynamodb_repo.put_item("email_accounts", selected_account)

            # Log
            log_entry = {
                "email_id": email_id,
                "lead_id": lead_id,
                "sender_account_id": selected_account.get("id"),
                "sender_email": selected_account.get("email"),
                "sent_at": now_iso,
                "status": "sent"
            }
            dynamodb_repo.put_item("email_logs", log_entry)

            logger.info(
                f"Sent campaign email {email_id} to {lead.get('email')} "
                f"via {selected_account.get('email')}"
            )

        except Exception as e:
            logger.error(f"Failed to send campaign email {email_id}: {e}")

            email_record["status"] = CampaignEmailStatus.FAILED.value
            dynamodb_repo.put_item("campaign_emails", email_record)

            # Log failure
            log_entry = {
                "email_id": email_id,
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

        # Get all campaign emails for the current step
        all_campaign_emails = dynamodb_repo.query_gsi(
            table_name="campaign_emails",
            index_name="campaign_id-index",
            key_condition_expression="#cid = :cid",
            expression_values={":cid": campaign_id},
            expression_names={"#cid": "campaign_id"}
        )

        # Filter to current step
        current_step_emails = [
            ce for ce in all_campaign_emails
            if int(ce.get("step_order", 0)) == current_order
        ]

        if not current_step_emails:
            return

        # Check if all are done (sent or failed)
        all_done = all(
            ce.get("status") in (CampaignEmailStatus.SENT.value, CampaignEmailStatus.FAILED.value)
            for ce in current_step_emails
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
                f"Generating step {next_step['step_order']} emails."
            )
            CampaignService.generate_step_emails(campaign, next_step, all_steps)
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

    # ── Campaign Statistics ──────────────────────────────────────────────

    @staticmethod
    def get_campaign_stats(campaign_id: str) -> Dict[str, Any]:
        """
        Compute campaign stats: total, sent, pending, failed,
        current step, total steps, completion %.
        """
        campaign = dynamodb_repo.get_item("campaigns", {"id": campaign_id})
        if not campaign:
            return {}

        # Get all campaign emails
        campaign_emails = dynamodb_repo.query_gsi(
            table_name="campaign_emails",
            index_name="campaign_id-index",
            key_condition_expression="#cid = :cid",
            expression_values={":cid": campaign_id},
            expression_names={"#cid": "campaign_id"}
        )

        total = len(campaign_emails)
        sent = sum(1 for ce in campaign_emails if ce.get("status") == CampaignEmailStatus.SENT.value)
        pending = sum(1 for ce in campaign_emails if ce.get("status") == CampaignEmailStatus.PENDING.value)
        failed = sum(1 for ce in campaign_emails if ce.get("status") == CampaignEmailStatus.FAILED.value)

        # Get total steps
        sequence_id = campaign.get("sequence_id")
        all_steps = CampaignService._get_ordered_steps(sequence_id) if sequence_id else []
        total_steps = len(all_steps)

        # Get audience size for overall progress
        audience_id = campaign.get("audience_id")
        audience = dynamodb_repo.get_item("audiences", {"id": audience_id}) if audience_id else None
        audience_size = len(audience.get("lead_ids", [])) if audience else 0

        # Total expected = audience_size * total_steps
        total_expected = audience_size * total_steps
        completion_pct = round((sent / total_expected * 100), 1) if total_expected > 0 else 0.0

        return {
            "campaign_id": campaign_id,
            "status": campaign.get("status"),
            "total_emails_generated": total,
            "sent": sent,
            "pending": pending,
            "failed": failed,
            "current_step_order": int(campaign.get("current_step_order", 0)),
            "total_steps": total_steps,
            "audience_size": audience_size,
            "total_expected_emails": total_expected,
            "completion_percentage": completion_pct,
        }

    # ── Validation ───────────────────────────────────────────────────────

    @staticmethod
    def validate_campaign_delete(campaign_id: str) -> Tuple[bool, str]:
        """Check if campaign can be deleted. Returns (allowed, reason)."""
        campaign = dynamodb_repo.get_item("campaigns", {"id": campaign_id})
        if not campaign:
            return False, "Campaign not found"

        if campaign.get("status") == CampaignStatus.RUNNING.value:
            # Check for pending emails
            campaign_emails = dynamodb_repo.query_gsi(
                table_name="campaign_emails",
                index_name="campaign_id-index",
                key_condition_expression="#cid = :cid",
                expression_values={":cid": campaign_id},
                expression_names={"#cid": "campaign_id"}
            )
            pending = [
                ce for ce in campaign_emails
                if ce.get("status") == CampaignEmailStatus.PENDING.value
            ]
            if pending:
                return False, f"Cannot delete: campaign has {len(pending)} pending emails"

        return True, "OK"
