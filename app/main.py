from fastapi import FastAPI
from contextlib import asynccontextmanager
from app.api.routes import router
from app.api.audience_routes import router as audience_router
from app.api.sequence_routes import router as sequence_router
from app.api.campaign_routes import router as campaign_router
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
    description="Full-featured email outreach platform with campaigns, sequences, audiences, and sender management.",
    version="2.0.0",
    lifespan=lifespan
)

app.include_router(router)
app.include_router(audience_router)
app.include_router(sequence_router)
app.include_router(campaign_router)

@app.get("/")
def root():
    return {"message": "Welcome to the Email Automation Platform API"}
