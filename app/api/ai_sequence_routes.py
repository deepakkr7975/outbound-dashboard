from fastapi import APIRouter, HTTPException

from app.models.schemas import (
    GenerateSequenceRequest, RefineSequenceRequest, RegenerateStepRequest,
    current_time_iso,
)
from app.repositories import dynamodb_repo
from app.services import ai_sequence_service

router = APIRouter(prefix="/ai/sequences", tags=["AI Sequences"])


def _run(fn, *args):
    """Call an AI service fn, mapping config/generation errors to HTTP responses."""
    try:
        return fn(*args)
    except RuntimeError as e:
        # Missing API key or empty model output.
        detail = str(e)
        status = 503 if "GEMINI_API_KEY" in detail else 502
        raise HTTPException(status_code=status, detail=detail)
    except Exception as e:  # google.genai errors and friends
        raise HTTPException(status_code=502, detail=f"AI generation failed: {e}")


@router.post("/generate")
async def generate(request: GenerateSequenceRequest):
    """Generate a sequence draft from a brief. Does NOT persist."""
    sequence = _run(ai_sequence_service.generate_sequence, request)
    result = sequence.model_dump()
    result["draft"] = True
    return result


@router.post("/generate-and-save")
async def generate_and_save(request: GenerateSequenceRequest):
    """Generate a sequence and persist it to the sequences table."""
    sequence = _run(ai_sequence_service.generate_sequence, request)
    dynamodb_repo.put_item("sequences", sequence.model_dump())
    return sequence.model_dump()


@router.post("/refine")
async def refine(request: RefineSequenceRequest):
    """Revise a draft sequence with a free-text instruction. Does NOT persist."""
    sequence = _run(ai_sequence_service.refine_sequence, request)
    result = sequence.model_dump()
    result["draft"] = True
    return result


@router.post("/{sequence_id}/regenerate-step")
async def regenerate_step(sequence_id: str, request: RegenerateStepRequest):
    """Regenerate one step of a saved sequence and persist the change."""
    existing = dynamodb_repo.get_item("sequences", {"sequence_id": sequence_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Sequence not found")

    new_step = _run(ai_sequence_service.regenerate_step, existing, request)

    steps = [s for s in existing.get("steps", []) if s.get("step_order") != request.step_order]
    if len(steps) == len(existing.get("steps", [])):
        raise HTTPException(
            status_code=404,
            detail=f"Step {request.step_order} not found in sequence",
        )
    steps.append(new_step.model_dump())
    steps.sort(key=lambda s: s["step_order"])

    existing["steps"] = steps
    existing["has_ab_testing"] = existing.get("has_ab_testing", False) or (new_step.variants.b is not None)
    existing["updated_at"] = current_time_iso()
    dynamodb_repo.put_item("sequences", existing)
    return existing
