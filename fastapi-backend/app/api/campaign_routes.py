from fastapi import APIRouter, HTTPException
from datetime import timezone

from app.models.schemas import (
    Campaign, CampaignStatus, EmailTransactionStatus,
    CreateCampaignRequest, UpdateCampaignRequest, current_time_iso
)
from app.repositories import dynamodb_repo
from app.services.campaign_service import CampaignService
from app.services.transaction_service import TransactionService

router = APIRouter(prefix="/campaigns", tags=["Campaigns"])


@router.post("")
async def create_campaign(request: CreateCampaignRequest):
    # Validate sender email IDs
    for sender_id in request.sender_email_ids:
        account = dynamodb_repo.get_item("email_accounts", {"id": sender_id})
        if not account:
            raise HTTPException(status_code=400, detail=f"Sender email account not found: {sender_id}")
        if not account.get("is_active", True):
            raise HTTPException(status_code=400, detail=f"Sender account is inactive: {account.get('email')}")

    # Validate sequence
    sequence = dynamodb_repo.get_item("sequences", {"sequence_id": request.sequence_id})
    if not sequence:
        raise HTTPException(status_code=400, detail=f"Sequence not found: {request.sequence_id}")

    # Validate audience
    audience = dynamodb_repo.get_item("audiences", {"id": request.audience_id})
    if not audience:
        raise HTTPException(status_code=400, detail=f"Audience not found: {request.audience_id}")

    if not audience.get("lead_ids"):
        raise HTTPException(status_code=400, detail="Audience has no leads")

    # Build campaign
    campaign = Campaign(
        name=request.name,
        description=request.description,
        sender_email_ids=request.sender_email_ids,
        sequence_id=request.sequence_id,
        audience_id=request.audience_id,
        schedule_at=request.schedule_at.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    )

    # Delegate to service — saves campaign + generates step 1 emails
    result = CampaignService.create_campaign(campaign.model_dump())

    return {
        "message": "Campaign created and Step 1 transactions generated",
        "campaign_id": result["id"],
        "status": result["status"]
    }


@router.get("")
async def list_campaigns(
    name: str = None,
    status: str = None,
    sequence_id: str = None
):
    campaigns = dynamodb_repo.scan_table("campaigns")

    result = []
    stats_caches = {}  # shared across the loop: sequence/audience lookups memoized
    for camp in campaigns:
        # Name filter (substring)
        if name and name.lower() not in camp.get("name", "").lower():
            continue
        # Status filter
        if status and camp.get("status") != status:
            continue
        # Sequence filter
        if sequence_id and camp.get("sequence_id") != sequence_id:
            continue

        # Get quick stats
        stats = TransactionService.get_campaign_stats(camp["id"], campaign=camp, caches=stats_caches)

        result.append({
            "id": camp.get("id"),
            "name": camp.get("name"),
            "description": camp.get("description"),
            "status": camp.get("status"),
            "schedule_at": camp.get("schedule_at"),
            "current_step_order": camp.get("current_step_order", 0),
            "total_steps": stats.get("total_steps", 0),
            "sent": stats.get("sent", 0),
            "queued": stats.get("queued", 0),
            "failed": stats.get("failed", 0),
            "completion_percentage": stats.get("completion_percentage", 0),
            "created_at": camp.get("created_at"),
        })

    return {"campaigns": result}


@router.get("/linked-emails")
async def get_linked_emails_summary():
    """Aggregated view: all campaigns with their email counts."""
    campaigns = dynamodb_repo.scan_table("campaigns")
    result = []
    stats_caches = {}
    for camp in campaigns:
        stats = TransactionService.get_campaign_stats(camp["id"], campaign=camp, caches=stats_caches)
        result.append({
            "campaign_id": camp.get("id"),
            "campaign_name": camp.get("name"),
            "status": camp.get("status"),
            "total_emails": stats.get("total_transactions", 0),
            "sent": stats.get("sent", 0),
            "queued": stats.get("queued", 0),
            "failed": stats.get("failed", 0),
        })
    return {"linked_emails": result}


@router.get("/{campaign_id}")
async def get_campaign(campaign_id: str):
    campaign = dynamodb_repo.get_item("campaigns", {"id": campaign_id})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    stats = TransactionService.get_campaign_stats(campaign_id)

    # Resolve referenced entity names
    sequence = dynamodb_repo.get_item("sequences", {"sequence_id": campaign.get("sequence_id", "")})
    audience = dynamodb_repo.get_item("audiences", {"id": campaign.get("audience_id", "")})

    return {
        **campaign,
        "sequence_name": sequence.get("name") if sequence else "[Deleted]",
        "audience_name": audience.get("name") if audience else "[Deleted]",
        "stats": stats
    }


@router.put("/{campaign_id}")
async def update_campaign(campaign_id: str, request: UpdateCampaignRequest):
    campaign = dynamodb_repo.get_item("campaigns", {"id": campaign_id})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    # Only allow editing draft or scheduled campaigns
    if campaign.get("status") not in (CampaignStatus.DRAFT.value, CampaignStatus.SCHEDULED.value):
        raise HTTPException(
            status_code=409,
            detail=f"Cannot edit campaign with status '{campaign.get('status')}'. Only draft or scheduled campaigns can be edited."
        )

    needs_regeneration = False

    if request.name is not None:
        campaign["name"] = request.name
    if request.description is not None:
        campaign["description"] = request.description
    if request.sender_email_ids is not None:
        # Validate new senders
        for sid in request.sender_email_ids:
            if not dynamodb_repo.get_item("email_accounts", {"id": sid}):
                raise HTTPException(status_code=400, detail=f"Sender not found: {sid}")
        campaign["sender_email_ids"] = request.sender_email_ids
    if request.sequence_id is not None:
        if not dynamodb_repo.get_item("sequences", {"sequence_id": request.sequence_id}):
            raise HTTPException(status_code=400, detail="Sequence not found")
        campaign["sequence_id"] = request.sequence_id
        needs_regeneration = True
    if request.audience_id is not None:
        if not dynamodb_repo.get_item("audiences", {"id": request.audience_id}):
            raise HTTPException(status_code=400, detail="Audience not found")
        campaign["audience_id"] = request.audience_id
        needs_regeneration = True
    if request.schedule_at is not None:
        campaign["schedule_at"] = request.schedule_at.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        needs_regeneration = True

    campaign["updated_at"] = current_time_iso()

    # If key references changed, delete old emails and regenerate step 1
    if needs_regeneration:
        existing_txns = dynamodb_repo.query_table(
            table_name="email_transactions",
            key_condition_expression="#pk = :pk",
            expression_values={":pk": f"CAMPAIGN#{campaign_id}"},
            expression_names={"#pk": "PK"}
        )
        if existing_txns:
            dynamodb_repo.batch_delete_items(
                "email_transactions",
                [{"PK": t["PK"], "SK": t["SK"]} for t in existing_txns]
            )

        campaign["current_step_order"] = 0
        dynamodb_repo.put_item("campaigns", campaign)

        # Regenerate step 1
        steps = CampaignService._get_ordered_steps(campaign["sequence_id"])
        if steps:
            CampaignService.generate_step_transactions(campaign, steps[0], steps)
    else:
        dynamodb_repo.put_item("campaigns", campaign)

    return {"message": "Campaign updated successfully", "regenerated": needs_regeneration}


@router.delete("/{campaign_id}")
async def delete_campaign(campaign_id: str):
    allowed, reason = CampaignService.validate_campaign_delete(campaign_id)
    if not allowed:
        raise HTTPException(status_code=409, detail=reason)

    # Delete all email transactions
    txns = dynamodb_repo.query_table(
        table_name="email_transactions",
        key_condition_expression="#pk = :pk",
        expression_values={":pk": f"CAMPAIGN#{campaign_id}"},
        expression_names={"#pk": "PK"}
    )
    if txns:
        dynamodb_repo.batch_delete_items(
            "email_transactions",
            [{"PK": t["PK"], "SK": t["SK"]} for t in txns]
        )

    # Delete campaign
    dynamodb_repo.delete_item("campaigns", {"id": campaign_id})

    return {
        "message": "Campaign deleted successfully",
        "emails_deleted": len(txns)
    }


@router.post("/{campaign_id}/pause")
async def pause_campaign(campaign_id: str):
    campaign = dynamodb_repo.get_item("campaigns", {"id": campaign_id})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    if campaign.get("status") != CampaignStatus.RUNNING.value:
        raise HTTPException(status_code=409, detail="Only running campaigns can be paused")

    campaign["status"] = CampaignStatus.PAUSED.value
    campaign["updated_at"] = current_time_iso()
    dynamodb_repo.put_item("campaigns", campaign)
    return {"message": "Campaign paused"}


@router.post("/{campaign_id}/resume")
async def resume_campaign(campaign_id: str):
    campaign = dynamodb_repo.get_item("campaigns", {"id": campaign_id})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    if campaign.get("status") != CampaignStatus.PAUSED.value:
        raise HTTPException(status_code=409, detail="Only paused campaigns can be resumed")

    campaign["status"] = CampaignStatus.RUNNING.value
    campaign["updated_at"] = current_time_iso()
    dynamodb_repo.put_item("campaigns", campaign)
    return {"message": "Campaign resumed"}


@router.post("/{campaign_id}/cancel")
async def cancel_campaign(campaign_id: str):
    campaign = dynamodb_repo.get_item("campaigns", {"id": campaign_id})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    if campaign.get("status") in (CampaignStatus.COMPLETED.value, CampaignStatus.CANCELLED.value):
        raise HTTPException(status_code=409, detail="Campaign is already completed or cancelled")

    # Mark all pending emails as cancelled
    txns = dynamodb_repo.query_table(
        table_name="email_transactions",
        key_condition_expression="#pk = :pk",
        expression_values={":pk": f"CAMPAIGN#{campaign_id}"},
        expression_names={"#pk": "PK"}
    )
    cancelled_count = 0
    for t in txns:
        if t.get("status") == EmailTransactionStatus.QUEUED.value:
            t["status"] = EmailTransactionStatus.CANCELLED.value
            t["cancelled_at"] = current_time_iso()
            dynamodb_repo.put_item("email_transactions", t)
            cancelled_count += 1

    campaign["status"] = CampaignStatus.CANCELLED.value
    campaign["updated_at"] = current_time_iso()
    dynamodb_repo.put_item("campaigns", campaign)

    return {"message": "Campaign cancelled", "emails_cancelled": cancelled_count}
