import os
import base64
from email.mime.text import MIMEText
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build

SCOPES = [
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/userinfo.email"
]

import urllib.parse
import requests

def get_authorization_url():
    client_id = os.getenv("GOOGLE_CLIENT_ID")
    redirect_uri = os.getenv("GOOGLE_REDIRECT_URI")
    scopes = " ".join(SCOPES)
    
    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": scopes,
        "access_type": "offline",
        "prompt": "consent"
    }
    return f"https://accounts.google.com/o/oauth2/v2/auth?{urllib.parse.urlencode(params)}"

def exchange_code(code: str):
    client_id = os.getenv("GOOGLE_CLIENT_ID")
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET")
    redirect_uri = os.getenv("GOOGLE_REDIRECT_URI")
    
    response = requests.post("https://oauth2.googleapis.com/token", data={
        "code": code,
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": redirect_uri,
        "grant_type": "authorization_code"
    })
    
    if not response.ok:
        raise Exception(f"OAuth token exchange failed: {response.text}")
        
    token_data = response.json()
    refresh_token = token_data.get("refresh_token")
    access_token = token_data.get("access_token")
    
    # Get user email
    creds = Credentials(token=access_token)
    service = build("gmail", "v1", credentials=creds)
    profile = service.users().getProfile(userId='me').execute()
    email_address = profile.get('emailAddress')
    
    return {
        "refresh_token": refresh_token,
        "email": email_address,
        "access_token": access_token
    }

import re
from email.mime.multipart import MIMEMultipart

def send_email(to_email: str, subject: str, body: str, refresh_token: str):
    client_id = os.getenv("GOOGLE_CLIENT_ID")
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET")
    
    creds = Credentials(
        token=None,
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=client_id,
        client_secret=client_secret,
        scopes=SCOPES
    )
    
    service = build("gmail", "v1", credentials=creds)
    
    # Using MIMEMultipart alternative helps prevent spam classification
    message = MIMEMultipart('alternative')
    message["to"] = to_email
    message["subject"] = subject
    
    # Strip basic HTML to create a plain text version
    plain_text = re.sub(r'<[^>]+>', '', body)
    
    part1 = MIMEText(plain_text, "plain")
    part2 = MIMEText(body, "html")
    
    message.attach(part1)
    message.attach(part2)
    
    raw = base64.urlsafe_b64encode(message.as_bytes()).decode()
    
    service.users().messages().send(
        userId="me",
        body={"raw": raw}
    ).execute()
