"""
Open/click tracking (Brevo/Kit-style).

- Every outgoing email gets a 1x1 pixel (`/o/{token}`) and its links rewritten
  to `/c/{token}/{idx}`.
- Tokens are per-send IDs with a flow prefix:
    t-{transaction_id}      campaign flow (email_transactions)
    s-{scheduled_email_id}  direct flow (scheduled_emails)
- Destination URLs are stored on the send record (`tracked_urls`) at send time
  and looked up by index on click — never taken from the request, so the
  redirect endpoint cannot be abused as an open redirect.
- Every hit is logged to `email_events`; proxy/prefetch opens are flagged
  `is_bot_suspect` and do not update the send record. Clicks always count.
"""

import base64
import logging
import re
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Tuple

import ulid

from app.repositories import dynamodb_repo
from app.models.schemas import current_time_iso

logger = logging.getLogger(__name__)

# 1x1 transparent GIF
PIXEL_GIF = base64.b64decode("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7")

# User-agent markers for image proxies / prefetchers / crawlers.
# These fire without a human opening the email.
BOT_UA_MARKERS = (
    "googleimageproxy",
    "yahoomailproxy",
    "yahoocachesystem",
    "bingpreview",
    "bot",
    "crawler",
    "spider",
    "curl",
    "wget",
    "python-requests",
)

# An "open" this soon after sending is a machine prefetch, not a human.
MIN_HUMAN_OPEN_SECONDS = 2

_HREF_RE = re.compile(r'href="(https?://[^"]+)"')


# ── HTML instrumentation (send time) ─────────────────────────────────────────

def instrument_html(html: str, token: str, base_url: str) -> Tuple[str, List[str]]:
    """
    Rewrite every external link to the click-tracking endpoint and append the
    open pixel. Returns (instrumented_html, ordered original URLs).

    Links already pointing at base_url (e.g. the unsubscribe link) are left
    untouched so they aren't double-tracked.
    """
    base_url = base_url.rstrip("/")
    tracked_urls: List[str] = []

    def rewrite(match):
        url = match.group(1)
        if url.startswith(base_url):
            return match.group(0)
        idx = len(tracked_urls)
        tracked_urls.append(url)
        return f'href="{base_url}/c/{token}/{idx}"'

    html = _HREF_RE.sub(rewrite, html)
    html += f'<img src="{base_url}/o/{token}" width="1" height="1" alt="">'
    return html, tracked_urls


# ── Token resolution ─────────────────────────────────────────────────────────

def _resolve_record(token: str) -> Tuple[Optional[str], Optional[Dict[str, Any]]]:
    """Return (flow, record) for a token, or (None, None) if unknown."""
    if token.startswith("t-"):
        from app.services.transaction_service import TransactionService
        return "transaction", TransactionService._find_transaction_raw(token[2:])
    if token.startswith("s-"):
        return "scheduled", dynamodb_repo.get_item("scheduled_emails", {"id": token[2:]})
    return None, None


# ── Bot detection ────────────────────────────────────────────────────────────

def _is_bot_suspect(user_agent: Optional[str], record: Dict[str, Any]) -> bool:
    ua = (user_agent or "").lower()
    if any(marker in ua for marker in BOT_UA_MARKERS):
        return True

    sent_at = record.get("sent_at")
    if sent_at:
        try:
            sent = datetime.fromisoformat(sent_at.replace("Z", "+00:00"))
            elapsed = (datetime.now(timezone.utc) - sent).total_seconds()
            if elapsed < MIN_HUMAN_OPEN_SECONDS:
                return True
        except ValueError:
            pass
    return False


# ── Event logging ────────────────────────────────────────────────────────────

def _log_event(token: str, event_type: str, url: Optional[str], user_agent: Optional[str], is_bot_suspect: bool):
    dynamodb_repo.put_item("email_events", {
        "token": token,
        "event_id": ulid.new().str,
        "type": event_type,
        "url": url,
        "user_agent": user_agent or "",
        "is_bot_suspect": is_bot_suspect,
        "created_at": current_time_iso(),
    })


def _update_scheduled_record(record: Dict[str, Any], event_type: str):
    """Engagement counters for the direct-scheduling flow (scheduled_emails)."""
    now = current_time_iso()
    if event_type == "open":
        if not record.get("opened_at"):
            record["opened_at"] = now
        record["open_count"] = int(record.get("open_count", 0)) + 1
    else:
        if not record.get("clicked_at"):
            record["clicked_at"] = now
        record["click_count"] = int(record.get("click_count", 0)) + 1
    dynamodb_repo.put_item("scheduled_emails", record)


def _update_transaction_record(record: Dict[str, Any], status: str):
    from app.services.transaction_service import TransactionService
    TransactionService.update_transaction(
        record["transaction_id"],
        {"status": status},
        keys={"PK": record["PK"], "SK": record["SK"]},
    )


# ── Public API (called by tracking endpoints) ────────────────────────────────

def record_open(token: str, user_agent: Optional[str]):
    """Log an open. Unknown tokens are dropped silently (endpoint always 200s)."""
    try:
        flow, record = _resolve_record(token)
        if not record:
            return

        suspect = _is_bot_suspect(user_agent, record)
        _log_event(token, "open", None, user_agent, suspect)

        if suspect:
            return  # logged for analysis, but not a human open

        if flow == "transaction":
            _update_transaction_record(record, "opened")
        else:
            _update_scheduled_record(record, "open")
    except Exception as e:
        # The pixel must never fail the recipient's mail client
        logger.error(f"Failed to record open for token {token}: {e}")


def record_click(token: str, idx: int, user_agent: Optional[str]) -> Optional[str]:
    """
    Log a click and return the stored destination URL, or None if the
    token/index is unknown (caller should 404).
    """
    flow, record = _resolve_record(token)
    if not record:
        return None

    tracked_urls = record.get("tracked_urls") or []
    if idx < 0 or idx >= len(tracked_urls):
        return None
    url = tracked_urls[idx]

    try:
        # Clicks are ground truth — always logged and always counted
        _log_event(token, "click", url, user_agent, False)
        if flow == "transaction":
            _update_transaction_record(record, "clicked")
        else:
            _update_scheduled_record(record, "click")
    except Exception as e:
        # Never block the redirect on logging problems
        logger.error(f"Failed to record click for token {token}: {e}")

    return url


def get_events(token: str) -> List[Dict[str, Any]]:
    """All raw events for a token, oldest first (event_id is a ULID)."""
    return dynamodb_repo.query_table(
        table_name="email_events",
        key_condition_expression="#tk = :token",
        expression_values={":token": token},
        expression_names={"#tk": "token"},
    )
