import os
from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials

SCOPES = ["https://www.googleapis.com/auth/admin.directory.user"]

def get_directory_service():
    creds = Credentials(
        token=os.getenv("GOOGLE_ACCESS_TOKEN"),
        refresh_token=os.getenv("GOOGLE_REFRESH_TOKEN"),
        token_uri="https://oauth2.googleapis.com/token",
        client_id=os.getenv("GOOGLE_CLIENT_ID"),
        client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
        scopes=SCOPES,
    )
    return build("admin", "directory_v1", credentials=creds)

def create_workspace_user(email, first_name, last_name, password, org_unit="/"):
    service = get_directory_service()

    body = {
        "primaryEmail": email,
        "name": {
            "givenName": first_name,
            "familyName": last_name
        },
        "password": password,
        "orgUnitPath": org_unit,
        "changePasswordAtNextLogin": True
    }

    return service.users().insert(body=body).execute()
