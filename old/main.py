from typing import Optional, List
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
import uuid
import os
import requests
import io
import pandas as pd
import re
from dotenv import set_key
from boto3.dynamodb.conditions import Key, Attr

from config import templates_table, sender_table, schedule_table, logs_table, DEFAULT_SENDER, contact_lists_table, contacts_table, warmup_table
from gmail_client import send_gmail, fetch_emails, SCOPES
from create_bulk_user import router as bulk_user_router

app = FastAPI()
app.include_router(bulk_user_router)

# Request Models
class EmailRequest(BaseModel):
    receiver: EmailStr
    sender: EmailStr = DEFAULT_SENDER
    template_name: Optional[str] = Field(None, description="Name of the existing template to use")
    subject: Optional[str] = Field(None, description="Override subject (optional if template is used)")
    body: Optional[str] = Field(None, description="Override body (optional if template is used)")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "receiver": "user@example.com",
                    "template_name": "mobbin_weekly_update"
                }
            ]
        }
    }

class Template(BaseModel):
    name: str
    subject: str
    body: str

class ScheduleRequest(BaseModel):
    template_name: str
    receiver: EmailStr
    send_at: datetime


class ContactListModel(BaseModel):
    name: str
    description: Optional[str] = None

class ContactModel(BaseModel):
    email: EmailStr
    first_name: Optional[str] = None
    last_name: Optional[str] = None

class BulkContactsRequest(BaseModel):
    contacts: List[ContactModel]

class BulkEmailRequest(BaseModel):
    list_id: Optional[str] = None
    emails: Optional[List[EmailStr]] = None
    sender: EmailStr = DEFAULT_SENDER
    template_name: Optional[str] = None
    subject: Optional[str] = None
    body: Optional[str] = None

class WarmupRequest(BaseModel):
    target_domains: List[str]
    emails_per_day: int = 10



# 0️⃣ OAUTH LOGIN & CALLBACK
@app.get("/auth/login")
def login():
    client_id = os.getenv("GOOGLE_CLIENT_ID")
    redirect_uri = "http://127.0.0.1:8000/oauth/callback"
    scope = " ".join(SCOPES).replace(" ", "%20")
    auth_url = (
        f"https://accounts.google.com/o/oauth2/v2/auth?"
        f"client_id={client_id}&"
        f"redirect_uri={redirect_uri}&"
        f"response_type=code&"
        f"scope={scope}&"
        f"access_type=offline&"
        f"prompt=consent"
    )
    return {"auth_url": auth_url}

@app.get("/oauth/callback")
def oauth_callback(code: str):
    try:
        token_url = "https://oauth2.googleapis.com/token"
        data = {
            "client_id": os.getenv("GOOGLE_CLIENT_ID"),
            "client_secret": os.getenv("GOOGLE_CLIENT_SECRET"),
            "code": code,
            "grant_type": "authorization_code",
            "redirect_uri": "http://127.0.0.1:8000/oauth/callback"
        }
        
        print(f"Exchanging code for tokens... URL: {token_url}")
        response = requests.post(token_url, data=data)
        
        if response.status_code != 200:
            print(f"Error response from Google: {response.text}")
            return {"error": "Failed to retrieve token", "details": response.json()}
        
        tokens = response.json()
        access_token = tokens.get("access_token")
        refresh_token = tokens.get("refresh_token")
        
        print("Tokens received. Saving to .env...")
        
        # Update .env file
        dotenv_path = ".env"
        # Ensure path is absolute to avoid issues
        dotenv_path = os.path.abspath(dotenv_path)
        
        set_key(dotenv_path, "GOOGLE_ACCESS_TOKEN", access_token)
        if refresh_token:
            set_key(dotenv_path, "GOOGLE_REFRESH_TOKEN", refresh_token)
            
        # Update current environment variables for immediate use
        os.environ["GOOGLE_ACCESS_TOKEN"] = access_token
        if refresh_token:
            os.environ["GOOGLE_REFRESH_TOKEN"] = refresh_token
            
        return {"message": "Authentication successful! Tokens have been saved to .env. You can now close this window."}
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"error": "Internal Server Error in Callback", "details": str(e)}


# 1️⃣ SEND EMAIL
@app.post("/send-email")
def send_email(data: EmailRequest):
    # 1. Resolve Template if provided
    if data.template_name:
        template_item = templates_table.get_item(Key={"name": data.template_name}).get("Item")
        if not template_item:
            return {"error": f"Template '{data.template_name}' not found"}
        
        # Override/Set subject/body if not provided
        if not data.subject:
            data.subject = template_item["subject"]
        if not data.body:
            data.body = template_item["body"]

    # 2. Validation
    if not data.subject or not data.body:
         return {"error": "Subject and Body are required (either manually or via template)"}

    # 3. Send Email
    response = send_gmail(
        sender=data.sender,
        to=data.receiver,
        subject=data.subject,
        html_body=data.body
    )

    # 4. Log
    log_id = str(uuid.uuid4())
    logs_table.put_item(
        Item={
            "log_id": log_id,
            "sender": data.sender,
            "receiver": data.receiver,
            "subject": data.subject,
            "body": data.body,
            "template_name": data.template_name if data.template_name else "manual",
            "status": "sent",
            "message_id": response.get("id"),
            "timestamp": datetime.now().isoformat()
        }
    )

    return {"message": "Email sent successfully", "Gmail response": response, "log_id": log_id}


# 2️⃣ CREATE TEMPLATE
@app.post("/templates/create")
def create_template(template: Template):
    templates_table.put_item(Item=template.dict())
    return {"message": "Template stored successfully"}


# 3️⃣ LIST TEMPLATES
@app.get("/templates")
def list_templates():
    return {"templates": templates_table.scan().get("Items", [])}


# 4️⃣ UPDATE TEMPLATE
@app.put("/templates/update/{name}")
def update_template(name: str, data: Template):
    templates_table.update_item(
        Key={"name": name},
        UpdateExpression="SET subject=:s, body=:b",
        ExpressionAttributeValues={":s": data.subject, ":b": data.body},
    )
    return {"message": "Template updated successfully"}


# 5️⃣ SEND EMAIL USING TEMPLATE
@app.post("/send-template/{name}")
def send_template(name: str, receiver: EmailStr, sender: EmailStr = DEFAULT_SENDER):
    template = templates_table.get_item(Key={"name": name}).get("Item")
    if not template:
        return {"error": "Template not found!"}

    response = send_gmail(
        sender=sender,
        to=receiver,
        subject=template["subject"],
        html_body=template["body"]
    )
    
    # Log it
    log_id = str(uuid.uuid4())
    logs_table.put_item(
        Item={
            "log_id": log_id,
            "sender": sender,
            "receiver": receiver,
            "subject": template["subject"],
            "body": template["body"],
            "template_name": name,
            "status": "sent",
            "message_id": response.get("id"),
            "timestamp": datetime.now().isoformat()
        }
    )
    
    return {"message": "Email sent successfully", "Gmail response": response, "log_id": log_id}


# 6️⃣ FETCH EMAILS (Centralized Email Fetch)
@app.get("/emails/fetch")
def get_emails(
    filter_type: str = Query("all", enum=["all", "received", "send"]),
    max_results: int = 50
):
    query = ""
    if filter_type == "received":
        query = "label:INBOX"
    elif filter_type == "send":
        query = "label:SENT"
    
    emails = fetch_emails(query=query, max_results=max_results)
    return {"count": len(emails), "emails": emails}

# 7️⃣ UNIQUE CONTACTS
@app.get("/emails/unique-contacts")
def get_unique_contacts(
    type: str = Query("all", enum=["all", "received", "send"]),
    domain: Optional[str] = None
):
    query = ""
    if type == "received":
        query = "label:INBOX"
    elif type == "send":
        query = "label:SENT"
    
    # Fetch emails
    emails = fetch_emails(query=query, max_results=100)
    
    contacts = set()
    email_regex = re.compile(r'<([^>]+)>|(\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b)')

    def extract_email(text):
        match = email_regex.search(text)
        if match:
            return match.group(1) or match.group(2)
        return text

    for email in emails:
        # If type is received, we care about who sent it (Sender)
        # If type is send, we care about who received it (Receiver)
        if type == "received":
            contacts.add(email['sender'])
        elif type == "send":
            contacts.add(email['receiver'])
        else: # all
            contacts.add(email['sender'])
            contacts.add(email['receiver'])

    unique_contacts = []
    
    for contact in contacts:
        pure_email = extract_email(contact)
        
        if domain:
            if domain.lower() not in pure_email.lower():
                continue
        
        unique_contacts.append(pure_email)
    
    # Remove duplicates after extraction and sort
    final_contacts = sorted(list(set(unique_contacts)))
    
    return {"count": len(final_contacts), "contacts": final_contacts}


# 8️⃣ EXPORT DATA
@app.get("/backup/export")
def export_data(
    format: str = Query("csv", enum=["csv", "xlsx"]),
    domain: Optional[str] = None
):
    # Fetch all emails (limit to 100 for now)
    emails = fetch_emails(query="", max_results=100)
    
    # Filter by domain if provided
    if domain:
        filtered_emails = []
        for email in emails:
            # Check if sender or receiver matches domain
            if domain.lower() in email['sender'].lower() or domain.lower() in email['receiver'].lower():
                filtered_emails.append(email)
        emails = filtered_emails
        
    df = pd.DataFrame(emails)
    
    if format == "csv":
        stream = io.StringIO()
        df.to_csv(stream, index=False)
        response = StreamingResponse(iter([stream.getvalue()]), media_type="text/csv")
        response.headers["Content-Disposition"] = "attachment; filename=emails_export.csv"
        return response
        
    elif format == "xlsx":
        stream = io.BytesIO()
        df.to_excel(stream, index=False)
        stream.seek(0)
        response = StreamingResponse(stream, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        response.headers["Content-Disposition"] = "attachment; filename=emails_export.xlsx"
        return response
