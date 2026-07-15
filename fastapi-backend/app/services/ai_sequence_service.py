"""
AI Sequence Service — generate cold-email sequences with Google Gemini.

Turns a short brief (company, audience, offer, CTA, length constraints) into a
valid `Sequence` object: N steps, each with A/B `variants` and a `wait_days`
cadence. The output is byte-compatible with the hand-authored sequences created
via POST /sequences, so a generated sequence flows into campaigns unchanged.

Model: Gemini (default gemini-2.5-flash), via structured output (one call per
generation) using a Pydantic response schema.
"""

import logging
import os
from typing import List, Optional

from google import genai
from google.genai import types
from pydantic import BaseModel, Field

from app.models.schemas import (
    Sequence, SequenceStepData, Variant, VariantsMap,
    GenerateSequenceRequest, RefineSequenceRequest, RegenerateStepRequest,
)

logger = logging.getLogger(__name__)

DEFAULT_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")


# ── Structured-output shapes (what Gemini returns) ───────────────────────────
# Kept separate from the persisted schemas so the model returns only copy, and
# we own the bookkeeping fields (ids, timestamps, counts).

class _AIVariant(BaseModel):
    subject_lines: List[str] = Field(
        description="Exactly 2 subject line options for this email. Short (<60 chars), curiosity-driven. May use {{name}}/{{company}} merge vars.",
    )
    opening_lines: List[str] = Field(
        description="Exactly 2 opening hook/line options. Bold attention-grabbers that appear before the body. May use {{name}}/{{company}} merge vars.",
    )
    body: str = Field(
        description="Email body (HTML allowed). Starts with 'Hey {{name}},'. May use {{name}}/{{company}} merge vars.",
    )
    reply_trigger: Optional[str] = Field(
        default=None,
        description='A short keyword the reader should reply with, e.g. "SHOW ME", "HACK". Null if no reply CTA.',
    )

class _AIStep(BaseModel):
    step_order: int = Field(description="1-based position of this email in the sequence.")
    wait_days: int = Field(description="Days to wait after the previous step before sending. Step 1 is 0.")
    variant_a: _AIVariant
    variant_b: Optional[_AIVariant] = Field(
        default=None,
        description="Alternate A/B version with a genuinely different angle. Null when A/B testing is off.",
    )

class _AISequence(BaseModel):
    name: str = Field(description="Short internal name for the sequence.")
    description: str = Field(description="One-line description of the sequence's purpose.")
    steps: List[_AIStep]


# ── Tone presets ─────────────────────────────────────────────────────────────

_TONE_INSTRUCTIONS = {
    "clickbait": (
        "You write in an aggressive, high-energy, FOMO-driven clickbait style "
        "modeled after top-performing DTC/ecom outreach. Rules for this tone:\n"
        "- Use shocking statistics and dollar amounts (even approximate).\n"
        "- Name-drop competitors or similar brands (use [Competitor] / [Similar Brand] placeholders).\n"
        "- Add urgency, scarcity, and time-sensitive language.\n"
        "- Use CAPS for emphasis on key words (SHOCKING, INSANE, BRUTAL TRUTH, GAME-CHANGER, BOMBSHELL, etc.).\n"
        "- Every email MUST end with a reply-trigger CTA like 'Reply \"SHOW ME\"'. "
        "Each email should use a DIFFERENT reply keyword.\n"
        "- Opening hooks should be bold, pattern-interrupting statements with numbers.\n"
        "- Subject lines should provoke anxiety or extreme curiosity."
    ),
    "professional": (
        "You write in a polished, professional tone. Rules for this tone:\n"
        "- Be respectful and value-driven, not salesy.\n"
        "- Use data points to support claims but keep language measured.\n"
        "- Opening hooks should establish credibility or relevance.\n"
        "- Subject lines are curiosity-driven but not clickbait.\n"
        "- Reply triggers are optional; use them only if natural."
    ),
    "casual": (
        "You write in a friendly, conversational, casual tone. Rules for this tone:\n"
        "- Sound like a peer, not a salesperson.\n"
        "- Use contractions, short sentences, and informal language.\n"
        "- Opening hooks feel like a friend sharing something interesting.\n"
        "- Subject lines are informal and punchy.\n"
        "- Reply triggers should feel natural and low-pressure."
    ),
    "formal": (
        "You write in a formal, enterprise-grade tone. Rules for this tone:\n"
        "- Use precise, executive-level language.\n"
        "- Reference industry trends and ROI.\n"
        "- Opening hooks should convey authority.\n"
        "- Subject lines are direct and business-like.\n"
        "- Avoid reply triggers; use traditional CTAs instead."
    ),
}


# ── Prompt construction ──────────────────────────────────────────────────────

def _system_prompt(
    body_char_limit: int,
    personalization_vars: List[str],
    ab: bool,
    tone: str = "professional",
) -> str:
    var_list = ", ".join("{{" + v + "}}" for v in personalization_vars) or "(none)"
    ab_rule = (
        "For EVERY step, also produce variant_b: a genuinely different angle "
        "(different hook, framing, or proof point) — not a reworded variant_a."
        if ab else
        "Do NOT produce variant_b — leave it null for every step."
    )
    tone_block = _TONE_INSTRUCTIONS.get(tone, _TONE_INSTRUCTIONS["professional"])
    return f"""You are an expert B2B cold-email copywriter. You write concise, \
high-converting outbound email sequences that get replies.

Tone / Style:
{tone_block}

Structure rules — EVERY email variant must contain:
1. subject_lines: exactly 2 subject-line options (under ~60 chars each).
2. opening_lines: exactly 2 bold opening hook options (1-2 sentences each, separate from body).
3. body: the main email body. Starts with "Hey {{{{name}}}}," and contains the pitch.
   Must be at most {body_char_limit} characters. This is a hard limit.
4. reply_trigger: a short keyword the reader replies with (e.g. "SHOW ME"). \
Set to null if the tone doesn't use reply triggers.

General rules:
- Step 1 has wait_days = 0. Later steps use realistic follow-up gaps (typically 3-4 days).
- Use ONLY these personalization merge variables, written literally so they can be \
substituted at send time: {var_list}. Do not invent other {{{{...}}}} variables.
- One idea per email. No fluff, no jargon, no "I hope this email finds you well".
- Place the call to action naturally; the final step should be a short break-up email.
- {ab_rule}"""


def _brief(req: GenerateSequenceRequest) -> str:
    cta = f"{req.cta.text}" + (f" (link: {req.cta.url})" if req.cta.url else "")
    return f"""Write a cold-email sequence.

Company / website: {req.company}
Target audience: {req.target_audience}
What we're selling: {req.offer}
Number of emails: {req.num_steps}
Call to action: {cta}
Tone: {req.tone}
A/B testing: {"on" if req.include_ab_testing else "off"}

Produce exactly {req.num_steps} steps, ordered step_order 1..{req.num_steps}."""


def _brief_from_reference(req: GenerateSequenceRequest, reference_text: str) -> str:
    """
    Build the user prompt when a reference document drives generation.

    The document is the primary context — the model should mirror its style,
    structure, and messaging — while the brief fields act only as secondary
    guidance. Brief fields the caller left blank are omitted so they don't read
    as empty constraints.
    """
    cta = f"{req.cta.text}" + (f" (link: {req.cta.url})" if req.cta.url else "")
    guidance_lines = []
    if req.company.strip():
        guidance_lines.append(f"- Company / website: {req.company.strip()}")
    if req.target_audience.strip():
        guidance_lines.append(f"- Target audience: {req.target_audience.strip()}")
    if req.offer.strip():
        guidance_lines.append(f"- What we're selling: {req.offer.strip()}")
    if req.cta.text.strip():
        guidance_lines.append(f"- Call to action: {cta}")
    guidance_lines.append(f"- Number of emails: {req.num_steps}")
    guidance_lines.append(f"- Tone: {req.tone}")
    guidance_lines.append(f"- A/B testing: {'on' if req.include_ab_testing else 'off'}")
    guidance = "\n".join(guidance_lines)

    return f"""Below is a REFERENCE DOCUMENT provided by the user. Study its style, \
structure, tone, and messaging, then write a NEW cold-email sequence that follows \
the same approach.

=== REFERENCE DOCUMENT START ===
{reference_text}
=== REFERENCE DOCUMENT END ===

Instructions:
- Mirror the reference's voice, structure, cadence, and persuasion style.
- Do NOT copy the reference verbatim. Produce fresh, original copy inspired by it.
- If the reference implies a company, audience, or offer, carry those through \
unless the settings below override them.

Additional settings (secondary guidance — the reference document takes priority):
{guidance}

Produce exactly {req.num_steps} steps, ordered step_order 1..{req.num_steps}."""


# ── Post-processing ──────────────────────────────────────────────────────────

def _truncate_body(body: str, limit: int) -> str:
    """Trim an over-limit body at the last sentence boundary within the limit."""
    if len(body) <= limit:
        return body
    window = body[:limit]
    cut = max(window.rfind(". "), window.rfind("! "), window.rfind("? "))
    if cut > limit // 2:
        return window[: cut + 1]
    return window.rstrip()


def _to_variant(v: _AIVariant, limit: int) -> Variant:
    return Variant(
        subject_lines=[s.strip() for s in (v.subject_lines or [])[:2]],
        opening_lines=[o.strip() for o in (v.opening_lines or [])[:2]],
        body=_truncate_body(v.body.strip(), limit),
        reply_trigger=v.reply_trigger.strip() if v.reply_trigger else None,
    )


def _assemble_steps(ai_steps: List[_AIStep], limit: int, ab: bool) -> List[SequenceStepData]:
    steps: List[SequenceStepData] = []
    for i, s in enumerate(sorted(ai_steps, key=lambda x: x.step_order), start=1):
        variant_b = _to_variant(s.variant_b, limit) if (ab and s.variant_b) else None
        steps.append(SequenceStepData(
            step_order=i,
            wait_days=0 if i == 1 else max(0, s.wait_days),
            variants=VariantsMap(a=_to_variant(s.variant_a, limit), b=variant_b),
        ))
    return steps


# ── Gemini call ──────────────────────────────────────────────────────────────

def _client() -> genai.Client:
    # 1. Prefer explicit API key
    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if api_key:
        return genai.Client(api_key=api_key)

    # 2. Fall back to service-account credentials (JSON key file)
    _here = os.path.abspath(os.path.dirname(__file__))          # app/services/
    _project_root = os.path.dirname(os.path.dirname(_here))     # project root
    sa_path = os.getenv(
        "GOOGLE_APPLICATION_CREDENTIALS",
        os.path.join(_project_root, "research_lab_service_key.json"),
    )
    if os.path.isfile(sa_path):
        try:
            import json as _json
            from google.oauth2 import service_account as _sa

            with open(sa_path) as f:
                key_data = _json.load(f)
            project_id = key_data.get("project_id")

            creds = _sa.Credentials.from_service_account_file(
                sa_path,
                scopes=["https://www.googleapis.com/auth/cloud-platform"],
            )
            location = os.getenv("VERTEX_LOCATION", "us-central1")
            logger.info(
                "Using service-account credentials (Vertex AI) from %s "
                "(project=%s, location=%s)", sa_path, project_id, location,
            )
            return genai.Client(
                vertexai=True,
                project=project_id,
                location=location,
                credentials=creds,
            )
        except Exception as e:
            logger.warning("Service-account auth failed: %s", e)

    raise RuntimeError(
        "No Gemini credentials found. Set GEMINI_API_KEY in your .env, "
        "or place a service-account key at research_lab_service_key.json."
    )


def _generate(system: str, user: str) -> _AISequence:
    client = _client()
    response = client.models.generate_content(
        model=DEFAULT_MODEL,
        contents=user,
        config=types.GenerateContentConfig(
            system_instruction=system,
            response_mime_type="application/json",
            response_schema=_AISequence,
        ),
    )
    parsed = response.parsed
    if not isinstance(parsed, _AISequence):
        raise RuntimeError("AI generation returned no structured output.")
    return parsed


# ── Public API ───────────────────────────────────────────────────────────────

def generate_sequence(
    req: GenerateSequenceRequest,
    reference_text: Optional[str] = None,
) -> Sequence:
    """
    Brief -> a fully-formed (unsaved) Sequence draft.

    When `reference_text` is supplied (extracted from an uploaded document), the
    document drives the copy and the brief fields become secondary guidance.
    Without it, behaviour is unchanged. Both paths share the same system prompt,
    structured-output call, and assembly, so the response shape is identical.
    """
    user = (
        _brief_from_reference(req, reference_text)
        if reference_text
        else _brief(req)
    )
    ai = _generate(
        _system_prompt(req.body_char_limit, req.personalization_vars, req.include_ab_testing, req.tone),
        user,
    )
    steps = _assemble_steps(ai.steps, req.body_char_limit, req.include_ab_testing)
    default_name = f"{req.company} sequence" if req.company.strip() else "Generated sequence"
    return Sequence(
        name=ai.name.strip() or default_name,
        description=ai.description.strip() or None,
        total_steps=len(steps),
        has_ab_testing=req.include_ab_testing,
        is_ai_generated=True,
        steps=steps,
    )


def refine_sequence(req: RefineSequenceRequest) -> Sequence:
    """Revise an existing set of steps per a free-text instruction."""
    ab = any(s.variants.b for s in req.steps)
    current = "\n\n".join(
        f"Step {s.step_order} (wait {s.wait_days}d):\n"
        f"  A subjects: {s.variants.a.subject_lines} — body: {s.variants.a.body}"
        + (f"\n  B subjects: {s.variants.b.subject_lines} — body: {s.variants.b.body}" if s.variants.b else "")
        for s in sorted(req.steps, key=lambda x: x.step_order)
    )
    user = f"""Here is an existing email sequence draft:

{current}

Revise the entire sequence per this instruction: {req.instruction}

Keep the same number of steps ({len(req.steps)}) unless the instruction says otherwise."""
    ai = _generate(
        _system_prompt(req.body_char_limit, req.personalization_vars, ab, req.tone),
        user,
    )
    steps = _assemble_steps(ai.steps, req.body_char_limit, ab)
    return Sequence(
        name=ai.name.strip() or "Refined sequence",
        description=ai.description.strip() or None,
        total_steps=len(steps),
        has_ab_testing=ab,
        is_ai_generated=True,
        steps=steps,
    )


def regenerate_step(existing: dict, req: RegenerateStepRequest) -> SequenceStepData:
    """Regenerate one step of a persisted sequence; returns the new step only."""
    seq = Sequence(**existing)
    context = "\n".join(
        f"Step {s.step_order}: {s.variants.a.subject_lines} — {s.variants.a.body[:120]}"
        for s in sorted(seq.steps, key=lambda x: x.step_order)
    )
    instruction = req.instruction or "Make it sharper and more likely to get a reply."
    user = f"""This is an existing sequence for context:

{context}

Rewrite ONLY step {req.step_order}. {instruction}
Return a one-step sequence containing just that step (step_order {req.step_order})."""
    # Infer tone from the request if available, default to professional
    tone = getattr(req, "tone", "professional")
    ai = _generate(
        _system_prompt(req.body_char_limit, req.personalization_vars, req.include_ab_testing, tone),
        user,
    )
    if not ai.steps:
        raise RuntimeError("AI regeneration returned no step.")
    target = ai.steps[0]
    variant_b = (
        _to_variant(target.variant_b, req.body_char_limit)
        if (req.include_ab_testing and target.variant_b) else None
    )
    # Preserve the original step's cadence.
    original = next((s for s in seq.steps if s.step_order == req.step_order), None)
    wait_days = original.wait_days if original else max(0, target.wait_days)
    return SequenceStepData(
        step_order=req.step_order,
        wait_days=wait_days,
        variants=VariantsMap(a=_to_variant(target.variant_a, req.body_char_limit), b=variant_b),
    )
