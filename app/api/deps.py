import os
from fastapi import Request, HTTPException

# Paths that must stay reachable without a key:
# - /gmail/callback: Google's OAuth redirect arrives without our headers
# - /unsubscribe: recipients click this from their inbox
# - /o/, /c/: open-pixel and click-redirect hits from recipients' mail clients
AUTH_EXEMPT_PREFIXES = ("/gmail/callback", "/unsubscribe", "/o/", "/c/")


async def api_key_auth(request: Request):
    """
    Simple shared-secret auth: compares the X-API-Key header against the
    API_KEY env var. If API_KEY is unset, auth is disabled (local dev).
    """
    configured_key = os.getenv("API_KEY")
    if not configured_key:
        return

    if request.url.path.startswith(AUTH_EXEMPT_PREFIXES):
        return

    provided_key = request.headers.get("X-API-Key")
    if provided_key != configured_key:
        raise HTTPException(status_code=403, detail="Invalid or missing API key")
