import os
import sys
import ulid
from dotenv import load_dotenv

# Add parent directory to path so we can import app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.repositories import dynamodb_repo

def migrate():
    print("Starting migration from campaign_emails to email_transactions...")
    
    # 1. Ensure target table exists (triggering initialization)
    import app.database.init_dynamodb as init_db
    init_db.init_db()

    # 2. Fetch all legacy emails
    legacy_emails = dynamodb_repo.scan_table("campaign_emails")
    print(f"Found {len(legacy_emails)} legacy campaign_emails.")

    if not legacy_emails:
        print("No emails to migrate. Exiting.")
        return

    # 3. Process and map to new format
    new_transactions = []
    for ce in legacy_emails:
        campaign_id = ce.get("campaign_id")
        lead_id = ce.get("lead_id")
        step_order = int(ce.get("step_order", 1))
        
        # Load campaign to get lead_list_id and sequence_id
        campaign = dynamodb_repo.get_item("campaigns", {"id": campaign_id})
        if not campaign:
            print(f"Warning: Campaign {campaign_id} not found for email {ce.get('id')}. Skipping.")
            continue
            
        status = ce.get("status", "pending")
        if status == "pending":
            status = "queued"

        # Map legacy fields to new fields
        txn = {
            "PK": f"CAMPAIGN#{campaign_id}",
            "SK": f"MSG#{lead_id}#{step_order}",
            "transaction_id": ulid.new().str,
            "campaign_id": campaign_id,
            "sequence_id": campaign.get("sequence_id", ""),
            "step_order": step_order,
            "lead_id": lead_id,
            "sender_email_id": ce.get("sender_email_id"),
            "lead_list_id": campaign.get("lead_list_id"),
            "variant": ce.get("selected_variant", "a"),
            "status": status,
            "created_at": ce.get("created_at"),
            "scheduled_for": ce.get("scheduled_at"),
            "sent_at": ce.get("sent_at"),
            "open_count": 0,
            "click_count": 0
        }
        
        # Clean up nulls
        txn = {k: v for k, v in txn.items() if v is not None}
        new_transactions.append(txn)

    # 4. Batch insert into new table
    if new_transactions:
        dynamodb_repo.batch_write_items("email_transactions", new_transactions)
        print(f"Successfully migrated {len(new_transactions)} transactions.")
        print("Note: You can now safely drop the campaign_emails table.")
    else:
        print("No valid transactions to insert.")

if __name__ == "__main__":
    load_dotenv()
    migrate()
