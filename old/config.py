import boto3
import os
from dotenv import load_dotenv

load_dotenv(override=True)

AWS_REGION = os.getenv("AWS_REGION") or os.getenv("AWS_DEFAULT_REGION")
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")

# SES Client - REMOVED

# DynamoDB resource
dynamodb = boto3.resource(
    "dynamodb",
    region_name=AWS_REGION,
    aws_access_key_id=AWS_ACCESS_KEY_ID,
    aws_secret_access_key=AWS_SECRET_ACCESS_KEY
)

# Tables from .env
templates_table = dynamodb.Table(os.getenv("EMAIL_TEMPLATES_TABLE"))
sender_table = dynamodb.Table(os.getenv("SENDER_LIST_TABLE"))
schedule_table = dynamodb.Table(os.getenv("EMAIL_SCHEDULE_TABLE"))
logs_table = dynamodb.Table(os.getenv("EMAIL_LOGS_TABLE"))
contact_lists_table = dynamodb.Table(os.getenv("CONTACTS_TABLE"))
contacts_table = dynamodb.Table(os.getenv("CONTACTS_TABLE"))
warmup_table = dynamodb.Table(os.getenv("WARMUP_CONFIG_TABLE"))
bulk_users_table = dynamodb.Table(os.getenv("BULK_USERS_TABLE"))
workspace_domains_table = dynamodb.Table(os.getenv("WORKSPACE_DOMAINS_TABLE"))

DEFAULT_SENDER = os.getenv("DEFAULT_SENDER")

# Google OAuth
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
GOOGLE_ACCESS_TOKEN = os.getenv("GOOGLE_ACCESS_TOKEN")
GOOGLE_REFRESH_TOKEN = os.getenv("GOOGLE_REFRESH_TOKEN")
