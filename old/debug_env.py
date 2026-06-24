import os
from dotenv import load_dotenv
import boto3

# 1. Force reload of .env
print("--- Loading .env ---")
load_dotenv(override=True)

# 2. Print loaded values (masked)
access_key = os.getenv("AWS_ACCESS_KEY_ID")
secret_key = os.getenv("AWS_SECRET_ACCESS_KEY")
region = os.getenv("AWS_REGION") or os.getenv("AWS_DEFAULT_REGION")

print(f"AWS_ACCESS_KEY_ID: '{access_key}'")
print(f"AWS_SECRET_ACCESS_KEY: '{secret_key[:5]}...'" if secret_key else "AWS_SECRET_ACCESS_KEY: None")
print(f"AWS_REGION: '{region}'")

# 3. Test Boto3 Connection
print("\n--- Testing Boto3 Connection ---")
try:
    ses = boto3.client(
        "ses",
        region_name=region,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key
    )
    # Try a lightweight call
    print("Calling SES get_send_quota...")
    response = ses.get_send_quota()
    print("SUCCESS: Connected to SES.")
    print(f"Max 24 Hour Send: {response.get('Max24HourSend')}")
except Exception as e:
    print(f"ERROR: {e}")
