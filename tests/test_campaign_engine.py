"""
Core campaign engine tests: A/B split, lazy step generation,
step completion, transaction status machine, duplicate-send guard.
All DynamoDB and Gmail calls are mocked.
"""
import pytest
from unittest.mock import patch, MagicMock

from app.services.campaign_service import CampaignService
from app.services.transaction_service import TransactionService


def make_campaign(**overrides):
    campaign = {
        "id": "camp1",
        "name": "Test Campaign",
        "sequence_id": "seq1",
        "audience_id": "aud1",
        "sender_email_ids": ["acc1"],
        "schedule_at": "2026-01-01T00:00:00Z",
        "status": "scheduled",
        "current_step_order": 0,
    }
    campaign.update(overrides)
    return campaign


def make_step(step_order=1, wait_days=0, with_b=True):
    variants = {"a": {"title": "Hi {{name}}", "body": "Body A"}}
    variants["b"] = {"title": "Hello {{name}}", "body": "Body B"} if with_b else None
    return {"step_order": step_order, "wait_days": wait_days, "variants": variants}


def lead_dicts(n, **extra):
    return [{"id": f"lead{i}", "name": f"User {i}", "email": f"u{i}@x.com", **extra} for i in range(n)]


# ── A/B split ────────────────────────────────────────────────────────────────

@patch("app.services.campaign_service.dynamodb_repo")
def test_ab_split_even_distribution(mock_repo):
    leads = lead_dicts(10)
    mock_repo.get_item.return_value = {"id": "aud1", "lead_ids": [l["id"] for l in leads]}
    mock_repo.batch_get_items.return_value = leads

    CampaignService.generate_step_transactions(make_campaign(), make_step(with_b=True), [make_step()])

    written = mock_repo.batch_write_items.call_args[0][1]
    assert len(written) == 10
    variants = [t["variant"] for t in written]
    assert variants.count("a") == 5
    assert variants.count("b") == 5


@patch("app.services.campaign_service.dynamodb_repo")
def test_null_variant_b_assigns_all_a(mock_repo):
    leads = lead_dicts(7)
    mock_repo.get_item.return_value = {"id": "aud1", "lead_ids": [l["id"] for l in leads]}
    mock_repo.batch_get_items.return_value = leads

    CampaignService.generate_step_transactions(make_campaign(), make_step(with_b=False), [make_step(with_b=False)])

    written = mock_repo.batch_write_items.call_args[0][1]
    assert len(written) == 7
    assert all(t["variant"] == "a" for t in written)


@patch("app.services.campaign_service.dynamodb_repo")
def test_unsubscribed_leads_skipped_in_generation(mock_repo):
    leads = lead_dicts(5)
    leads[2]["unsubscribed"] = True
    mock_repo.get_item.return_value = {"id": "aud1", "lead_ids": [l["id"] for l in leads]}
    mock_repo.batch_get_items.return_value = leads

    CampaignService.generate_step_transactions(make_campaign(), make_step(), [make_step()])

    written = mock_repo.batch_write_items.call_args[0][1]
    assert len(written) == 4
    assert "lead2" not in [t["lead_id"] for t in written]


# ── Lazy generation & scheduling ─────────────────────────────────────────────

@patch("app.services.campaign_service.dynamodb_repo")
def test_create_campaign_generates_step_one_only(mock_repo):
    steps = [make_step(1, 0), make_step(2, 3), make_step(3, 2)]
    leads = lead_dicts(4)

    def get_item(table, key):
        if table == "sequences":
            return {"sequence_id": "seq1", "steps": steps}
        if table == "audiences":
            return {"id": "aud1", "lead_ids": [l["id"] for l in leads]}
        return None

    mock_repo.get_item.side_effect = get_item
    mock_repo.batch_get_items.return_value = leads

    CampaignService.create_campaign(make_campaign())

    written = mock_repo.batch_write_items.call_args[0][1]
    assert all(t["step_order"] == 1 for t in written)
    assert all(t["status"] == "queued" for t in written)
    # SK format
    assert written[0]["SK"].startswith("MSG#") and written[0]["SK"].endswith("#1")


def test_step_time_accumulates_wait_days():
    campaign = make_campaign()
    steps = [make_step(1, 0), make_step(2, 3), make_step(3, 2)]
    assert CampaignService._calculate_step_time(campaign, steps[0], steps) == "2026-01-01T00:00:00Z"
    assert CampaignService._calculate_step_time(campaign, steps[1], steps) == "2026-01-04T00:00:00Z"
    assert CampaignService._calculate_step_time(campaign, steps[2], steps) == "2026-01-06T00:00:00Z"


# ── Step completion ──────────────────────────────────────────────────────────

def completion_env(mock_repo, txn_statuses, current_step=1, total_steps=2):
    steps = [make_step(i, 0) for i in range(1, total_steps + 1)]
    mock_repo.query_table.return_value = [
        {"step_order": current_step, "status": s} for s in txn_statuses
    ]
    mock_repo.get_item.return_value = {"sequence_id": "seq1", "steps": steps}
    return make_campaign(current_step_order=current_step, status="running")


@patch.object(CampaignService, "generate_step_transactions")
@patch("app.services.campaign_service.dynamodb_repo")
def test_incomplete_step_does_not_advance(mock_repo, mock_gen):
    campaign = completion_env(mock_repo, ["sent", "queued", "sent"])
    CampaignService.check_step_completion(campaign)
    mock_gen.assert_not_called()
    assert campaign["status"] == "running"


@patch.object(CampaignService, "generate_step_transactions")
@patch("app.services.campaign_service.dynamodb_repo")
def test_inflight_sending_does_not_advance(mock_repo, mock_gen):
    campaign = completion_env(mock_repo, ["sent", "sending"])
    CampaignService.check_step_completion(campaign)
    mock_gen.assert_not_called()


@patch.object(CampaignService, "generate_step_transactions")
@patch("app.services.campaign_service.dynamodb_repo")
def test_complete_step_generates_next(mock_repo, mock_gen):
    campaign = completion_env(mock_repo, ["sent", "failed", "sent"])
    CampaignService.check_step_completion(campaign)
    mock_gen.assert_called_once()
    next_step = mock_gen.call_args[0][1]
    assert next_step["step_order"] == 2


@patch.object(CampaignService, "generate_step_transactions")
@patch("app.services.campaign_service.dynamodb_repo")
def test_last_step_complete_marks_campaign_completed(mock_repo, mock_gen):
    campaign = completion_env(mock_repo, ["sent", "sent"], current_step=2, total_steps=2)
    CampaignService.check_step_completion(campaign)
    mock_gen.assert_not_called()
    assert campaign["status"] == "completed"
    mock_repo.put_item.assert_called_with("campaigns", campaign)


# ── Transaction status machine ───────────────────────────────────────────────

@patch("app.services.transaction_service.dynamodb_repo")
def test_first_open_guard_and_counter(mock_repo):
    txn = {"PK": "CAMPAIGN#c", "SK": "MSG#l#1", "transaction_id": "t1", "status": "sent"}
    mock_repo.get_item.return_value = txn
    keys = {"PK": txn["PK"], "SK": txn["SK"]}

    TransactionService.update_transaction("t1", {"status": "opened"}, keys=keys)
    first_opened_at = txn["opened_at"]
    assert txn["open_count"] == 1

    TransactionService.update_transaction("t1", {"status": "opened"}, keys=keys)
    assert txn["opened_at"] == first_opened_at  # first-open timestamp preserved
    assert txn["open_count"] == 2


@patch("app.services.transaction_service.dynamodb_repo")
def test_failed_sets_timestamp_and_error(mock_repo):
    txn = {"PK": "CAMPAIGN#c", "SK": "MSG#l#1", "transaction_id": "t1", "status": "queued"}
    mock_repo.get_item.return_value = txn

    TransactionService.update_transaction(
        "t1", {"status": "failed", "error_message": "boom"},
        keys={"PK": txn["PK"], "SK": txn["SK"]}
    )
    assert txn["status"] == "failed"
    assert txn["failed_at"]
    assert txn["error_message"] == "boom"


@patch("app.services.transaction_service.dynamodb_repo")
def test_unsubscribed_sets_timestamp(mock_repo):
    txn = {"PK": "CAMPAIGN#c", "SK": "MSG#l#1", "transaction_id": "t1", "status": "sent"}
    mock_repo.get_item.return_value = txn

    TransactionService.update_transaction(
        "t1", {"status": "unsubscribed"}, keys={"PK": txn["PK"], "SK": txn["SK"]}
    )
    assert txn["status"] == "unsubscribed"
    assert txn["unsubscribed_at"]


# ── Duplicate-send guard ─────────────────────────────────────────────────────

def queued_txn():
    return {
        "PK": "CAMPAIGN#camp1", "SK": "MSG#lead1#1",
        "transaction_id": "t1", "campaign_id": "camp1",
        "lead_id": "lead1", "step_order": 1, "variant": "a",
        "status": "queued",
    }


@patch("app.services.campaign_service.send_email")
@patch("app.services.campaign_service.dynamodb_repo")
def test_already_claimed_transaction_is_skipped(mock_repo, mock_send):
    mock_repo.update_item.return_value = False  # conditional claim fails

    CampaignService._send_single_email(queued_txn(), make_campaign(), [])

    mock_send.assert_not_called()
    # Only the claim attempt — no status writes
    assert mock_repo.update_item.call_count == 1


@patch("app.services.campaign_service.send_email")
@patch("app.services.campaign_service.dynamodb_repo")
def test_no_available_sender_releases_claim(mock_repo, mock_send):
    mock_repo.update_item.return_value = True  # claim succeeds

    def get_item(table, key):
        if table == "sequences":
            return {"sequence_id": "seq1", "steps": [make_step()]}
        if table == "leads":
            return {"id": "lead1", "name": "User", "email": "u@x.com"}
        return None

    mock_repo.get_item.side_effect = get_item

    # Empty account pool -> no sender available
    CampaignService._send_single_email(queued_txn(), make_campaign(), [])

    mock_send.assert_not_called()
    # Second update_item call releases the claim back to queued
    assert mock_repo.update_item.call_count == 2
    release_values = mock_repo.update_item.call_args[0][3]
    assert release_values == {":queued": "queued"}
