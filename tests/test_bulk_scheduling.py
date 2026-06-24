import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch
from app.main import app

client = TestClient(app)

@pytest.fixture
def mock_dynamodb():
    with patch("app.api.routes.dynamodb_repo") as mock_repo:
        yield mock_repo

def test_bulk_schedule_invalid_account(mock_dynamodb):
    mock_dynamodb.get_item.return_value = None
    
    response = client.post("/emails/bulk-schedule", json={
        "account_id": "invalid_acc",
        "lead_ids": ["lead1"],
        "subject": "Test",
        "body": "Test Body",
        "send_at": "2026-06-25T10:00:00Z"
    })
    
    assert response.status_code == 404
    assert response.json()["detail"] == "Email account not found"

def test_bulk_schedule_empty_leads(mock_dynamodb):
    response = client.post("/emails/bulk-schedule", json={
        "account_id": "valid_acc",
        "lead_ids": [],
        "subject": "Test",
        "body": "Test Body",
        "send_at": "2026-06-25T10:00:00Z"
    })
    
    assert response.status_code == 400
    assert response.json()["detail"] == "lead_ids cannot be empty"

def test_bulk_schedule_1_lead(mock_dynamodb):
    mock_dynamodb.get_item.side_effect = lambda table, key: {"id": "acc1"} if table == "email_accounts" else {"id": "lead1", "name": "John", "company": "Nike"}
    
    response = client.post("/emails/bulk-schedule", json={
        "account_id": "acc1",
        "lead_ids": ["lead1"],
        "subject": "Hi {{name}}",
        "body": "From {{company}}",
        "send_at": "2026-06-25T10:00:00Z"
    })
    
    assert response.status_code == 200
    data = response.json()
    assert data["scheduled_count"] == 1
    assert data["failed_count"] == 0
    mock_dynamodb.batch_write_items.assert_called_once()
    
    # Check rendered templates
    write_args = mock_dynamodb.batch_write_items.call_args[0][1]
    assert write_args[0]["subject"] == "Hi John"
    assert write_args[0]["body"] == "From Nike"

def test_bulk_schedule_10_leads_with_failures(mock_dynamodb):
    # Setup mock to return an account, but only find 8 out of 10 leads
    def mock_get_item(table, key):
        if table == "email_accounts":
            return {"id": "acc1"}
        if table == "leads":
            lead_id = key["id"]
            if int(lead_id.replace("lead", "")) <= 8:
                return {"id": lead_id, "name": f"User {lead_id}"}
            return None
            
    mock_dynamodb.get_item.side_effect = mock_get_item
    
    lead_ids = [f"lead{i}" for i in range(1, 11)]
    
    response = client.post("/emails/bulk-schedule", json={
        "account_id": "acc1",
        "lead_ids": lead_ids,
        "subject": "Test",
        "body": "Test",
        "send_at": "2026-06-25T10:00:00Z"
    })
    
    assert response.status_code == 200
    data = response.json()
    assert data["scheduled_count"] == 8
    assert data["failed_count"] == 2

def test_bulk_schedule_100_leads(mock_dynamodb):
    def mock_get_item(table, key):
        if table == "email_accounts": return {"id": "acc1"}
        if table == "leads": return {"id": key["id"], "name": "Test"}
            
    mock_dynamodb.get_item.side_effect = mock_get_item
    
    lead_ids = [f"lead{i}" for i in range(1, 101)]
    
    response = client.post("/emails/bulk-schedule", json={
        "account_id": "acc1",
        "lead_ids": lead_ids,
        "subject": "Test",
        "body": "Test",
        "send_at": "2026-06-25T10:00:00Z"
    })
    
    assert response.status_code == 200
    data = response.json()
    assert data["scheduled_count"] == 100
    assert data["failed_count"] == 0

def test_bulk_schedule_by_filter(mock_dynamodb):
    mock_dynamodb.get_item.return_value = {"id": "acc1"}
    
    # Mock scan to return 3 leads, 2 from Nike, 1 from Adidas
    mock_dynamodb.scan_table.return_value = [
        {"id": "lead1", "company": "Nike"},
        {"id": "lead2", "company": "Nike"},
        {"id": "lead3", "company": "Adidas"}
    ]
    
    response = client.post("/emails/bulk-schedule-by-filter", json={
        "account_id": "acc1",
        "subject": "Test",
        "body": "Test",
        "send_at": "2026-06-25T10:00:00Z",
        "filters": {"company": "Nike"}
    })
    
    assert response.status_code == 200
    data = response.json()
    assert data["scheduled_count"] == 2
    assert data["failed_count"] == 0
