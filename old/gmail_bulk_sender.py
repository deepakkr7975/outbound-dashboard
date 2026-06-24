import time
from gmail_client import send_gmail

def send_bulk_gmail(
    sender: str,
    subject: str,
    html_body: str,
    recipients: list,
    batch_size: int = 20,
    delay_seconds: int = 1
):
    """
    Gmail-safe bulk sender
    """

    results = []

    for i in range(0, len(recipients), batch_size):
        batch = recipients[i:i + batch_size]

        for email in batch:
            try:
                response = send_gmail(
                    sender=sender,
                    to=email,
                    subject=subject,
                    html_body=html_body
                )
                results.append({
                    "receiver": email,
                    "status": "sent",
                    "message_id": response.get("id")
                })
            except Exception as e:
                results.append({
                    "receiver": email,
                    "status": "failed",
                    "error": str(e)
                })

        # 🚨 CRITICAL: rate limiting
        time.sleep(delay_seconds)

    return results
