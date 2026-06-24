from fastapi import FastAPI
from contextlib import asynccontextmanager
from app.api.routes import router
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
    title="Email Outreach MVP (AWS)",
    description="Phase 1 MVP for an email outreach platform using DynamoDB and SES.",
    version="1.0.0",
    lifespan=lifespan
)

app.include_router(router)

@app.get("/")
def root():
    return {"message": "Welcome to the Email Outreach API MVP"}
