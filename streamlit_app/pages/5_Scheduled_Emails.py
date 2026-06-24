import streamlit as st
import pandas as pd
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from services.api_client import APIClient

st.set_page_config(page_title="Scheduled Emails", page_icon="⏳", layout="wide")
st.title("⏳ Scheduled Emails")

st.markdown("View all scheduled emails across your connected accounts.")

with st.spinner("Fetching scheduled emails..."):
    scheduled_emails = APIClient.get_scheduled_emails()

if not scheduled_emails:
    st.info("No scheduled emails found.")
else:
    # Filter controls
    status_filter = st.selectbox("Filter by Status", ["All", "pending", "sent", "failed"])
    
    # Process data for display
    df_data = []
    for email in scheduled_emails:
        # Apply filter
        status = email.get("status", "unknown")
        if status_filter != "All" and status != status_filter:
            continue
            
        df_data.append({
            "Status": status.upper(),
            "Send At (UTC)": email.get("send_at"),
            "Lead ID": email.get("lead_id"),
            "Account ID": email.get("account_id"),
            "Subject": email.get("subject")
        })

    if df_data:
        df = pd.DataFrame(df_data)
        # Sort by Send At descending
        df = df.sort_values(by="Send At (UTC)", ascending=False)
        st.dataframe(df, use_container_width=True)
    else:
        st.warning(f"No emails found with status: {status_filter}")
