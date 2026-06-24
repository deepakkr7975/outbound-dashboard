from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime
import uuid

def generate_uuid() -> str:
    return str(uuid.uuid4())

def current_time_iso() -> str:
    return datetime.utcnow().isoformat() + "Z"

# Users
class User(BaseModel):
    id: str = Field(default_factory=generate_uuid)
    name: str
    email: EmailStr

# Email Accounts (SES Identities)
class EmailAccount(BaseModel):
    id: str = Field(default_factory=generate_uuid)
    user_id: str
    email: EmailStr
    status: str = "pending_verification"  # pending_verification, verified
    refresh_token: Optional[str] = None
    access_token: Optional[str] = None
    is_active: bool = True
    daily_limit: int = 30
    sent_today: int = 0
    last_used_at: Optional[str] = None
    created_at: str = Field(default_factory=current_time_iso)

# Leads
class Lead(BaseModel):
    id: str = Field(default_factory=generate_uuid)
    name: str
    email: EmailStr
    company: str
    created_at: str = Field(default_factory=current_time_iso)

# Scheduled Emails
class ScheduledEmail(BaseModel):
    id: str = Field(default_factory=generate_uuid)
    lead_id: str
    account_id: str
    subject: str
    body: str
    send_at: str  # ISO string
    status: str = "pending"  # pending, sent, failed
    created_at: str = Field(default_factory=current_time_iso)

# Request/Response schemas
class ConnectEmailRequest(BaseModel):
    email: EmailStr

class ScheduleEmailRequest(BaseModel):
    subject_template: str
    body_template: str
    lead_ids: List[str]
    send_at: datetime
    account_id: str

class TestEmailRequest(BaseModel):
    to_email: EmailStr
    subject: str
    body: str
    account_id: str

class BulkScheduleRequest(BaseModel):
    account_id: str
    lead_ids: List[str]
    subject: str
    body: str
    send_at: datetime

class BulkScheduleFilterRequest(BaseModel):
    account_id: str
    subject: str
    body: str
    send_at: datetime
    filters: dict

class UpdateLimitRequest(BaseModel):
    daily_limit: int = Field(..., ge=0)

class UpdateActiveRequest(BaseModel):
    is_active: bool

class EmailLog(BaseModel):
    email_id: str
    lead_id: str
    sender_account_id: str
    sender_email: str
    sent_at: str
    status: str

