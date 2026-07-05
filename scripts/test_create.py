import asyncio
from app.main import app
from fastapi.testclient import TestClient

client = TestClient(app)

def run():
    print("Sending request to create a campaign...")
    
    # Needs valid email account, sequence, and lead list.
    # Let's get existing ones first.
    from app.repositories import dynamodb_repo
    accounts = dynamodb_repo.scan_table("email_accounts")
    sequences = dynamodb_repo.scan_table("sequences")
    lead_lists = dynamodb_repo.scan_table("lead_lists")
    
    if not accounts or not sequences or not lead_lists:
        print("Missing prerequisites.")
        return

    account_id = accounts[0]["id"]
    sequence_id = sequences[0]["id"]
    
    # Find a lead list with members
    lead_list_id = None
    for ll in lead_lists:
        if ll.get("lead_ids"):
            lead_list_id = ll["id"]
            break
            
    if not lead_list_id:
        print("No lead list with members.")
        return

    print(f"Using Account: {account_id}, Sequence: {sequence_id}, Lead List: {lead_list_id}")

    payload = {
        "name": "Test Campaign",
        "description": "Test",
        "sender_email_ids": [account_id],
        "sequence_id": sequence_id,
        "lead_list_id": lead_list_id,
        "schedule_at": "2026-07-02T12:00:00Z"
    }

    try:
        response = client.post("/campaigns", json=payload)
        print("Status code:", response.status_code)
        print("Response:", response.json())
    except Exception as e:
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    run()
