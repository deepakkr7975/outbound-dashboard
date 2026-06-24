import requests
from typing import List, Dict, Any, Optional
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import API_BASE_URL

class APIClient:
    @staticmethod
    def get_email_accounts() -> List[Dict[str, Any]]:
        try:
            response = requests.get(f"{API_BASE_URL}/email-accounts", timeout=10)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Error fetching email accounts: {e}")
            return []

    @staticmethod
    def connect_email() -> Optional[str]:
        try:
            response = requests.get(f"{API_BASE_URL}/email-accounts/connect", timeout=10)
            response.raise_for_status()
            return response.json().get("authorization_url")
        except requests.exceptions.RequestException as e:
            print(f"Error fetching authorization URL: {e}")
            return None

    @staticmethod
    def get_leads(limit: int = 1000) -> List[Dict[str, Any]]:
        try:
            response = requests.get(f"{API_BASE_URL}/leads", params={"limit": limit}, timeout=10)
            response.raise_for_status()
            return response.json().get("leads", [])
        except requests.exceptions.RequestException as e:
            print(f"Error fetching leads: {e}")
            return []

    @staticmethod
    def upload_leads(file_content: bytes, filename: str) -> Dict[str, Any]:
        try:
            files = {"file": (filename, file_content, "text/csv")}
            response = requests.post(f"{API_BASE_URL}/leads/upload", files=files, timeout=30)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Error uploading leads: {e}")
            return {"error": str(e)}

    @staticmethod
    def bulk_schedule(account_id: str, lead_ids: List[str], subject: str, body: str, send_at: str) -> Dict[str, Any]:
        try:
            payload = {
                "account_id": account_id,
                "lead_ids": lead_ids,
                "subject": subject,
                "body": body,
                "send_at": send_at
            }
            response = requests.post(f"{API_BASE_URL}/emails/bulk-schedule", json=payload, timeout=30)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Error scheduling emails: {e}")
            # Try to parse FastAPI error detail
            try:
                error_detail = e.response.json().get("detail", str(e))
                return {"error": error_detail}
            except Exception:
                return {"error": str(e)}

    @staticmethod
    def get_scheduled_emails() -> List[Dict[str, Any]]:
        try:
            response = requests.get(f"{API_BASE_URL}/emails/scheduled", timeout=10)
            response.raise_for_status()
            return response.json().get("scheduled_emails", [])
        except requests.exceptions.RequestException as e:
            print(f"Error fetching scheduled emails: {e}")
            return []
