import boto3
import os
from dotenv import load_dotenv
import time

load_dotenv(override=True)

AWS_REGION = os.getenv("AWS_REGION", "us-east-1")
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")

dynamodb = boto3.resource(
    "dynamodb",
    region_name=AWS_REGION,
    aws_access_key_id=AWS_ACCESS_KEY_ID,
    aws_secret_access_key=AWS_SECRET_ACCESS_KEY
)

def create_table(table_name, key_schema, attribute_definitions):
    try:
        table = dynamodb.create_table(
            TableName=table_name,
            KeySchema=key_schema,
            AttributeDefinitions=attribute_definitions,
            BillingMode='PAY_PER_REQUEST'
        )
        print(f"Creating table {table_name}...")
        table.wait_until_exists()
        print(f"Table {table_name} created successfully!")
    except Exception as e:
        if "ResourceInUseException" in str(e):
            print(f"Table {table_name} already exists.")
        else:
            print(f"Error creating {table_name}: {e}")

def main():
    create_table(
        os.getenv("CONTACT_LISTS_TABLE", "contact_lists"),
        [{"AttributeName": "list_id", "KeyType": "HASH"}],
        [{"AttributeName": "list_id", "AttributeType": "S"}]
    )

    # Contacts Table (list_id as PK, email as SK)
    create_table(
        os.getenv("CONTACTS_TABLE", "contacts"),
        [
            {"AttributeName": "list_id", "KeyType": "HASH"},
            {"AttributeName": "email", "KeyType": "RANGE"}
        ],
        [
            {"AttributeName": "list_id", "AttributeType": "S"},
            {"AttributeName": "email", "AttributeType": "S"}
        ]
    )

    # Warmup Config Table
    create_table(
        os.getenv("WARMUP_CONFIG_TABLE", "warmup_configs"),
        [{"AttributeName": "config_id", "KeyType": "HASH"}],
        [{"AttributeName": "config_id", "AttributeType": "S"}]
    )

    create_table(
        os.getenv("BULK_USERS_TABLE", "bulk_users"),
        [{"AttributeName": "email", "KeyType": "HASH"}],
        [{"AttributeName": "email", "AttributeType": "S"}],
    )

    create_table(
        os.getenv("WORKSPACE_DOMAINS_TABLE", "workspace_domains"),
        [{"AttributeName": "domain", "KeyType": "HASH"}],
        [{"AttributeName": "domain", "AttributeType": "S"}],
    )

if __name__ == "__main__":
    main()
