import os
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.api.routes import router
from app.api.audience_routes import router as audience_router
from app.api.sequence_routes import router as sequence_router
from app.api.ai_sequence_routes import router as ai_sequence_router
from app.api.campaign_routes import router as campaign_router
from app.api.transaction_routes import router as transaction_router
from app.api.tracking_routes import router as tracking_router
from app.api.deps import api_key_auth
from app.scheduler.cron import start_scheduler
from app.database.init_dynamodb import init_tables

# Define lifespan manager for startup and shutdown events
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Serverless deploys (Modal) run the tables setup as a one-off job and the
    # cron jobs as platform schedules, because a web container that scales to
    # zero cannot host a reliable in-process scheduler.
    if os.getenv("RUN_INPROCESS_SCHEDULER", "true").lower() not in ("1", "true", "yes"):
        yield
        return

    # Initialize DynamoDB tables if they don't exist
    print("Initializing DynamoDB tables...")
    init_tables()

    # Start APScheduler
    print("Starting APScheduler...")
    scheduler = start_scheduler()

    yield

    # Shutdown APScheduler on app exit
    print("Shutting down APScheduler...")
    scheduler.shutdown()

app = FastAPI(
    title="Email Automation Platform",
    description="Full-featured email outreach platform with campaigns, sequences, lead lists, and sender management.",
    version="2.0.0",
    lifespan=lifespan
)

# Allow the Next.js dashboard (localhost:3000/3001) to call this API from the
# browser. Origins can be overridden/extended via the CORS_ORIGINS env var
# (comma-separated) for staging/production deploys.
_default_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
]
_env_origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_env_origins or _default_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# All routers require X-API-Key when the API_KEY env var is set.
# /gmail/callback and /unsubscribe are exempted inside api_key_auth.
auth = [Depends(api_key_auth)]
app.include_router(router, dependencies=auth)
app.include_router(audience_router, dependencies=auth)
app.include_router(sequence_router, dependencies=auth)
app.include_router(ai_sequence_router, dependencies=auth)
app.include_router(campaign_router, dependencies=auth)
app.include_router(transaction_router, dependencies=auth)
# Recipient-facing tracking endpoints (/o, /c) — auth-exempt via deps.py
app.include_router(tracking_router, dependencies=auth)

@app.get("/")
def root():
    return {"message": "Welcome to the Email Automation Platform API"}
