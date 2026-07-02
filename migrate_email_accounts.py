import os
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from app.repositories import dynamodb_repo
from app.api.routes import extract_domain_info

def migrate_accounts():
    accounts = dynamodb_repo.scan_table("email_accounts")
    migrated_count = 0
    for account in accounts:
        if not account.get("domain") or not account.get("domain_name"):
            email = account.get("email")
            if email:
                domain, domain_name = extract_domain_info(email)
                account["domain"] = domain
                account["domain_name"] = domain_name
                dynamodb_repo.put_item("email_accounts", account)
                print(f"Migrated {email} -> {domain} | {domain_name}")
                migrated_count += 1
            else:
                print(f"Warning: Account {account.get('id')} has no email.")
    print(f"Migration completed. Total migrated: {migrated_count}")

if __name__ == "__main__":
    migrate_accounts()
