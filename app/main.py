from fastapi import FastAPI, Depends
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
