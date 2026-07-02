import streamlit as st
import pandas as pd
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from services.api_client import APIClient

st.set_page_config(page_title="Campaign Monitor", page_icon="📊", layout="wide")
st.title("📊 Campaign Monitor")

# Fallback: if no campaign is selected, show dropdown
if "selected_campaign_id" not in st.session_state:
    st.session_state.selected_campaign_id = None

st.markdown("Select a campaign to view detailed logs and analytics.")

with st.spinner("Loading campaigns..."):
    campaigns = APIClient.get_campaigns()

if not campaigns:
    st.info("No campaigns available to monitor.")
    st.stop()

# Dropdown to pick campaign
camp_options = {c["id"]: f"{c.get('name')} ({c.get('status')})" for c in campaigns}

# Set index based on session state if possible
default_index = 0
if st.session_state.selected_campaign_id in camp_options:
    default_index = list(camp_options.keys()).index(st.session_state.selected_campaign_id)

selected_label = st.selectbox(
    "Select Campaign", 
    options=list(camp_options.values()), 
    index=default_index
)
selected_id = list(camp_options.keys())[list(camp_options.values()).index(selected_label)]

st.session_state.selected_campaign_id = selected_id

st.divider()

# ── Fetch Monitor Data ───────────────────────────────────────────────────
with st.spinner("Fetching campaign details..."):
    camp_details = APIClient.get_campaign(selected_id)
    camp_emails = APIClient.get_campaign_emails(selected_id)

if not camp_details:
    st.error("Could not load campaign details.")
    st.stop()

# ── Overview Section ─────────────────────────────────────────────────────
st.subheader(f"Overview: {camp_details.get('name')}")
st.markdown(f"**Sequence:** {camp_details.get('sequence_name')} | **Audience:** {camp_details.get('audience_name')}")

stats = camp_details.get("stats", {})
col1, col2, col3, col4, col5 = st.columns(5)
col1.metric("Status", camp_details.get("status", "unknown").upper())
col2.metric("Completion", f"{stats.get('completion_percentage', 0)}%")
col3.metric("Sent", stats.get("sent", 0))
col4.metric("Pending", stats.get("pending", 0))
col5.metric("Failed", stats.get("failed", 0))

st.progress(stats.get("completion_percentage", 0) / 100.0)

# ── Emails Table ─────────────────────────────────────────────────────────
st.subheader("Email Logs")

emails = camp_emails.get("emails", [])
if not emails:
    st.info("No emails generated yet. (They may be scheduled in the future).")
else:
    df_data = []
    for e in emails:
        df_data.append({
            "Lead Name": e.get("lead_name"),
            "Lead Email": e.get("lead_email"),
            "Step": e.get("step_order"),
            "Subject (A/B Variant)": e.get("subject_variant"),
            "Status": e.get("status"),
            "Scheduled At": e.get("scheduled_at"),
            "Sent At": e.get("sent_at") or "—",
        })
    
    df = pd.DataFrame(df_data)
    
    # Quick filter
    filter_status = st.selectbox("Filter Logs by Status", ["All", "sent", "pending", "failed"])
    if filter_status != "All":
        df = df[df["Status"] == filter_status]
        
    st.dataframe(df, use_container_width=True)
