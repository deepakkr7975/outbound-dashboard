from fastapi import APIRouter, HTTPException

from app.models.schemas import (
    Sequence,
    CreateSequenceRequest, UpdateSequenceRequest,
    current_time_iso
)
from app.repositories import dynamodb_repo

router = APIRouter(prefix="/sequences", tags=["Sequences"])

def _get_linked_campaigns(sequence_id: str):
    """Return campaigns that reference this sequence."""
    campaigns = dynamodb_repo.scan_table("campaigns")
    return [c for c in campaigns if c.get("sequence_id") == sequence_id]

# ── Sequence CRUD ────────────────────────────────────────────────────────────

@router.post("")
async def create_sequence(request: CreateSequenceRequest):
    sequence = Sequence(
        name=request.name,
        description=request.description,
        total_steps=request.total_steps,
        has_ab_testing=request.has_ab_testing,
        steps=request.steps
    )
    
    # Store directly, preserving embedded steps
    dynamodb_repo.put_item("sequences", sequence.model_dump())

    return sequence.model_dump()


@router.get("")
async def list_sequences():
    sequences = dynamodb_repo.scan_table("sequences")
    return sequences


@router.get("/{sequence_id}")
async def get_sequence(sequence_id: str):
    sequence = dynamodb_repo.get_item("sequences", {"sequence_id": sequence_id})
    if not sequence:
        raise HTTPException(status_code=404, detail="Sequence not found")
    return sequence


@router.put("/{sequence_id}")
async def update_sequence(sequence_id: str, request: UpdateSequenceRequest):
    sequence = dynamodb_repo.get_item("sequences", {"sequence_id": sequence_id})
    if not sequence:
        raise HTTPException(status_code=404, detail="Sequence not found")

    if request.name is not None:
        sequence["name"] = request.name
    if request.description is not None:
        sequence["description"] = request.description
    if request.total_steps is not None:
        sequence["total_steps"] = request.total_steps
    if request.has_ab_testing is not None:
        sequence["has_ab_testing"] = request.has_ab_testing
    if request.steps is not None:
        # Pydantic parsing returns dicts inside a list from .model_dump(), 
        # but here they are still BaseModel objects, so we need to dump them.
        sequence["steps"] = [step.model_dump() for step in request.steps]

    sequence["updated_at"] = current_time_iso()
    dynamodb_repo.put_item("sequences", sequence)
    return sequence


@router.delete("/{sequence_id}")
async def delete_sequence(sequence_id: str):
    sequence = dynamodb_repo.get_item("sequences", {"sequence_id": sequence_id})
    if not sequence:
        raise HTTPException(status_code=404, detail="Sequence not found")

    # Block deletion if linked to campaigns that have sent or are sending
    linked = _get_linked_campaigns(sequence_id)
    blocking_campaigns = [
        c for c in linked
        if c.get("status") in ("running", "completed", "paused")
    ]
    if blocking_campaigns:
        names = ", ".join(c.get("name", "Unnamed") for c in blocking_campaigns)
        raise HTTPException(
            status_code=409,
            detail=f"Cannot delete: sequence is linked to active/completed campaigns: {names}"
        )

    # Cancel any draft/scheduled campaigns that reference this sequence
    draft_campaigns = [
        c for c in linked
        if c.get("status") in ("draft", "scheduled")
    ]
    for camp in draft_campaigns:
        camp["status"] = "cancelled"
        camp["updated_at"] = current_time_iso()
        dynamodb_repo.put_item("campaigns", camp)

    # Delete the sequence itself
    dynamodb_repo.delete_item("sequences", {"sequence_id": sequence_id})

    return {
        "message": "Sequence deleted successfully",
        "cancelled_campaigns": len(draft_campaigns)
    }

