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

def init_tables():
    users_table = os.getenv("USERS_TABLE", "users")
    email_accounts_table = os.getenv("EMAIL_ACCOUNTS_TABLE", "email_accounts")
    leads_table = os.getenv("LEADS_TABLE", "leads")
    scheduled_emails_table = os.getenv("SCHEDULED_EMAILS_TABLE", "scheduled_emails")
    email_logs_table = os.getenv("EMAIL_LOGS_TABLE", "email_logs")

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

    # 4. scheduled_emails (with GSI for polling)
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


if __name__ == "__main__":
    init_tables()
