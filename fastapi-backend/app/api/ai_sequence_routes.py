from fastapi import APIRouter, HTTPException

from app.api import sequence_routes
from app.models.schemas import (
    GenerateSequenceRequest, RefineSequenceRequest, RegenerateStepRequest,
    SequenceStepData, UpdateAISequenceRequest,
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


@router.put("/{sequence_id}")
async def update(sequence_id: str, request: UpdateAISequenceRequest):
    """Refine a saved sequence with an instruction and persist the result."""
    existing = dynamodb_repo.get_item("sequences", {"sequence_id": sequence_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Sequence not found")

    steps = existing.get("steps") or []
    if not steps:
        raise HTTPException(status_code=400, detail="Sequence has no steps to refine")

    refined = _run(
        ai_sequence_service.refine_sequence,
        RefineSequenceRequest(
            steps=[SequenceStepData(**s) for s in steps],
            instruction=request.instruction,
            body_char_limit=request.body_char_limit,
            personalization_vars=request.personalization_vars,
            tone=request.tone,
        ),
    )

    # Keep the saved sequence's identity; replace only the generated content.
    existing["name"] = request.name or refined.name
    existing["description"] = request.description or refined.description
    existing["total_steps"] = refined.total_steps
    existing["has_ab_testing"] = refined.has_ab_testing
    existing["is_ai_generated"] = True
    existing["steps"] = [s.model_dump() for s in refined.steps]
    existing["updated_at"] = current_time_iso()

    dynamodb_repo.put_item("sequences", existing)
    return existing


@router.delete("/{sequence_id}")
async def delete(sequence_id: str):
    """Delete a saved sequence, applying the same campaign-link guards as /sequences."""
    return await sequence_routes.delete_sequence(sequence_id)


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
    existing["is_ai_generated"] = True
    existing["updated_at"] = current_time_iso()
    dynamodb_repo.put_item("sequences", existing)
    return existing
