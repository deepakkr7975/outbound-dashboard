from fastapi import APIRouter, HTTPException
from typing import Optional

from app.models.schemas import (
    Audience, CreateAudienceRequest, UpdateAudienceRequest, RemoveMembersRequest
)
from app.repositories import dynamodb_repo

router = APIRouter(prefix="/audiences", tags=["Audiences"])


@router.post("")
async def create_audience(request: CreateAudienceRequest):
    # Validate that all lead_ids exist
    if request.lead_ids:
        for lead_id in request.lead_ids:
            lead = dynamodb_repo.get_item("leads", {"id": lead_id})
            if not lead:
                raise HTTPException(
                    status_code=400,
                    detail=f"Lead not found: {lead_id}"
                )

    audience = Audience(
        name=request.name,
        description=request.description,
        lead_ids=list(set(request.lead_ids))  # deduplicate
    )
    dynamodb_repo.put_item("audiences", audience.model_dump())
    return {"message": "Audience created successfully", "audience_id": audience.id}


@router.get("")
async def list_audiences():
    audiences = dynamodb_repo.scan_table("audiences")
    result = []
    for aud in audiences:
        result.append({
            "id": aud.get("id"),
            "name": aud.get("name"),
            "description": aud.get("description"),
            "member_count": len(aud.get("lead_ids", [])),
            "created_at": aud.get("created_at"),
            "updated_at": aud.get("updated_at"),
        })
    return {"audiences": result}


@router.get("/{audience_id}")
async def get_audience(audience_id: str):
    audience = dynamodb_repo.get_item("audiences", {"id": audience_id})
    if not audience:
        raise HTTPException(status_code=404, detail="Audience not found")

    lead_ids = audience.get("lead_ids", [])

    # Resolve lead details
    members = []
    for lead_id in lead_ids:
        lead = dynamodb_repo.get_item("leads", {"id": lead_id})
        if lead:
            # Compute per-lead analytics from campaign_emails
            campaign_emails = dynamodb_repo.scan_table("campaign_emails")
            lead_emails = [ce for ce in campaign_emails if ce.get("lead_id") == lead_id]

            sent_count = sum(1 for ce in lead_emails if ce.get("status") == "sent")
            pending_count = sum(1 for ce in lead_emails if ce.get("status") == "pending")
            failed_count = sum(1 for ce in lead_emails if ce.get("status") == "failed")

            members.append({
                "lead_id": lead.get("id"),
                "name": lead.get("name"),
                "email": lead.get("email"),
                "company": lead.get("company"),
                # Analytics — only sent/pending/failed populated now
                "sent": sent_count,
                "pending": pending_count,
                "failed": failed_count,
                # Future analytics fields — structured for expansion
                "opened": None,
                "clicked": None,
                "replied": None,
            })
        else:
            # Lead was deleted but still referenced in audience
            members.append({
                "lead_id": lead_id,
                "name": "[Deleted Lead]",
                "email": "—",
                "company": "—",
                "sent": 0, "pending": 0, "failed": 0,
                "opened": None, "clicked": None, "replied": None,
            })

    return {
        "id": audience.get("id"),
        "name": audience.get("name"),
        "description": audience.get("description"),
        "member_count": len(lead_ids),
        "members": members,
        "created_at": audience.get("created_at"),
        "updated_at": audience.get("updated_at"),
    }


@router.put("/{audience_id}")
async def update_audience(audience_id: str, request: UpdateAudienceRequest):
    audience = dynamodb_repo.get_item("audiences", {"id": audience_id})
    if not audience:
        raise HTTPException(status_code=404, detail="Audience not found")

    if request.name is not None:
        audience["name"] = request.name
    if request.description is not None:
        audience["description"] = request.description
    if request.lead_ids is not None:
        # Validate new lead_ids
        for lead_id in request.lead_ids:
            lead = dynamodb_repo.get_item("leads", {"id": lead_id})
            if not lead:
                raise HTTPException(status_code=400, detail=f"Lead not found: {lead_id}")
        audience["lead_ids"] = list(set(request.lead_ids))

    from app.models.schemas import current_time_iso
    audience["updated_at"] = current_time_iso()
    dynamodb_repo.put_item("audiences", audience)
    return {"message": "Audience updated successfully"}


@router.delete("/{audience_id}")
async def delete_audience(audience_id: str):
    audience = dynamodb_repo.get_item("audiences", {"id": audience_id})
    if not audience:
        raise HTTPException(status_code=404, detail="Audience not found")

    # Check if linked to any campaigns (warn but allow)
    campaigns = dynamodb_repo.scan_table("campaigns")
    linked = [c for c in campaigns if c.get("audience_id") == audience_id]

    dynamodb_repo.delete_item("audiences", {"id": audience_id})

    warning = None
    if linked:
        names = ", ".join(c.get("name", "Unnamed") for c in linked)
        warning = f"Audience was linked to campaigns: {names}. Those campaigns still reference this audience ID."

    return {"message": "Audience deleted successfully", "warning": warning}


@router.post("/{audience_id}/members/remove")
async def remove_audience_members(audience_id: str, request: RemoveMembersRequest):
    audience = dynamodb_repo.get_item("audiences", {"id": audience_id})
    if not audience:
        raise HTTPException(status_code=404, detail="Audience not found")

    current_ids = set(audience.get("lead_ids", []))
    ids_to_remove = set(request.lead_ids)
    not_found = ids_to_remove - current_ids

    audience["lead_ids"] = list(current_ids - ids_to_remove)

    from app.models.schemas import current_time_iso
    audience["updated_at"] = current_time_iso()
    dynamodb_repo.put_item("audiences", audience)

    return {
        "message": f"Removed {len(ids_to_remove - not_found)} members",
        "not_found_ids": list(not_found) if not_found else None,
    }
