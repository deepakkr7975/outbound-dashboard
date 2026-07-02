import streamlit as st
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from services.api_client import APIClient

st.set_page_config(page_title="Dashboard", page_icon="📊", layout="wide")
st.title("📊 Email Automation Dashboard")

with st.spinner("Loading metrics..."):
    # Fetch data
    leads = APIClient.get_leads()
    accounts = APIClient.get_email_accounts()
    audiences = APIClient.get_audiences()
    sequences = APIClient.get_sequences()
    campaigns = APIClient.get_campaigns()
    
    # Linked email stats across all campaigns
    campaign_stats = APIClient.get_linked_emails_summary()

    total_leads = len(leads)
    total_accounts = len(accounts)
    total_audiences = len(audiences)
    total_sequences = len(sequences)
    total_campaigns = len(campaigns)
    
    total_sent = sum(c.get("sent", 0) for c in campaign_stats)
    total_pending = sum(c.get("pending", 0) for c in campaign_stats)

col1, col2, col3 = st.columns(3)
col1.metric("Connected Accounts", total_accounts)
col2.metric("Total Leads", total_leads)
col3.metric("Audiences", total_audiences)

st.markdown("---")

col4, col5, col6 = st.columns(3)
col4.metric("Sequences", total_sequences)
col5.metric("Active / Total Campaigns", f"{len([c for c in campaigns if c.get('status') == 'running'])} / {total_campaigns}")
col6.metric("Emails Sent (Campaigns)", total_sent)

st.markdown("---")
st.markdown("Navigate using the sidebar to manage your accounts, audiences, sequences, and campaigns.")
