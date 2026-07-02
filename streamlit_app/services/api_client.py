import requests
from typing import List, Dict, Any, Optional
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import API_BASE_URL

class APIClient:

    # ── Email Accounts (Sender Emails) ───────────────────────────────────

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
    def delete_email_account(account_id: str) -> Dict[str, Any]:
        try:
            response = requests.delete(f"{API_BASE_URL}/email-accounts/{account_id}", timeout=10)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            try:
                return {"error": e.response.json().get("detail", str(e))}
            except Exception:
                return {"error": str(e)}

    @staticmethod
    def update_email_account(account_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        try:
            response = requests.patch(f"{API_BASE_URL}/email-accounts/{account_id}", json=data, timeout=10)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            try:
                return {"error": e.response.json().get("detail", str(e))}
            except Exception:
                return {"error": str(e)}

    @staticmethod
    def update_signature(account_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        try:
            response = requests.patch(f"{API_BASE_URL}/email-accounts/{account_id}/signature", json=data, timeout=10)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            return {"error": str(e)}

    @staticmethod
    def get_linked_campaigns(account_id: str) -> Dict[str, Any]:
        try:
            response = requests.get(f"{API_BASE_URL}/email-accounts/{account_id}/linked-campaigns", timeout=10)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            return {"linked_campaigns": [], "count": 0}

    # ── Leads ────────────────────────────────────────────────────────────

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

    # ── Audiences ────────────────────────────────────────────────────────

    @staticmethod
    def create_audience(data: Dict[str, Any]) -> Dict[str, Any]:
        try:
            response = requests.post(f"{API_BASE_URL}/audiences", json=data, timeout=10)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            try:
                return {"error": e.response.json().get("detail", str(e))}
            except Exception:
                return {"error": str(e)}

    @staticmethod
    def get_audiences() -> List[Dict[str, Any]]:
        try:
            response = requests.get(f"{API_BASE_URL}/audiences", timeout=10)
            response.raise_for_status()
            return response.json().get("audiences", [])
        except requests.exceptions.RequestException as e:
            return []

    @staticmethod
    def get_audience(audience_id: str) -> Dict[str, Any]:
        try:
            response = requests.get(f"{API_BASE_URL}/audiences/{audience_id}", timeout=10)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            return {}

    @staticmethod
    def update_audience(audience_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        try:
            response = requests.put(f"{API_BASE_URL}/audiences/{audience_id}", json=data, timeout=10)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            try:
                return {"error": e.response.json().get("detail", str(e))}
            except Exception:
                return {"error": str(e)}

    @staticmethod
    def delete_audience(audience_id: str) -> Dict[str, Any]:
        try:
            response = requests.delete(f"{API_BASE_URL}/audiences/{audience_id}", timeout=10)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            try:
                return {"error": e.response.json().get("detail", str(e))}
            except Exception:
                return {"error": str(e)}

    @staticmethod
    def remove_audience_members(audience_id: str, lead_ids: List[str]) -> Dict[str, Any]:
        try:
            response = requests.post(
                f"{API_BASE_URL}/audiences/{audience_id}/members/remove",
                json={"lead_ids": lead_ids}, timeout=10
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            return {"error": str(e)}

    # ── Sequences ────────────────────────────────────────────────────────

    @staticmethod
    def create_sequence(data: Dict[str, Any]) -> Dict[str, Any]:
        try:
            response = requests.post(f"{API_BASE_URL}/sequences", json=data, timeout=10)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            try:
                return {"error": e.response.json().get("detail", str(e))}
            except Exception:
                return {"error": str(e)}

    @staticmethod
    def get_sequences(name: str = None, is_scheduled: bool = None, is_completed: bool = None) -> List[Dict[str, Any]]:
        try:
            params = {}
            if name:
                params["name"] = name
            if is_scheduled is not None:
                params["is_scheduled"] = str(is_scheduled).lower()
            if is_completed is not None:
                params["is_completed"] = str(is_completed).lower()
            response = requests.get(f"{API_BASE_URL}/sequences", params=params, timeout=10)
            response.raise_for_status()
            return response.json().get("sequences", [])
        except requests.exceptions.RequestException as e:
            return []

    @staticmethod
    def get_sequence(sequence_id: str) -> Dict[str, Any]:
        try:
            response = requests.get(f"{API_BASE_URL}/sequences/{sequence_id}", timeout=10)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            return {}

    @staticmethod
    def update_sequence(sequence_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        try:
            response = requests.put(f"{API_BASE_URL}/sequences/{sequence_id}", json=data, timeout=10)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            return {"error": str(e)}

    @staticmethod
    def delete_sequence(sequence_id: str) -> Dict[str, Any]:
        try:
            response = requests.delete(f"{API_BASE_URL}/sequences/{sequence_id}", timeout=10)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            try:
                return {"error": e.response.json().get("detail", str(e))}
            except Exception:
                return {"error": str(e)}

    @staticmethod
    def add_step(sequence_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        try:
            response = requests.post(f"{API_BASE_URL}/sequences/{sequence_id}/steps", json=data, timeout=10)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            try:
                return {"error": e.response.json().get("detail", str(e))}
            except Exception:
                return {"error": str(e)}

    @staticmethod
    def update_step(sequence_id: str, step_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        try:
            response = requests.put(f"{API_BASE_URL}/sequences/{sequence_id}/steps/{step_id}", json=data, timeout=10)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            return {"error": str(e)}

    @staticmethod
    def delete_step(sequence_id: str, step_id: str) -> Dict[str, Any]:
        try:
            response = requests.delete(f"{API_BASE_URL}/sequences/{sequence_id}/steps/{step_id}", timeout=10)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            try:
                return {"error": e.response.json().get("detail", str(e))}
            except Exception:
                return {"error": str(e)}

    @staticmethod
    def reorder_steps(sequence_id: str, step_ids: List[str]) -> Dict[str, Any]:
        try:
            response = requests.put(
                f"{API_BASE_URL}/sequences/{sequence_id}/steps/reorder",
                json={"step_ids": step_ids}, timeout=10
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            return {"error": str(e)}

    # ── Campaigns ────────────────────────────────────────────────────────

    @staticmethod
    def create_campaign(data: Dict[str, Any]) -> Dict[str, Any]:
        try:
            response = requests.post(f"{API_BASE_URL}/campaigns", json=data, timeout=30)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            try:
                return {"error": e.response.json().get("detail", str(e))}
            except Exception:
                return {"error": str(e)}

    @staticmethod
    def get_campaigns(name: str = None, status: str = None, sequence_id: str = None) -> List[Dict[str, Any]]:
        try:
            params = {}
            if name:
                params["name"] = name
            if status:
                params["status"] = status
            if sequence_id:
                params["sequence_id"] = sequence_id
            response = requests.get(f"{API_BASE_URL}/campaigns", params=params, timeout=10)
            response.raise_for_status()
            return response.json().get("campaigns", [])
        except requests.exceptions.RequestException as e:
            return []

    @staticmethod
    def get_campaign(campaign_id: str) -> Dict[str, Any]:
        try:
            response = requests.get(f"{API_BASE_URL}/campaigns/{campaign_id}", timeout=10)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            return {}

    @staticmethod
    def update_campaign(campaign_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        try:
            response = requests.put(f"{API_BASE_URL}/campaigns/{campaign_id}", json=data, timeout=10)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            try:
                return {"error": e.response.json().get("detail", str(e))}
            except Exception:
                return {"error": str(e)}

    @staticmethod
    def delete_campaign(campaign_id: str) -> Dict[str, Any]:
        try:
            response = requests.delete(f"{API_BASE_URL}/campaigns/{campaign_id}", timeout=10)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            try:
                return {"error": e.response.json().get("detail", str(e))}
            except Exception:
                return {"error": str(e)}

    @staticmethod
    def pause_campaign(campaign_id: str) -> Dict[str, Any]:
        try:
            response = requests.post(f"{API_BASE_URL}/campaigns/{campaign_id}/pause", timeout=10)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            try:
                return {"error": e.response.json().get("detail", str(e))}
            except Exception:
                return {"error": str(e)}

    @staticmethod
    def resume_campaign(campaign_id: str) -> Dict[str, Any]:
        try:
            response = requests.post(f"{API_BASE_URL}/campaigns/{campaign_id}/resume", timeout=10)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            try:
                return {"error": e.response.json().get("detail", str(e))}
            except Exception:
                return {"error": str(e)}

    @staticmethod
    def cancel_campaign(campaign_id: str) -> Dict[str, Any]:
        try:
            response = requests.post(f"{API_BASE_URL}/campaigns/{campaign_id}/cancel", timeout=10)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            try:
                return {"error": e.response.json().get("detail", str(e))}
            except Exception:
                return {"error": str(e)}

    @staticmethod
    def get_campaign_emails(campaign_id: str) -> Dict[str, Any]:
        try:
            response = requests.get(f"{API_BASE_URL}/campaigns/{campaign_id}/emails", timeout=10)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            return {"emails": [], "total": 0}

    @staticmethod
    def get_linked_emails_summary() -> List[Dict[str, Any]]:
        try:
            response = requests.get(f"{API_BASE_URL}/campaigns/linked-emails", timeout=10)
            response.raise_for_status()
            return response.json().get("linked_emails", [])
        except requests.exceptions.RequestException as e:
            return []

    # ── Legacy (backward compatibility) ──────────────────────────────────

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
