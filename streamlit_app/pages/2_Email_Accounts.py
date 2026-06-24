import streamlit as st
import pandas as pd
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from services.api_client import APIClient

st.set_page_config(page_title="Email Accounts", page_icon="🔑", layout="wide")
st.title("🔑 Email Accounts")

st.markdown("Manage your connected Gmail accounts here.")

# Connect New Gmail Account section
st.subheader("Add Account")
if st.button("Connect New Gmail"):
    auth_url = APIClient.connect_email()
    if auth_url:
        st.success("Authorization URL generated!")
        st.markdown(f"[Click here to authenticate with Google]({auth_url})")
    else:
        st.error("Failed to generate authorization URL. Please check the backend.")

st.markdown("---")

# List Connected Accounts
st.subheader("Connected Accounts")
with st.spinner("Fetching accounts..."):
    accounts = APIClient.get_email_accounts()

if not accounts:
    st.info("No email accounts connected yet.")
else:
    # Prepare data for dataframe
    df_data = []
    for acc in accounts:
        df_data.append({
            "Email": acc.get("email"),
            "Status": "✅ Active" if acc.get("is_active") else "❌ Inactive",
            "Daily Limit": acc.get("daily_limit"),
            "Sent Today": acc.get("sent_today")
        })
    
    df = pd.DataFrame(df_data)
    st.dataframe(df, use_container_width=True)
