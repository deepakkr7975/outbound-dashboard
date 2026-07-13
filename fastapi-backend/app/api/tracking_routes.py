from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import Response, RedirectResponse

from app.services import tracking_service

router = APIRouter(tags=["Tracking"])


@router.get("/o/{token}")
async def track_open(token: str, request: Request):
    """
    Open-tracking pixel. Always returns the 1x1 GIF regardless of token
    validity — mail clients must never see an error, and probing bogus
    tokens reveals nothing.
    """
    tracking_service.record_open(token, request.headers.get("user-agent"))
    return Response(
        content=tracking_service.PIXEL_GIF,
        media_type="image/gif",
        headers={"Cache-Control": "no-store, no-cache, must-revalidate"},
    )


@router.get("/c/{token}/{idx}")
async def track_click(token: str, idx: int, request: Request):
    """
    Click tracking + redirect. The destination comes from the send record's
    stored tracked_urls (looked up by index), never from the request, so this
    cannot be abused as an open redirect.
    """
    url = tracking_service.record_click(token, idx, request.headers.get("user-agent"))
    if not url:
        raise HTTPException(status_code=404, detail="Unknown tracking link")
    return RedirectResponse(url=url, status_code=302)
