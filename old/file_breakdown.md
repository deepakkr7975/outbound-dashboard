# File Breakdown

This document provides a detailed breakdown of the files in the project, categorized by their function and purpose.

## Core Application Files

These files constitute the main logic of the application, including the API server, database configuration, and client modules for external services.

- **`main.py`**
  - **Description**: The entry point of the FastAPI application. It defines the API routes for sending emails, managing templates, scheduling, handling OAuth authentication, and integrating with the bulk user creation module.
  - **Key Components**: FastAPI app initialization, Pydantic models for request validation, and route handlers.

- **`config.py`**
  - **Description**: Handles configuration and environment variable loading. It initializes the AWS DynamoDB resources and table references used throughout the application.
  - **Key Components**: DynamoDB resource initialization, table objects (templates, senders, logs, etc.), and Google OAuth credentials.

- **`create_bulk_user.py`**
  - **Description**: A FastAPI router module dedicated to creating bulk users in Google Workspace. It interacts with the Google Admin SDK and stores user details in DynamoDB.
  - **Key Components**: `create_bulk_workspace_users` endpoint, user splitting logic, and database insertion.

- **`gmail_bulk_sender.py`**
  - **Description**: Implements the logic for sending bulk emails. It includes rate limiting and batch processing to comply with Gmail's sending limits.
  - **Key Components**: `send_bulk_gmail` function with batching and delay mechanisms.

- **`gmail_client.py`**
  - **Description**: A wrapper around the Google Gmail API. It handles authentication and provides helper functions to send emails and fetch message details.
  - **Key Components**: `get_gmail_service`, `send_gmail`, and `fetch_emails` functions.

- **`workspace_admin_client.py`**
  - **Description**: Client for the Google Workspace Admin SDK Directory API. It provides functionality to programmatically create new users in the workspace.
  - **Key Components**: `create_workspace_user` function and Directory API service builder.

## Setup and Configuration

These files are used for setting up the environment, dependencies, and initial data seeding.

- **`create_tables_v2.py`**
  - **Description**: A script to initialize the required DynamoDB tables. It checks if tables exist and creates them with the specified key schema if they do not.
  - **Key Components**: Table definitions for contacts, templates, logs, bulk users, etc.

- **`requirements.txt`**
  - **Description**: Lists all the Python dependencies required to run the project.
  - **Key Components**: `fastapi`, `uvicorn`, `boto3`, `google-api-python-client`, etc.

- **`seed_template.py`**
  - **Description**: A script to seed the database with an initial "Mobbin-style" HTML email template. This is useful for testing and having a default template available.
  - **Key Components**: HTML template string and DynamoDB insertion logic.

- **`.gitignore`**
  - **Description**: Specifies intentionally untracked files that Git should ignore, such as virtual environments, cache files, and sensitive environment variables.

## Utilities and Debugging

Helper scripts used for checking connectivity and debugging configuration issues.

- **`check_aws.py`**
  - **Description**: A simple script to verify AWS connectivity by attempting to list DynamoDB tables.
  - **Key Components**: Boto3 connection test.

- **`debug_env.py`**
  - **Description**: A diagnostic script to inspect loaded environment variables and test the connection to AWS services (specifically checking for SES/DynamoDB connectivity).
  - **Key Components**: Environment variable printing (masked) and service connection tests.

## Testing and Verification

Scripts and test files used to verify the functionality of the application and its endpoints.

- **`test_new_endpoints.py`**
  - **Description**: Integration tests for newer API endpoints, including fetching emails, retrieving unique contacts, and exporting data.
  - **Key Components**: `test_fetch_emails`, `test_unique_contacts`, `test_export_data`.

- **`test_workflow.py`**
  - **Description**: Comprehensive workflow tests for the core email functionality. It tests template creation, listing, and direct email sending.
  - **Key Components**: `test_create_template`, `test_list_templates`, `test_send_email`.

- **`verify_default_sender.py`**
  - **Description**: A specific test script to verify that the application correctly uses the default sender when one is not explicitly provided in the request.
  - **Key Components**: HTTP POST request to `/send-email` without a sender field.

- **`verify_template_logic.py`**
  - **Description**: Verifies the logic for using email templates, ensuring that subject/body overrides work as expected when a template name is provided.
  - **Key Components**: Tests for template-only requests and template-with-override requests.
