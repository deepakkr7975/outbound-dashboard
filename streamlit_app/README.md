# Email Outreach MVP - Streamlit Frontend

This directory contains the frontend for the Email Outreach MVP, built using [Streamlit](https://streamlit.io/). It serves as a simple, efficient, and effective user interface to interact with the FastAPI backend and AWS infrastructure.

## 🚀 Features

The application is divided into several sections, accessible via the sidebar:

- **Dashboard** (`pages/1_Dashboard.py`): View high-level metrics and an overview of your outreach operations.
- **Email Accounts** (`pages/2_Email_Accounts.py`): Connect and manage your Gmail sender accounts. Checks SES verification status.
- **Leads** (`pages/3_Leads.py`): Upload CSV files containing prospective contacts (requires headers: `name`, `email`, `company`) and view them in a tabular format.
- **Bulk Schedule** (`pages/4_Bulk_Schedule.py`): Compose email messages and schedule them for automatic delivery to your leads.
- **Scheduled Emails** (`pages/5_Scheduled_Emails.py`): Track the status of emails waiting in the queue or those that have already been sent.

## 📂 Project Structure

- **`app.py`**: The main entry point and landing page of the application.
- **`pages/`**: Contains the code for each specific view. Streamlit automatically renders these files as navigable links in the sidebar.
- **`services/api_client.py`**: A dedicated API client that handles all HTTP communication with the FastAPI backend.
- **`config.py`**: Holds configuration settings (like the backend API URL).

## 🛠️ Setup & Running

1. **Ensure Backend is Running**: The Streamlit app relies on the FastAPI backend. Start it from the root directory:
   ```bash
   uvicorn app.main:app --reload
   ```

2. **Run Streamlit**: Open a new terminal, activate your virtual environment, and start the Streamlit server:
   ```bash
   streamlit run streamlit_app/app.py
   ```

3. **Access the App**: The application will automatically open in your default web browser, typically at `http://localhost:8501`.

## 🔗 How it Works

The Streamlit frontend is entirely decoupled from the database. It uses the `services/api_client.py` to send requests to the FastAPI backend endpoints (e.g., uploading leads, scheduling emails, checking SES status). The backend then handles the heavy lifting, including DynamoDB interactions and scheduling tasks via APScheduler.
