from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from typing import Optional

from app.models.schemas import Audience, UpdateAudienceRequest, Lead, current_time_iso
from app.repositories import dynamodb_repo
from app.services.csv_service import parse_leads_csv
from app.services.lead_service import upsert_leads

router = APIRouter(prefix="/audiences", tags=["Audiences"])



@router.get("")
async def list_audiences():
    """List all audiences (metadata only, no lead_ids)."""
    audiences = dynamodb_repo.scan_table("audiences")
    result = []
    for aud in audiences:
        result.append({
            "id": aud.get("id"),
            "name": aud.get("name"),
            "description": aud.get("description"),
            "file_name": aud.get("file_name"),
            "tags": aud.get("tags", []),
            "num_leads": aud.get("num_leads", len(aud.get("lead_ids", []))),
            "created_at": aud.get("created_at"),
        })
    return {"audiences": result}


@router.get("/{audience_id}")
async def get_audience(audience_id: str):
    """Return audience metadata together with all resolved leads."""
    audience = dynamodb_repo.get_item("audiences", {"id": audience_id})
    if not audience:
        raise HTTPException(status_code=404, detail="Audience not found")

    lead_ids = audience.get("lead_ids", [])

    # Resolve lead details in one batch fetch
    fetched = dynamodb_repo.batch_get_items("leads", [{"id": lid} for lid in lead_ids])
    leads_by_id = {l["id"]: l for l in fetched}

    leads = []
    for lead_id in lead_ids:
        lead = leads_by_id.get(lead_id)
        if lead:
            leads.append({
                "id": lead.get("id"),
                "name": lead.get("name"),
                "email": lead.get("email"),
                "company": lead.get("company"),
                "tags": lead.get("tags", []),
            })
        else:
            leads.append({
                "id": lead_id,
                "name": "[Deleted Lead]",
                "email": "—",
                "company": "—",
                "tags": [],
            })

    return {
        "audience": {
            "id": audience.get("id"),
            "name": audience.get("name"),
            "description": audience.get("description"),
            "file_name": audience.get("file_name"),
            "tags": audience.get("tags", []),
            "num_leads": audience.get("num_leads", len(lead_ids)),
            "created_at": audience.get("created_at"),
            "updated_at": audience.get("updated_at"),
        },
        "leads": leads
    }


@router.put("/{audience_id}")
async def update_audience(audience_id: str, request: UpdateAudienceRequest):
    """Update audience name, description, or tags. Does NOT modify lead_ids."""
    audience = dynamodb_repo.get_item("audiences", {"id": audience_id})
    if not audience:
        raise HTTPException(status_code=404, detail="Audience not found")

    if request.name is not None:
        audience["name"] = request.name
    if request.description is not None:
        audience["description"] = request.description
    if request.tags is not None:
        audience["tags"] = request.tags

    audience["updated_at"] = current_time_iso()
    dynamodb_repo.put_item("audiences", audience)
    return {"message": "Audience updated successfully"}


@router.post("/{audience_id}/leads")
async def add_leads_to_audience(
    audience_id: str,
    lead_ids: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None)
):
    """
    Append leads to an existing audience. Provide EITHER:
    - `lead_ids`: comma-separated existing lead IDs, or
    - `file`: a CSV upload (same format as /leads/upload; deduplicated by email).
    """
    audience = dynamodb_repo.get_item("audiences", {"id": audience_id})
    if not audience:
        raise HTTPException(status_code=404, detail="Audience not found")

    if not lead_ids and not file:
        raise HTTPException(status_code=400, detail="Provide either lead_ids or a CSV file")

    incoming_ids = []
    reused_count = 0

    if lead_ids:
        requested = [i.strip() for i in lead_ids.split(",") if i.strip()]
        for lid in requested:
            if not dynamodb_repo.get_item("leads", {"id": lid}):
                raise HTTPException(status_code=400, detail=f"Lead not found: {lid}")
        incoming_ids.extend(requested)

    if file:
        if not file.filename.endswith(".csv"):
            raise HTTPException(status_code=400, detail="File must be a CSV")
        content = await file.read()
        try:
            parsed_leads = parse_leads_csv(content)
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))
        csv_lead_ids, reused_count = upsert_leads(parsed_leads, audience.get("tags", []))
        incoming_ids.extend(csv_lead_ids)

    # Append, skipping leads already in the audience
    current_ids = audience.get("lead_ids", [])
    added = [lid for lid in dict.fromkeys(incoming_ids) if lid not in current_ids]

    audience["lead_ids"] = current_ids + added
    audience["num_leads"] = len(audience["lead_ids"])
    audience["updated_at"] = current_time_iso()
    dynamodb_repo.put_item("audiences", audience)

    return {
        "message": "Leads added to audience",
        "added": len(added),
        "skipped_existing": len(set(incoming_ids)) - len(added),
        "reused_leads": reused_count,
        "num_leads": audience["num_leads"]
    }


@router.delete("/{audience_id}")
async def delete_audience(audience_id: str):
    """Delete audience only (not leads). Block if active campaign references it."""
    audience = dynamodb_repo.get_item("audiences", {"id": audience_id})
    if not audience:
        raise HTTPException(status_code=404, detail="Audience not found")

    # Check if linked to any active campaigns
    campaigns = dynamodb_repo.scan_table("campaigns")
    active_campaigns = [
        c for c in campaigns
        if c.get("audience_id") == audience_id
        and c.get("status") in ("scheduled", "running", "paused")
    ]
    if active_campaigns:
        names = ", ".join(c.get("name", "Unnamed") for c in active_campaigns)
        raise HTTPException(
            status_code=409,
            detail=f"Cannot delete: audience is referenced by active campaigns: {names}"
        )

    dynamodb_repo.delete_item("audiences", {"id": audience_id})
    return {"message": "Audience deleted successfully"}
