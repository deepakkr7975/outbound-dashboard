from typing import List, Dict, Any, Optional

class AccountSelectionService:
    @staticmethod
    def select_account(accounts: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """
        Selects the next available active email account that hasn't reached its daily limit,
        preferring the least recently used account (oldest last_used_at).
        """
        available_accounts = []
        for acc in accounts:
            is_active = acc.get("is_active", True)
            daily_limit = acc.get("daily_limit", 30)
            sent_today = acc.get("sent_today", 0)
            
            if is_active and sent_today < daily_limit:
                available_accounts.append(acc)
                
        if not available_accounts:
            return None
            
        # Sort key to find the least recently used (LRU) account:
        # 1. last_used_at: empty string/None comes first (never used)
        # 2. sent_today: tie-breaker, select account with fewer sends today
        # 3. id: secondary tie-breaker, for deterministic sorting
        def get_sort_key(acc):
            last_used = acc.get("last_used_at") or ""
            sent_today = acc.get("sent_today", 0)
            return (last_used, sent_today, acc.get("id", ""))
            
        available_accounts.sort(key=get_sort_key)
        return available_accounts[0]

    @staticmethod
    def select_from_pool(
        sender_email_ids: List[str],
        all_accounts: List[Dict[str, Any]]
    ) -> Optional[Dict[str, Any]]:
        """
        Filter accounts to only those in the campaign's sender pool,
        then apply LRU selection.
        
        Future: this method will accept a sender_pool_id instead of
        a list of IDs, and look up the pool's accounts.
        """
        pool_accounts = [
            acc for acc in all_accounts
            if acc.get("id") in sender_email_ids
        ]
        return AccountSelectionService.select_account(pool_accounts)
