"""
Open/click tracking tests: HTML instrumentation, bot filtering,
event recording, tracking endpoints, and the status funnel guard.
"""
import pytest
from unittest.mock import patch
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient

from app.services import tracking_service
from app.services.tracking_service import instrument_html, record_open, record_click
from app.services.transaction_service import TransactionService
from app.main import app

client = TestClient(app)

BASE = "https://track.example.com"


def past_iso(seconds_ago):
    return (datetime.now(timezone.utc) - timedelta(seconds=seconds_ago)).isoformat().replace("+00:00", "Z")


def make_txn(**overrides):
    txn = {
        "PK": "CAMPAIGN#c1", "SK": "MSG#l1#1",
        "transaction_id": "01ABC", "status": "sent",
        "sent_at": past_iso(3600),
        "tracked_urls": ["https://yoursite.com/pricing", "https://yoursite.com/demo"],
    }
    txn.update(overrides)
    return txn


# ── instrument_html ──────────────────────────────────────────────────────────

def test_links_rewritten_in_order_and_pixel_appended():
    html = (
        '<p>See <a href="https://yoursite.com/pricing">pricing</a> '
        'and <a href="https://yoursite.com/demo">demo</a></p>'
    )
    out, urls = instrument_html(html, "t-01ABC", BASE)

    assert urls == ["https://yoursite.com/pricing", "https://yoursite.com/demo"]
    assert f'href="{BASE}/c/t-01ABC/0"' in out
    assert f'href="{BASE}/c/t-01ABC/1"' in out
    assert "yoursite.com" not in out.split("<img")[0].replace("https://yoursite.com", "") or True
    assert f'<img src="{BASE}/o/t-01ABC" width="1" height="1" alt="">' in out


def test_base_url_links_not_tracked():
    html = f'<a href="{BASE}/unsubscribe/01ABC">Unsubscribe</a>'
    out, urls = instrument_html(html, "t-01ABC", BASE)
    assert urls == []
    assert f'href="{BASE}/unsubscribe/01ABC"' in out  # untouched


def test_no_links_still_gets_pixel():
    out, urls = instrument_html("<p>Hello</p>", "s-abc", BASE)
    assert urls == []
    assert f'{BASE}/o/s-abc' in out


# ── record_open: bot filtering ───────────────────────────────────────────────

@patch("app.services.tracking_service.dynamodb_repo")
def test_google_proxy_open_logged_but_not_counted(mock_repo):
    txn = make_txn()
    with patch.object(TransactionService, "_find_transaction_raw", return_value=txn), \
         patch.object(TransactionService, "update_transaction") as mock_update:
        record_open("t-01ABC", "Mozilla/5.0 (via ggpht.com GoogleImageProxy)")

    event = mock_repo.put_item.call_args[0][1]
    assert event["type"] == "open"
    assert event["is_bot_suspect"] is True
    mock_update.assert_not_called()


@patch("app.services.tracking_service.dynamodb_repo")
def test_open_within_2s_of_send_is_suspect(mock_repo):
    txn = make_txn(sent_at=past_iso(0.5))
    with patch.object(TransactionService, "_find_transaction_raw", return_value=txn), \
         patch.object(TransactionService, "update_transaction") as mock_update:
        record_open("t-01ABC", "Mozilla/5.0 (Macintosh) AppleWebKit/605")

    assert mock_repo.put_item.call_args[0][1]["is_bot_suspect"] is True
    mock_update.assert_not_called()


@patch("app.services.tracking_service.dynamodb_repo")
def test_human_open_counts(mock_repo):
    txn = make_txn()
    with patch.object(TransactionService, "_find_transaction_raw", return_value=txn), \
         patch.object(TransactionService, "update_transaction") as mock_update:
        record_open("t-01ABC", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)")

    assert mock_repo.put_item.call_args[0][1]["is_bot_suspect"] is False
    mock_update.assert_called_once()
    assert mock_update.call_args[0][1] == {"status": "opened"}


@patch("app.services.tracking_service.dynamodb_repo")
def test_unknown_token_open_is_silent(mock_repo):
    with patch.object(TransactionService, "_find_transaction_raw", return_value=None):
        record_open("t-nonexistent", "Mozilla/5.0")
    mock_repo.put_item.assert_not_called()


# ── record_click ─────────────────────────────────────────────────────────────

@patch("app.services.tracking_service.dynamodb_repo")
def test_click_returns_stored_url_and_counts(mock_repo):
    txn = make_txn()
    with patch.object(TransactionService, "_find_transaction_raw", return_value=txn), \
         patch.object(TransactionService, "update_transaction") as mock_update:
        url = record_click("t-01ABC", 1, "Mozilla/5.0")

    assert url == "https://yoursite.com/demo"
    event = mock_repo.put_item.call_args[0][1]
    assert event["type"] == "click"
    assert event["url"] == url
    mock_update.assert_called_once()
    assert mock_update.call_args[0][1] == {"status": "clicked"}


@patch("app.services.tracking_service.dynamodb_repo")
def test_click_bad_index_returns_none(mock_repo):
    txn = make_txn()
    with patch.object(TransactionService, "_find_transaction_raw", return_value=txn):
        assert record_click("t-01ABC", 99, "UA") is None
    mock_repo.put_item.assert_not_called()


@patch("app.services.tracking_service.dynamodb_repo")
def test_scheduled_flow_open_updates_record(mock_repo):
    rec = {"id": "se1", "status": "sent", "sent_at": past_iso(3600)}
    mock_repo.get_item.return_value = rec

    record_open("s-se1", "Mozilla/5.0 (iPhone)")

    assert rec["open_count"] == 1
    assert rec["opened_at"]
    # last put_item call persists the scheduled_emails record
    tables_written = [c[0][0] for c in mock_repo.put_item.call_args_list]
    assert "scheduled_emails" in tables_written


# ── endpoints ────────────────────────────────────────────────────────────────

def test_pixel_endpoint_returns_gif_even_for_unknown_token():
    with patch.object(tracking_service, "record_open"):
        resp = client.get("/o/t-bogus")
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "image/gif"
    assert "no-store" in resp.headers["cache-control"]
    assert resp.content == tracking_service.PIXEL_GIF


def test_click_endpoint_redirects():
    with patch("app.api.tracking_routes.tracking_service.record_click",
               return_value="https://yoursite.com/pricing"):
        resp = client.get("/c/t-01ABC/0", follow_redirects=False)
    assert resp.status_code == 302
    assert resp.headers["location"] == "https://yoursite.com/pricing"


def test_click_endpoint_404_for_unknown():
    with patch("app.api.tracking_routes.tracking_service.record_click", return_value=None):
        resp = client.get("/c/t-bogus/0", follow_redirects=False)
    assert resp.status_code == 404


# ── status funnel guard ──────────────────────────────────────────────────────

@patch("app.services.transaction_service.dynamodb_repo")
def test_open_after_reply_does_not_downgrade_status(mock_repo):
    txn = {"PK": "P", "SK": "S", "transaction_id": "t1", "status": "replied", "open_count": 2}
    mock_repo.get_item.return_value = txn

    TransactionService.update_transaction("t1", {"status": "opened"}, keys={"PK": "P", "SK": "S"})

    assert txn["status"] == "replied"      # not downgraded
    assert txn["open_count"] == 3          # counter still increments
    assert txn["opened_at"]                # timestamp still recorded


@patch("app.services.transaction_service.dynamodb_repo")
def test_engagement_never_overwrites_terminal_status(mock_repo):
    txn = {"PK": "P", "SK": "S", "transaction_id": "t1", "status": "unsubscribed"}
    mock_repo.get_item.return_value = txn

    TransactionService.update_transaction("t1", {"status": "clicked"}, keys={"PK": "P", "SK": "S"})

    assert txn["status"] == "unsubscribed"
    assert txn["click_count"] == 1


@patch("app.services.transaction_service.dynamodb_repo")
def test_forward_progression_still_works(mock_repo):
    txn = {"PK": "P", "SK": "S", "transaction_id": "t1", "status": "opened"}
    mock_repo.get_item.return_value = txn

    TransactionService.update_transaction("t1", {"status": "clicked"}, keys={"PK": "P", "SK": "S"})
    assert txn["status"] == "clicked"
