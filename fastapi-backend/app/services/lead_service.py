from typing import List, Dict, Any, Tuple

from app.models.schemas import Lead
from app.repositories import dynamodb_repo


def upsert_leads(parsed_leads: List[Dict[str, Any]], tag_list: List[str]) -> Tuple[List[str], int]:
    """
    Insert parsed leads, deduplicating by email against existing leads
    (and within the batch itself). Existing leads are reused — their ID is
    returned and any new tags are merged in.

    Returns (ordered unique lead_ids, reused_count).
    """
    existing_leads = dynamodb_repo.scan_table("leads")
    leads_by_email = {
        l.get("email", "").lower(): l for l in existing_leads if l.get("email")
    }

    leads_to_write = []
    lead_ids = []
    reused_count = 0
    for lead_data in parsed_leads:
        email_key = lead_data.get("email", "").lower()
        existing = leads_by_email.get(email_key)

        if existing:
            # Reuse the lead; merge in any new tags
            merged_tags = existing.get("tags", [])
            new_tags = [t for t in tag_list if t not in merged_tags]
            if new_tags:
                existing["tags"] = merged_tags + new_tags
                leads_to_write.append(existing)
            if existing["id"] not in lead_ids:
                lead_ids.append(existing["id"])
            reused_count += 1
        else:
            lead = Lead(**lead_data)
            lead_dict = lead.model_dump()
            existing_tags = lead_dict.get("tags", [])
            for tag in tag_list:
                if tag not in existing_tags:
                    existing_tags.append(tag)
            lead_dict["tags"] = existing_tags
            leads_to_write.append(lead_dict)
            lead_ids.append(lead_dict["id"])
            # Track within this batch so duplicate rows also dedupe
            leads_by_email[email_key] = lead_dict

    if leads_to_write:
        dynamodb_repo.batch_write_items("leads", leads_to_write)

    return lead_ids, reused_count
