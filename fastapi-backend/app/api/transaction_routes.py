from fastapi import APIRouter, HTTPException
from typing import Optional
from app.services.transaction_service import TransactionService
from app.models.schemas import UpdateTransactionRequest

router = APIRouter(prefix="/transactions", tags=["Transactions"])

@router.get("")
async def list_transactions(
    campaign_id: Optional[str] = None,
    sequence_id: Optional[str] = None,
    lead_id: Optional[str] = None,
    audience_id: Optional[str] = None,
    sender_email_id: Optional[str] = None,
    status: Optional[str] = None,
    variant: Optional[str] = None,
    provider: Optional[str] = None,
    scheduled_from: Optional[str] = None,
    scheduled_to: Optional[str] = None
):
    """
    List transactions matching the provided filters.
    All filters are optional and combinable.
    """
    transactions = TransactionService.list_transactions(
        campaign_id=campaign_id,
        sequence_id=sequence_id,
        lead_id=lead_id,
        audience_id=audience_id,
        sender_email_id=sender_email_id,
        status=status,
        variant=variant,
        provider=provider,
        scheduled_from=scheduled_from,
        scheduled_to=scheduled_to
    )
    
    return {"transactions": transactions}

@router.get("/{transaction_id}")
async def get_transaction(transaction_id: str):
    """
    Get the full details of a specific email transaction,
    with resolved campaign, lead, and sender information.
    """
    txn = TransactionService.get_transaction(transaction_id)
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
        
    return txn

@router.get("/{transaction_id}/events")
async def get_transaction_events(transaction_id: str):
    """
    Raw open/click tracking events for a transaction, oldest first.
    Includes bot-suspect events (flagged) that didn't count as engagement.
    """
    from app.services import tracking_service
    events = tracking_service.get_events(f"t-{transaction_id}")
    return {"transaction_id": transaction_id, "events": events, "count": len(events)}


@router.patch("/{transaction_id}")
async def update_transaction(transaction_id: str, request: UpdateTransactionRequest):
    """
    Update a transaction's status and related fields.
    Timestamps and counters are managed automatically by the service layer.
    """
    try:
        updated = TransactionService.update_transaction(transaction_id, request)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    
    return {"message": "Transaction updated", "transaction": updated}
