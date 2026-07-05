import logging
from typing import Dict, Any, List, Optional
from datetime import datetime
from app.repositories import dynamodb_repo
from app.models.schemas import EmailTransactionStatus, current_time_iso

logger = logging.getLogger(__name__)

class TransactionService:

    # ── Lookup Helpers ───────────────────────────────────────────────────

    @staticmethod
    def _find_transaction_raw(transaction_id: str, keys: Optional[Dict[str, str]] = None) -> Optional[Dict[str, Any]]:
        """
        Find a transaction by transaction_id, returning the raw DynamoDB item
        (no enrichment). Used by mutation methods that need to modify-and-save.

        If `keys` ({PK, SK}) is provided, fetches directly. Otherwise tries the
        transaction_id-index GSI, falling back to a scan for tables created
        before the GSI existed.
        """
        if keys:
            return dynamodb_repo.get_item("email_transactions", keys)

        try:
            matches = dynamodb_repo.query_gsi(
                table_name="email_transactions",
                index_name="transaction_id-index",
                key_condition_expression="transaction_id = :tid",
                expression_values={":tid": transaction_id}
            )
            if matches:
                return matches[0]
            return None
        except Exception:
            logger.warning(
                "transaction_id-index GSI unavailable, falling back to scan. "
                "Restart the app to create the index."
            )

        txns = dynamodb_repo.scan_table("email_transactions")
        for txn in txns:
            if txn.get("transaction_id") == transaction_id:
                return txn
        return None

    @staticmethod
    def get_transaction(transaction_id: str) -> Optional[Dict[str, Any]]:
        """
        Retrieves a single complete transaction record with resolved
        lead, sender, and campaign information.
        """
        txn = TransactionService._find_transaction_raw(transaction_id)
        if txn:
            return TransactionService._enrich_transaction(txn)
        return None

    # ── Update ───────────────────────────────────────────────────────────

    @staticmethod
    def update_transaction(transaction_id: str, request, keys: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
        """
        Single method for all transaction status transitions.
        Handles timestamp assignment and counter increments automatically.

        `request` can be an UpdateTransactionRequest instance or a dict
        with at minimum a 'status' key.
        `keys` ({PK, SK}) skips the lookup when the caller already holds them.
        """
        txn = TransactionService._find_transaction_raw(transaction_id, keys=keys)
        if not txn:
            raise ValueError(f"Transaction not found: {transaction_id}")

        # Normalise request to dict
        if hasattr(request, "model_dump"):
            data = request.model_dump(exclude_none=True)
        elif hasattr(request, "dict"):
            data = {k: v for k, v in request.dict().items() if v is not None}
        else:
            data = {k: v for k, v in request.items() if v is not None}

        status = data.get("status")
        if isinstance(status, EmailTransactionStatus):
            status = status.value

        now = current_time_iso()

        # Engagement statuses only move the funnel forward: a late pixel hit
        # must not downgrade e.g. 'replied' back to 'opened', and terminal
        # statuses are never overwritten by engagement events. Timestamps and
        # counters below still update regardless.
        FUNNEL_RANK = {"sent": 1, "delivered": 2, "opened": 3, "clicked": 4, "replied": 5}
        TERMINAL = {"bounced", "failed", "cancelled", "unsubscribed"}
        current_status = txn.get("status")
        is_engagement = status in FUNNEL_RANK and status != "sent"
        keep_current = is_engagement and (
            current_status in TERMINAL
            or FUNNEL_RANK.get(current_status, 0) > FUNNEL_RANK[status]
        )
        if not keep_current:
            txn["status"] = status

        if status == EmailTransactionStatus.SENT.value:
            txn["sent_at"] = now
            if data.get("provider"):
                txn["provider"] = data["provider"]
            if data.get("provider_message_id"):
                txn["provider_message_id"] = data["provider_message_id"]
            if data.get("sender_email_id"):
                txn["sender_email_id"] = data["sender_email_id"]
            if data.get("tracked_urls"):
                txn["tracked_urls"] = data["tracked_urls"]

        elif status == EmailTransactionStatus.DELIVERED.value:
            txn["delivered_at"] = now

        elif status == EmailTransactionStatus.OPENED.value:
            if not txn.get("opened_at"):
                txn["opened_at"] = now
            txn["open_count"] = int(txn.get("open_count", 0)) + 1

        elif status == EmailTransactionStatus.CLICKED.value:
            if not txn.get("clicked_at"):
                txn["clicked_at"] = now
            txn["click_count"] = int(txn.get("click_count", 0)) + 1

        elif status == EmailTransactionStatus.REPLIED.value:
            txn["replied_at"] = now

        elif status == EmailTransactionStatus.BOUNCED.value:
            txn["bounced_at"] = now
            if data.get("bounce_type"):
                txn["bounce_type"] = data["bounce_type"]

        elif status == EmailTransactionStatus.FAILED.value:
            txn["failed_at"] = now
            if data.get("error_message"):
                txn["error_message"] = data["error_message"]

        elif status == EmailTransactionStatus.CANCELLED.value:
            txn["cancelled_at"] = now

        elif status == EmailTransactionStatus.UNSUBSCRIBED.value:
            txn["unsubscribed_at"] = now

        dynamodb_repo.put_item("email_transactions", txn)

        logger.info(
            f"Transaction {transaction_id} updated to status '{status}'"
        )

        return txn

    # ── List / Query ─────────────────────────────────────────────────────

    @staticmethod
    def list_transactions(
        campaign_id: Optional[str] = None,
        sequence_id: Optional[str] = None,
        lead_id: Optional[str] = None,
        audience_id: Optional[str] = None,
        sender_email_id: Optional[str] = None,
        status: Optional[str] = None,
        variant: Optional[str] = None,
        provider: Optional[str] = None,
        scheduled_from: Optional[str] = None,
        scheduled_to: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Return filtered email transactions.
        If campaign_id is provided, queries the partition directly.
        Otherwise falls back to a scan with filtering in memory.
        """
        if campaign_id:
            raw_txns = dynamodb_repo.query_table(
                table_name="email_transactions",
                key_condition_expression="#pk = :pk",
                expression_values={":pk": f"CAMPAIGN#{campaign_id}"},
                expression_names={"#pk": "PK"}
            )
        else:
            raw_txns = dynamodb_repo.scan_table("email_transactions")

        filtered = []
        for txn in raw_txns:
            if sequence_id and txn.get("sequence_id") != sequence_id:
                continue
            if lead_id and txn.get("lead_id") != lead_id:
                continue
            if audience_id and txn.get("audience_id") != audience_id:
                continue
            if sender_email_id and txn.get("sender_email_id") != sender_email_id:
                continue
            if status and txn.get("status") != status:
                continue
            if variant and txn.get("variant") != variant:
                continue
            if provider and txn.get("provider") != provider:
                continue
            
            sf = txn.get("scheduled_for")
            if sf:
                if scheduled_from and sf < scheduled_from:
                    continue
                if scheduled_to and sf > scheduled_to:
                    continue
            elif scheduled_from or scheduled_to:
                # If filtering by time and txn has no time, skip
                continue

            filtered.append(txn)

        # Batch-resolve referenced entities once, instead of 3 gets per row
        lead_keys = [{"id": t["lead_id"]} for t in filtered if t.get("lead_id")]
        sender_keys = [{"id": t["sender_email_id"]} for t in filtered if t.get("sender_email_id")]
        campaign_keys = [{"id": t["campaign_id"]} for t in filtered if t.get("campaign_id")]

        caches = {
            "leads": {l["id"]: l for l in dynamodb_repo.batch_get_items("leads", lead_keys)} if lead_keys else {},
            "senders": {a["id"]: a for a in dynamodb_repo.batch_get_items("email_accounts", sender_keys)} if sender_keys else {},
            "campaigns": {c["id"]: c for c in dynamodb_repo.batch_get_items("campaigns", campaign_keys)} if campaign_keys else {},
        }

        return [TransactionService._enrich_transaction(t, caches=caches) for t in filtered]

    @staticmethod
    def list_campaign_transactions(campaign_id: str) -> List[Dict[str, Any]]:
        """
        Shortcut method to list all transactions for a specific campaign.
        """
        return TransactionService.list_transactions(campaign_id=campaign_id)

    # ── Enrichment ───────────────────────────────────────────────────────

    @staticmethod
    def _enrich_transaction(txn: Dict[str, Any], caches: Optional[Dict[str, Dict[str, Any]]] = None) -> Dict[str, Any]:
        """
        Resolves nested Lead and Sender information automatically.
        `caches` ({leads, senders, campaigns} keyed by id) avoids per-row gets
        when the caller already batch-fetched the referenced entities.
        """
        caches = caches or {}

        lead = None
        if txn.get("lead_id"):
            if "leads" in caches:
                lead = caches["leads"].get(txn["lead_id"])
            else:
                lead = dynamodb_repo.get_item("leads", {"id": txn.get("lead_id")})

        sender = None
        if txn.get("sender_email_id"):
            if "senders" in caches:
                sender = caches["senders"].get(txn["sender_email_id"])
            else:
                sender = dynamodb_repo.get_item("email_accounts", {"id": txn.get("sender_email_id")})

        campaign = None
        if txn.get("campaign_id"):
            if "campaigns" in caches:
                campaign = caches["campaigns"].get(txn["campaign_id"])
            else:
                campaign = dynamodb_repo.get_item("campaigns", {"id": txn.get("campaign_id")})

        enriched = {**txn}
        if lead:
            enriched["lead_name"] = lead.get("name")
            enriched["lead_email"] = lead.get("email")
        if sender:
            enriched["sender_email"] = sender.get("email")
        if campaign:
            enriched["campaign_name"] = campaign.get("name")
            
        return enriched

    # ── Stats ────────────────────────────────────────────────────────────

    @staticmethod
    def get_campaign_stats(
        campaign_id: str,
        campaign: Optional[Dict[str, Any]] = None,
        caches: Optional[Dict[str, Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """
        Compute campaign stats: total, sent, pending, failed,
        current step, total steps, completion %.

        `campaign` skips the campaign lookup when the caller already has it.
        `caches` is a mutable dict shared across calls (e.g. a list endpoint
        looping over campaigns) memoizing sequence and audience lookups.
        """
        if campaign is None:
            campaign = dynamodb_repo.get_item("campaigns", {"id": campaign_id})
        if not campaign:
            return {}
        caches = caches if caches is not None else {}
        seq_cache = caches.setdefault("sequences", {})
        aud_cache = caches.setdefault("audiences", {})

        email_txns = dynamodb_repo.query_table(
            table_name="email_transactions",
            key_condition_expression="#pk = :pk",
            expression_values={":pk": f"CAMPAIGN#{campaign_id}"},
            expression_names={"#pk": "PK"}
        )

        total = len(email_txns)
        queued = sum(1 for t in email_txns if t.get("status") == EmailTransactionStatus.QUEUED.value)
        sent = sum(1 for t in email_txns if t.get("status") == EmailTransactionStatus.SENT.value)
        delivered = sum(1 for t in email_txns if t.get("status") == EmailTransactionStatus.DELIVERED.value)
        opened = sum(1 for t in email_txns if t.get("status") == EmailTransactionStatus.OPENED.value)
        clicked = sum(1 for t in email_txns if t.get("status") == EmailTransactionStatus.CLICKED.value)
        replied = sum(1 for t in email_txns if t.get("status") == EmailTransactionStatus.REPLIED.value)
        bounced = sum(1 for t in email_txns if t.get("status") == EmailTransactionStatus.BOUNCED.value)
        failed = sum(1 for t in email_txns if t.get("status") == EmailTransactionStatus.FAILED.value)
        cancelled = sum(1 for t in email_txns if t.get("status") == EmailTransactionStatus.CANCELLED.value)
        sending = sum(1 for t in email_txns if t.get("status") == EmailTransactionStatus.SENDING.value)

        sequence_id = campaign.get("sequence_id")
        if sequence_id:
            if sequence_id not in seq_cache:
                seq_cache[sequence_id] = dynamodb_repo.get_item("sequences", {"sequence_id": sequence_id})
            sequence = seq_cache[sequence_id]
        else:
            sequence = None
        total_steps = len(sequence.get("steps", [])) if sequence else 0

        audience_id = campaign.get("audience_id")
        if audience_id:
            if audience_id not in aud_cache:
                aud_cache[audience_id] = dynamodb_repo.get_item("audiences", {"id": audience_id})
            audience = aud_cache[audience_id]
        else:
            audience = None
        audience_size = len(audience.get("lead_ids", [])) if audience else 0

        total_expected = audience_size * total_steps
        completion_pct = round((sent / total_expected * 100), 1) if total_expected > 0 else 0.0

        return {
            "campaign_id": campaign_id,
            "status": campaign.get("status"),
            "current_step": campaign.get("current_step_order", 0),
            "total_steps": total_steps,
            "total_transactions": total,
            "queued": queued,
            "sending": sending,
            "sent": sent,
            "delivered": delivered,
            "opened": opened,
            "clicked": clicked,
            "replied": replied,
            "bounced": bounced,
            "failed": failed,
            "cancelled": cancelled,
            "completion_percentage": completion_pct
        }
