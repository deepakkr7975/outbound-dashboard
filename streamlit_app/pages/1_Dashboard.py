import streamlit as st
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from services.api_client import APIClient

st.set_page_config(page_title="Dashboard", page_icon="📊", layout="wide")
st.title("📊 Dashboard")

with st.spinner("Loading metrics..."):
    # Fetch data
    leads = APIClient.get_leads()
    accounts = APIClient.get_email_accounts()
    scheduled_emails = APIClient.get_scheduled_emails()

    total_leads = len(leads)
    total_accounts = len(accounts)
    
    # Calculate scheduled vs sent
    pending_emails = [e for e in scheduled_emails if e.get("status") == "pending"]
    sent_emails = [e for e in scheduled_emails if e.get("status") == "sent"]
    
    total_pending = len(pending_emails)
    total_sent = len(sent_emails)

col1, col2, col3, col4 = st.columns(4)

with col1:
    st.metric(label="Total Leads", value=total_leads)

with col2:
    st.metric(label="Connected Accounts", value=total_accounts)

with col3:
    st.metric(label="Pending Scheduled Emails", value=total_pending)

with col4:
    st.metric(label="Total Sent Emails", value=total_sent)

st.markdown("---")
st.markdown("Navigate using the sidebar to manage your accounts, leads, and schedules.")
