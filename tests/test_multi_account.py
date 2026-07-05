import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock, ANY
from datetime import datetime
from app.main import app
from app.services.account_selection_service import AccountSelectionService
from app.scheduler.cron import process_scheduled_emails, reset_daily_counters

client = TestClient(app)

# -------------------------------------------------------------
# 1. Unit Tests for AccountSelectionService
# -------------------------------------------------------------

def test_select_account_single_account():
    # 1 active account under limit
    accounts = [
        {"id": "acc1", "email": "a1@test.com", "is_active": True, "daily_limit": 10, "sent_today": 2, "last_used_at": "2026-06-23T10:00:00Z"}
    ]
    selected = AccountSelectionService.select_account(accounts)
    assert selected is not None
    assert selected["id"] == "acc1"

def test_select_account_rotation_least_recently_used():
    # Account 1 was used at 10:00, Account 2 was used at 09:00. Account 2 should be preferred.
    accounts = [
        {"id": "acc1", "email": "a1@test.com", "is_active": True, "daily_limit": 10, "sent_today": 5, "last_used_at": "2026-06-23T10:00:00Z"},
        {"id": "acc2", "email": "a2@test.com", "is_active": True, "daily_limit": 10, "sent_today": 5, "last_used_at": "2026-06-23T09:00:00Z"}
    ]
    selected = AccountSelectionService.select_account(accounts)
    assert selected is not None
    assert selected["id"] == "acc2"

def test_select_account_prefer_never_used():
    # Account 2 has never been used (last_used_at is None), Account 1 was used at 10:00.
    accounts = [
        {"id": "acc1", "email": "a1@test.com", "is_active": True, "daily_limit": 10, "sent_today": 2, "last_used_at": "2026-06-23T10:00:00Z"},
        {"id": "acc2", "email": "a2@test.com", "is_active": True, "daily_limit": 10, "sent_today": 0, "last_used_at": None}
    ]
    selected = AccountSelectionService.select_account(accounts)
    assert selected is not None
    assert selected["id"] == "acc2"

def test_select_account_four_accounts():
    accounts = [
        {"id": "acc1", "email": "a1@test.com", "is_active": True, "daily_limit": 10, "sent_today": 8, "last_used_at": "2026-06-23T10:00:00Z"},
        {"id": "acc2", "email": "a2@test.com", "is_active": True, "daily_limit": 10, "sent_today": 5, "last_used_at": "2026-06-23T09:30:00Z"},
        {"id": "acc3", "email": "a3@test.com", "is_active": True, "daily_limit": 10, "sent_today": 12, "last_used_at": "2026-06-23T09:00:00Z"}, # over limit
        {"id": "acc4", "email": "a4@test.com", "is_active": True, "daily_limit": 10, "sent_today": 2, "last_used_at": "2026-06-23T08:00:00Z"}
    ]
    # acc3 is over limit (12 >= 10), so candidates are: acc1, acc2, acc4.
    # acc4 has the oldest last_used_at (08:00), so it should be selected.
    selected = AccountSelectionService.select_account(accounts)
    assert selected is not None
    assert selected["id"] == "acc4"

def test_select_account_ignore_inactive():
    accounts = [
        {"id": "acc1", "email": "a1@test.com", "is_active": False, "daily_limit": 10, "sent_today": 2, "last_used_at": "2026-06-23T08:00:00Z"},
        {"id": "acc2", "email": "a2@test.com", "is_active": True, "daily_limit": 10, "sent_today": 5, "last_used_at": "2026-06-23T09:00:00Z"}
    ]
    selected = AccountSelectionService.select_account(accounts)
    assert selected is not None
    assert selected["id"] == "acc2"

def test_select_account_ignore_limit_reached():
    accounts = [
        {"id": "acc1", "email": "a1@test.com", "is_active": True, "daily_limit": 5, "sent_today": 5, "last_used_at": "2026-06-23T08:00:00Z"},
        {"id": "acc2", "email": "a2@test.com", "is_active": True, "daily_limit": 10, "sent_today": 5, "last_used_at": "2026-06-23T09:00:00Z"}
    ]
    selected = AccountSelectionService.select_account(accounts)
    assert selected is not None
    assert selected["id"] == "acc2"

def test_select_account_all_exhausted():
    accounts = [
        {"id": "acc1", "email": "a1@test.com", "is_active": True, "daily_limit": 5, "sent_today": 5, "last_used_at": "2026-06-23T08:00:00Z"},
        {"id": "acc2", "email": "a2@test.com", "is_active": False, "daily_limit": 10, "sent_today": 2, "last_used_at": "2026-06-23T09:00:00Z"}
    ]
    selected = AccountSelectionService.select_account(accounts)
    assert selected is None


# -------------------------------------------------------------
# 2. Integration/Mock Tests for API Endpoints
# -------------------------------------------------------------

@patch("app.api.routes.dynamodb_repo")
def test_get_email_accounts(mock_repo):
    mock_repo.scan_table.return_value = [
        {"id": "acc1", "email": "a1@test.com", "is_active": True, "daily_limit": 30, "sent_today": 12, "refresh_token": "token1"},
        {"id": "acc2", "email": "a2@test.com", "is_active": False, "daily_limit": 20, "sent_today": 0, "refresh_token": "token2"}
    ]
    
    response = client.get("/email-accounts")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert data[0]["account_id"] == "acc1"
    assert data[0]["email"] == "a1@test.com"
    assert data[0]["is_active"] is True
    assert data[0]["daily_limit"] == 30
    assert data[0]["sent_today"] == 12
    # Refresh token should NOT be exposed in the response
    assert "refresh_token" not in data[0]

@patch("app.api.routes.dynamodb_repo")
def test_update_limit(mock_repo):
    mock_repo.get_item.return_value = {"id": "acc1", "email": "a1@test.com", "daily_limit": 30}
    
    response = client.patch("/email-accounts/acc1/limit", json={"daily_limit": 50})
    assert response.status_code == 200
    assert response.json()["daily_limit"] == 50
    mock_repo.put_item.assert_called_once()
    saved_item = mock_repo.put_item.call_args[0][1]
    assert saved_item["daily_limit"] == 50

@patch("app.api.routes.dynamodb_repo")
def test_update_limit_negative(mock_repo):
    # Daily limit must be >= 0
    response = client.patch("/email-accounts/acc1/limit", json={"daily_limit": -5})
    assert response.status_code == 422

@patch("app.api.routes.dynamodb_repo")
def test_update_active(mock_repo):
    mock_repo.get_item.return_value = {"id": "acc1", "email": "a1@test.com", "is_active": True}
    
    response = client.patch("/email-accounts/acc1/active", json={"is_active": False})
    assert response.status_code == 200
    assert response.json()["is_active"] is False
    mock_repo.put_item.assert_called_once()
    saved_item = mock_repo.put_item.call_args[0][1]
    assert saved_item["is_active"] is False


# -------------------------------------------------------------
# 3. Integration/Mock Tests for Scheduler & Log Logic
# -------------------------------------------------------------

@patch.dict("os.environ", {"APP_BASE_URL": ""})  # disable tracking instrumentation for a deterministic body
@patch("app.scheduler.cron.dynamodb_repo")
@patch("app.scheduler.cron.send_email")
def test_scheduler_success(mock_send_email, mock_repo):
    # Mock pending scheduled email
    mock_repo.query_gsi.return_value = [
        {"id": "email1", "lead_id": "lead1", "subject": "Hello", "body": "Body", "status": "pending", "send_at": "2026-06-23T10:00:00Z"}
    ]
    # Mock accounts list
    mock_repo.scan_table.return_value = [
        {"id": "acc1", "email": "a1@test.com", "is_active": True, "daily_limit": 10, "sent_today": 2, "last_used_at": "2026-06-23T08:00:00Z", "refresh_token": "token1"}
    ]
    # Mock lead retrieval
    mock_repo.get_item.return_value = {"id": "lead1", "email": "lead@test.com", "name": "Lead Person"}
    
    process_scheduled_emails()
    
    # Check that send_email was called with the correct refresh token
    mock_send_email.assert_called_once_with("lead@test.com", "Hello", "Body", "token1")
    
    # Check that scheduled_emails was updated to "sent" (with tracking metadata)
    mock_repo.update_item.assert_any_call(
        "scheduled_emails",
        {"id": "email1"},
        "SET #st = :sent, sent_at = :sent_at, tracked_urls = :urls",
        {":sent": "sent", ":sent_at": ANY, ":urls": []},
        {"#st": "status"}
    )
    
    # Check that the email account's sent_today was incremented, and last_used_at was updated
    account_put_call = [args[1] for args, kwargs in mock_repo.put_item.call_args_list if args[0] == "email_accounts"]
    assert len(account_put_call) == 1
    updated_acc = account_put_call[0]
    assert updated_acc["id"] == "acc1"
    assert updated_acc["sent_today"] == 3
    assert "last_used_at" in updated_acc
    
    # Check that a log entry was written in email_logs
    log_calls = [args[0] for args, kwargs in mock_repo.put_item.call_args_list if args[0] == "email_logs"]
    assert len(log_calls) == 1
    log_item = [args[1] for args, kwargs in mock_repo.put_item.call_args_list if args[0] == "email_logs"][0]
    assert log_item["email_id"] == "email1"
    assert log_item["lead_id"] == "lead1"
    assert log_item["sender_account_id"] == "acc1"
    assert log_item["sender_email"] == "a1@test.com"
    assert log_item["status"] == "sent"
    assert "sent_at" in log_item

@patch("app.scheduler.cron.dynamodb_repo")
@patch("app.scheduler.cron.send_email")
def test_scheduler_failure(mock_send_email, mock_repo):
    # Mock pending scheduled email
    mock_repo.query_gsi.return_value = [
        {"id": "email1", "lead_id": "lead1", "subject": "Hello", "body": "Body", "status": "pending", "send_at": "2026-06-23T10:00:00Z"}
    ]
    # Mock accounts list
    mock_repo.scan_table.return_value = [
        {"id": "acc1", "email": "a1@test.com", "is_active": True, "daily_limit": 10, "sent_today": 2, "last_used_at": "2026-06-23T08:00:00Z", "refresh_token": "token1"}
    ]
    # Mock lead retrieval
    mock_repo.get_item.return_value = {"id": "lead1", "email": "lead@test.com", "name": "Lead Person"}
    # Mock SMTP error
    mock_send_email.side_effect = Exception("SMTP Server Down")
    
    process_scheduled_emails()
    
    # Check that scheduled_emails was updated to "failed"
    mock_repo.update_item.assert_any_call(
        "scheduled_emails",
        {"id": "email1"},
        "SET #st = :failed",
        {":failed": "failed"},
        {"#st": "status"}
    )
    
    # Check that email account's sent_today was NOT incremented, but last_used_at was updated
    account_put_call = [args[1] for args, kwargs in mock_repo.put_item.call_args_list if args[0] == "email_accounts"]
    assert len(account_put_call) == 1
    updated_acc = account_put_call[0]
    assert updated_acc["id"] == "acc1"
    assert updated_acc["sent_today"] == 2
    assert "last_used_at" in updated_acc
    
    # Check that a log entry was written in email_logs with status="failed"
    log_item = [args[1] for args, kwargs in mock_repo.put_item.call_args_list if args[0] == "email_logs"][0]
    assert log_item["email_id"] == "email1"
    assert log_item["status"] == "failed"


@patch("app.scheduler.cron.dynamodb_repo")
@patch("app.scheduler.cron.send_email")
def test_scheduler_no_available_accounts(mock_send_email, mock_repo):
    # Mock pending scheduled email
    mock_repo.query_gsi.return_value = [
        {"id": "email1", "lead_id": "lead1", "subject": "Hello", "body": "Body", "status": "pending", "send_at": "2026-06-23T10:00:00Z"}
    ]
    # Mock accounts list (all inactive or limit reached)
    mock_repo.scan_table.return_value = [
        {"id": "acc1", "email": "a1@test.com", "is_active": False, "daily_limit": 10, "sent_today": 2, "refresh_token": "token1"},
        {"id": "acc2", "email": "a2@test.com", "is_active": True, "daily_limit": 5, "sent_today": 5, "refresh_token": "token2"}
    ]
    
    process_scheduled_emails()
    
    # Send email should NOT be called
    mock_send_email.assert_not_called()
    
    # Scheduled email should NOT be modified (status remains pending)
    mock_repo.update_item.assert_not_called()
    # No logs or accounts updated
    # Scan was called, but put_item should not be called with email_logs or email_accounts updates
    put_calls = [args[0] for args, kwargs in mock_repo.put_item.call_args_list]
    assert "email_logs" not in put_calls
    assert "email_accounts" not in put_calls

@patch("app.scheduler.cron.dynamodb_repo")
def test_daily_counter_reset(mock_repo):
    # Mock accounts in DB
    mock_repo.scan_table.return_value = [
        {"id": "acc1", "email": "a1@test.com", "sent_today": 12},
        {"id": "acc2", "email": "a2@test.com", "sent_today": 0}
    ]
    
    reset_daily_counters()
    
    # Should only call put_item for acc1 since acc2 is already 0
    mock_repo.put_item.assert_called_once()
    saved = mock_repo.put_item.call_args[0][1]
    assert saved["id"] == "acc1"
    assert saved["sent_today"] == 0
