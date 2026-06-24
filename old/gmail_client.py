from typing import List, Dict, Optional
import os
import base64
from email.mime.text import MIMEText
from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials

SCOPES = [
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.readonly"
]

def get_gmail_service():
    creds = Credentials(
        token=os.getenv("GOOGLE_ACCESS_TOKEN"),
        refresh_token=os.getenv("GOOGLE_REFRESH_TOKEN"),
        token_uri="https://oauth2.googleapis.com/token",
        client_id=os.getenv("GOOGLE_CLIENT_ID"),
        client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
        scopes=SCOPES,
    )
    return build("gmail", "v1", credentials=creds)

def send_gmail(sender, to, subject, html_body):
    service = get_gmail_service()

    message = MIMEText(html_body, "html")
    message["to"] = to
    message["from"] = sender
    message["subject"] = subject

    raw = base64.urlsafe_b64encode(message.as_bytes()).decode()

    return service.users().messages().send(
        userId="me",
        body={"raw": raw}
    ).execute()

def fetch_emails(query: str = "", max_results: int = 50) -> List[Dict]:
    """
    Fetch emails from Gmail matching the query.
    """
    service = get_gmail_service()
    
    # List messages
    results = service.users().messages().list(userId='me', q=query, maxResults=max_results).execute()
    messages = results.get('messages', [])
    
    email_list = []
    if not messages:
        return []

    # Batch get details would be better but simple loop for now
    for msg in messages:
        try:
            msg_detail = service.users().messages().get(userId='me', id=msg['id'], format='full').execute()
            payload = msg_detail.get('payload', {})
            headers = payload.get('headers', [])
            
            subject = next((h['value'] for h in headers if h['name'] == 'Subject'), "(No Subject)")
            sender = next((h['value'] for h in headers if h['name'] == 'From'), "(Unknown)")
            receiver = next((h['value'] for h in headers if h['name'] == 'To'), "(Unknown)")
            date = next((h['value'] for h in headers if h['name'] == 'Date'), "")
            snippet = msg_detail.get('snippet', '')
            
            email_list.append({
                "id": msg['id'],
                "subject": subject,
                "sender": sender,
                "receiver": receiver,
                "date": date,
                "snippet": snippet
            })
        except Exception as e:
            print(f"Error fetching message {msg['id']}: {e}")
            continue
            
    return email_list
