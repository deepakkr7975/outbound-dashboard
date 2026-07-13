import os
from .connection import dynamodb, dynamodb_client

def create_table_if_not_exists(table_name, key_schema, attribute_definitions, global_secondary_indexes=None):
    try:
        kwargs = {
            "TableName": table_name,
            "KeySchema": key_schema,
            "AttributeDefinitions": attribute_definitions,
            "BillingMode": "PAY_PER_REQUEST",
        }
        if global_secondary_indexes:
            kwargs["GlobalSecondaryIndexes"] = global_secondary_indexes

        table = dynamodb.create_table(**kwargs)
        print(f"Creating table {table_name}...")
        table.wait_until_exists()
        print(f"Table {table_name} created successfully!")
    except dynamodb_client.exceptions.ResourceInUseException:
        print(f"Table {table_name} already exists.")
    except Exception as e:
        print(f"Error creating {table_name}: {e}")

def ensure_gsi_exists(table_name, index_name, key_schema, attribute_definitions):
    """
    Add a GSI to an existing table if it isn't already present.
    Needed because create_table_if_not_exists skips tables that already exist.
    """
    try:
        description = dynamodb_client.describe_table(TableName=table_name)["Table"]
        existing = [gsi["IndexName"] for gsi in description.get("GlobalSecondaryIndexes", [])]
        if index_name in existing:
            return
        print(f"Adding GSI {index_name} to {table_name}...")
        dynamodb_client.update_table(
            TableName=table_name,
            AttributeDefinitions=attribute_definitions,
            GlobalSecondaryIndexUpdates=[
                {
                    "Create": {
                        "IndexName": index_name,
                        "KeySchema": key_schema,
                        "Projection": {"ProjectionType": "ALL"}
                    }
                }
            ]
        )
        print(f"GSI {index_name} creation started (backfills in background).")
    except Exception as e:
        print(f"Error ensuring GSI {index_name} on {table_name}: {e}")

def init_tables():
    users_table = os.getenv("USERS_TABLE", "users")
    email_accounts_table = os.getenv("EMAIL_ACCOUNTS_TABLE", "email_accounts")
    leads_table = os.getenv("LEADS_TABLE", "leads")
    scheduled_emails_table = os.getenv("SCHEDULED_EMAILS_TABLE", "scheduled_emails")
    email_logs_table = os.getenv("EMAIL_LOGS_TABLE", "email_logs")
    audiences_table = os.getenv("AUDIENCES_TABLE", "audiences")
    sequences_table = os.getenv("SEQUENCES_TABLE", "sequences")
    sequence_steps_table = os.getenv("SEQUENCE_STEPS_TABLE", "sequence_steps")
    campaigns_table = os.getenv("CAMPAIGNS_TABLE", "campaigns")
    email_transactions_table = os.getenv("EMAIL_TRANSACTIONS_TABLE", "email_transactions")
    email_events_table = os.getenv("EMAIL_EVENTS_TABLE", "email_events")

    # 1. users
    create_table_if_not_exists(
        users_table,
        [{"AttributeName": "id", "KeyType": "HASH"}],
        [{"AttributeName": "id", "AttributeType": "S"}]
    )

    # 2. email_accounts
    create_table_if_not_exists(
        email_accounts_table,
        [{"AttributeName": "id", "KeyType": "HASH"}],
        [{"AttributeName": "id", "AttributeType": "S"}]
    )

    # 3. leads
    create_table_if_not_exists(
        leads_table,
        [{"AttributeName": "id", "KeyType": "HASH"}],
        [{"AttributeName": "id", "AttributeType": "S"}]
    )

    # 4. scheduled_emails (direct /emails/* scheduling — with GSI for polling)
    create_table_if_not_exists(
        scheduled_emails_table,
        [{"AttributeName": "id", "KeyType": "HASH"}],
        [
            {"AttributeName": "id", "AttributeType": "S"},
            {"AttributeName": "status", "AttributeType": "S"},
            {"AttributeName": "send_at", "AttributeType": "S"},
        ],
        global_secondary_indexes=[
            {
                "IndexName": "status-send_at-index",
                "KeySchema": [
                    {"AttributeName": "status", "KeyType": "HASH"},
                    {"AttributeName": "send_at", "KeyType": "RANGE"}
                ],
                "Projection": {"ProjectionType": "ALL"}
            }
        ]
    )

    # 5. email_logs
    create_table_if_not_exists(
        email_logs_table,
        [{"AttributeName": "email_id", "KeyType": "HASH"}],
        [{"AttributeName": "email_id", "AttributeType": "S"}]
    )

    # 6. audiences
    create_table_if_not_exists(
        audiences_table,
        [{"AttributeName": "id", "KeyType": "HASH"}],
        [{"AttributeName": "id", "AttributeType": "S"}]
    )

    # 7. sequences
    create_table_if_not_exists(
        sequences_table,
        [{"AttributeName": "sequence_id", "KeyType": "HASH"}],
        [{"AttributeName": "sequence_id", "AttributeType": "S"}]
    )

    # 9. campaigns (with GSI for scheduler to poll by status + schedule_at)
    create_table_if_not_exists(
        campaigns_table,
        [{"AttributeName": "id", "KeyType": "HASH"}],
        [
            {"AttributeName": "id", "AttributeType": "S"},
            {"AttributeName": "status", "AttributeType": "S"},
            {"AttributeName": "schedule_at", "AttributeType": "S"},
        ],
        global_secondary_indexes=[
            {
                "IndexName": "status-schedule_at-index",
                "KeySchema": [
                    {"AttributeName": "status", "KeyType": "HASH"},
                    {"AttributeName": "schedule_at", "KeyType": "RANGE"}
                ],
                "Projection": {"ProjectionType": "ALL"}
            }
        ]
    )

    # 10. email_transactions (with GSI for scheduler polling)
    create_table_if_not_exists(
        email_transactions_table,
        [
            {"AttributeName": "PK", "KeyType": "HASH"},
            {"AttributeName": "SK", "KeyType": "RANGE"}
        ],
        [
            {"AttributeName": "PK", "AttributeType": "S"},
            {"AttributeName": "SK", "AttributeType": "S"},
            {"AttributeName": "status", "AttributeType": "S"},
            {"AttributeName": "scheduled_for", "AttributeType": "S"},
            {"AttributeName": "transaction_id", "AttributeType": "S"}
        ],
        global_secondary_indexes=[
            {
                "IndexName": "status-scheduled_for-index",
                "KeySchema": [
                    {"AttributeName": "status", "KeyType": "HASH"},
                    {"AttributeName": "scheduled_for", "KeyType": "RANGE"}
                ],
                "Projection": {"ProjectionType": "ALL"}
            },
            {
                "IndexName": "transaction_id-index",
                "KeySchema": [
                    {"AttributeName": "transaction_id", "KeyType": "HASH"}
                ],
                "Projection": {"ProjectionType": "ALL"}
            }
        ]
    )

    # 11. email_events (open/click tracking events, one row per pixel/link hit)
    create_table_if_not_exists(
        email_events_table,
        [
            {"AttributeName": "token", "KeyType": "HASH"},
            {"AttributeName": "event_id", "KeyType": "RANGE"}
        ],
        [
            {"AttributeName": "token", "AttributeType": "S"},
            {"AttributeName": "event_id", "AttributeType": "S"}
        ]
    )

    # Retrofit the transaction_id GSI onto tables created before it existed
    ensure_gsi_exists(
        email_transactions_table,
        "transaction_id-index",
        [{"AttributeName": "transaction_id", "KeyType": "HASH"}],
        [{"AttributeName": "transaction_id", "AttributeType": "S"}]
    )


if __name__ == "__main__":
    init_tables()
