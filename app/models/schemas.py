from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional, List
from datetime import datetime
from enum import Enum
import uuid

def generate_uuid() -> str:
    return str(uuid.uuid4())

def current_time_iso() -> str:
    return datetime.utcnow().isoformat() + "Z"


# ── Enums ────────────────────────────────────────────────────────────────────

class CampaignStatus(str, Enum):
    DRAFT = "draft"
    SCHEDULED = "scheduled"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    FAILED = "failed"

class EmailTransactionStatus(str, Enum):
    QUEUED = "queued"
    SENDING = "sending"      # claimed by a scheduler cycle, dispatch in flight
    SENT = "sent"
    DELIVERED = "delivered"
    OPENED = "opened"
    CLICKED = "clicked"
    REPLIED = "replied"
    BOUNCED = "bounced"
    FAILED = "failed"
    CANCELLED = "cancelled"
    UNSUBSCRIBED = "unsubscribed"


# ── Existing Entities ────────────────────────────────────────────────────────

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
    # Signature fields
    signature_name: Optional[str] = None
    signature_title: Optional[str] = None       # job title
    signature_company: Optional[str] = None
    signature_phone: Optional[str] = None
    signature_html: Optional[str] = None        # full custom HTML override
    
    # Domain fields
    domain: Optional[str] = None
    domain_name: Optional[str] = None
    
    created_at: str = Field(default_factory=current_time_iso)

# Leads
class Lead(BaseModel):
    # Allow extra CSV columns (e.g. phone, role, title) to pass through
    # so they are stored in DynamoDB and available for mail-merge at send time.
    model_config = ConfigDict(extra='allow')

    id: str = Field(default_factory=generate_uuid)
    name: str
    email: EmailStr
    company: str
    tags: List[str] = Field(default_factory=list)
    created_at: str = Field(default_factory=current_time_iso)

# Scheduled Emails (direct /emails/* scheduling flow, separate from campaigns)
class ScheduledEmail(BaseModel):
    id: str = Field(default_factory=generate_uuid)
    lead_id: str
    account_id: str
    subject: str
    body: str
    send_at: str  # ISO string
    status: str = "pending"  # pending, sent, failed
    created_at: str = Field(default_factory=current_time_iso)


# ── New Entities ─────────────────────────────────────────────────────────────

class Audience(BaseModel):
    id: str = Field(default_factory=generate_uuid)
    name: str
    description: Optional[str] = None
    file_name: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    lead_ids: List[str] = Field(default_factory=list)
    num_leads: int = 0
    created_at: str = Field(default_factory=current_time_iso)
    updated_at: str = Field(default_factory=current_time_iso)

class Variant(BaseModel):
    title: str
    body: str

class VariantsMap(BaseModel):
    a: Variant
    b: Optional[Variant] = None

class SequenceStepData(BaseModel):
    step_order: int
    wait_days: int = 0
    variants: VariantsMap

class Sequence(BaseModel):
    sequence_id: str = Field(default_factory=generate_uuid)
    name: str
    description: Optional[str] = None
    total_steps: int = 0
    has_ab_testing: bool = False
    created_at: str = Field(default_factory=current_time_iso)
    updated_at: str = Field(default_factory=current_time_iso)
    steps: List[SequenceStepData] = Field(default_factory=list)

class Campaign(BaseModel):
    id: str = Field(default_factory=generate_uuid)
    name: str
    description: Optional[str] = None
    sender_email_ids: List[str] = Field(default_factory=list)  # future: sender_pool_id
    sequence_id: str
    audience_id: str
    schedule_at: str                     # ISO datetime — when step 1 starts
    status: str = CampaignStatus.DRAFT
    current_step_order: int = 0          # tracks which step is active (0 = not started)
    created_at: str = Field(default_factory=current_time_iso)
    updated_at: str = Field(default_factory=current_time_iso)

class EmailTransaction(BaseModel):
    PK: str                              # CAMPAIGN#{campaign_id}
    SK: str                              # MSG#{lead_id}#{step_order}
    transaction_id: str                  # ULID
    campaign_id: str
    sequence_id: str
    step_order: int
    lead_id: str                         # internal Lead ID
    sender_email_id: Optional[str] = None
    audience_id: Optional[str] = None
    variant: str = "a"
    
    subject_line: Optional[str] = None
    template_version: Optional[str] = None
    
    status: str = EmailTransactionStatus.QUEUED
    
    created_at: str = Field(default_factory=current_time_iso)
    scheduled_for: str                   # derived from wait_days
    sent_at: Optional[str] = None
    delivered_at: Optional[str] = None
    opened_at: Optional[str] = None
    clicked_at: Optional[str] = None
    replied_at: Optional[str] = None
    bounced_at: Optional[str] = None
    failed_at: Optional[str] = None
    
    open_count: int = 0
    click_count: int = 0
    
    provider: Optional[str] = None
    provider_message_id: Optional[str] = None
    bounce_type: Optional[str] = None
    error_message: Optional[str] = None


# ── Request/Response Schemas ─────────────────────────────────────────────────

# Direct-scheduling request schemas (/emails/* endpoints)
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

# ── New Request Schemas ──────────────────────────────────────────────────────

# Sender Email
class UpdateSignatureRequest(BaseModel):
    signature_name: Optional[str] = None
    signature_title: Optional[str] = None
    signature_company: Optional[str] = None
    signature_phone: Optional[str] = None
    signature_html: Optional[str] = None

class UpdateEmailAccountRequest(BaseModel):
    domain_name: Optional[str] = None

# Audience
class UpdateAudienceRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    tags: Optional[List[str]] = None

# Sequence
class CreateSequenceRequest(BaseModel):
    name: str
    description: Optional[str] = None
    total_steps: int = 0
    has_ab_testing: bool = False
    steps: List[SequenceStepData] = Field(default_factory=list)

class UpdateSequenceRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    total_steps: Optional[int] = None
    has_ab_testing: Optional[bool] = None
    steps: Optional[List[SequenceStepData]] = None

# Campaign
class CreateCampaignRequest(BaseModel):
    name: str
    description: Optional[str] = None
    sender_email_ids: List[str]
    sequence_id: str
    audience_id: str
    schedule_at: datetime

class UpdateCampaignRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    sender_email_ids: Optional[List[str]] = None
    sequence_id: Optional[str] = None
    audience_id: Optional[str] = None
    schedule_at: Optional[datetime] = None

# Transaction
class UpdateTransactionRequest(BaseModel):
    status: EmailTransactionStatus
    provider: Optional[str] = None
    provider_message_id: Optional[str] = None
    sender_email_id: Optional[str] = None
    bounce_type: Optional[str] = None
    error_message: Optional[str] = None
