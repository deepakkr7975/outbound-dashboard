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

class CampaignEmailStatus(str, Enum):
    PENDING = "pending"
    SENT = "sent"
    FAILED = "failed"


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
    created_at: str = Field(default_factory=current_time_iso)

# Scheduled Emails (legacy — kept for backward compatibility)
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
    lead_ids: List[str] = Field(default_factory=list)  # references to leads table
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

class CampaignEmail(BaseModel):
    id: str = Field(default_factory=generate_uuid)
    campaign_id: str
    lead_id: str
    step_order: int                      # Replacing sequence_step_id
    selected_variant: str = "a"          # "a" or "b"
    sender_email_id: Optional[str] = None  # assigned at send time by sender selection
    status: str = CampaignEmailStatus.PENDING
    scheduled_at: str                    # calculated from campaign.schedule_at + cumulative separation_days
    sent_at: Optional[str] = None
    created_at: str = Field(default_factory=current_time_iso)


# ── Request/Response Schemas ─────────────────────────────────────────────────

# Legacy request schemas (kept for backward compatibility)
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
class CreateAudienceRequest(BaseModel):
    name: str
    description: Optional[str] = None
    lead_ids: List[str] = Field(default_factory=list)

class UpdateAudienceRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    lead_ids: Optional[List[str]] = None  # if provided, replaces the full list

class RemoveMembersRequest(BaseModel):
    lead_ids: List[str]

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
