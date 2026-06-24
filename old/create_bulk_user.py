from datetime import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
from googleapiclient.errors import HttpError
from config import bulk_users_table, workspace_domains_table
from workspace_admin_client import create_workspace_user, get_directory_service


class CreateBulkUserRequest(BaseModel):
    domain: str | None = None
    domains: List[str] | None = None
    count: int
    names: List[str]
    org_unit: str = "/"
    password: str | None = None


def split_name(full_name: str):
    full_name = full_name.strip()
    if not full_name:
        return "User", "User"
    parts = full_name.split()
    if len(parts) == 1:
        return parts[0], parts[0]
    return parts[0], " ".join(parts[1:])


class WorkspaceDomainsRequest(BaseModel):
    domains: List[str]


router = APIRouter()


@router.post("/create-bulk-user")
def create_bulk_workspace_users(data: CreateBulkUserRequest):
    if not data.domain and not data.domains:
        raise HTTPException(status_code=400, detail="At least one domain must be provided")
    if data.count != len(data.names):
        raise HTTPException(
            status_code=400,
            detail="count must be equal to the number of names provided",
        )

    created_users = []

    target_domains = data.domains or [data.domain]

    for domain in target_domains:
        shared_password = data.password if data.password else f"{domain}@919"
        for raw_name in data.names:
            first_name, last_name = split_name(raw_name)
            email_local = raw_name.strip().replace(" ", ".").lower() or "user"
            email = f"{email_local}@{domain}"
            password = shared_password

            user = create_workspace_user(
                email=email,
                first_name=first_name,
                last_name=last_name,
                password=password,
                org_unit=data.org_unit,
            )

            bulk_users_table.put_item(
                Item={
                    "email": email,
                    "domain": domain,
                    "workspace_user_id": user["id"],
                    "created_at": datetime.now().isoformat(),
                }
            )

            created_users.append(
                {
                    "email": email,
                    "temp_password": password,
                }
            )

    return {
        "message": "Workspace users created successfully",
        "users": created_users,
    }


@router.get("/users/cached")
def fetch_cached_users():
    return bulk_users_table.scan().get("Items", [])


@router.get("/users/workspace")
def fetch_workspace_users():
    service = get_directory_service()
    users = service.users().list(customer="my_customer", maxResults=100).execute()
    return users.get("users", [])


@router.post("/workspace/domains/add")
def add_workspace_domains(data: WorkspaceDomainsRequest):
    for domain in data.domains:
        workspace_domains_table.put_item(
            Item={
                "domain": domain,
                "created_at": datetime.now().isoformat(),
            }
        )

    return {"message": "Domains added successfully", "domains": data.domains}


@router.get("/workspace/domains")
def list_workspace_domains():
    return workspace_domains_table.scan().get("Items", [])


@router.delete("/workspace/users/{email}")
def delete_workspace_user(email: str):
    service = get_directory_service()
    try:
        service.users().delete(userKey=email).execute()
    except HttpError as e:
        if e.resp.status == 404:
            raise HTTPException(status_code=404, detail="User not found in Workspace")
        raise HTTPException(status_code=500, detail="Failed to delete Workspace user")
    bulk_users_table.delete_item(Key={"email": email})
    return {"message": "Workspace user deleted", "email": email}
