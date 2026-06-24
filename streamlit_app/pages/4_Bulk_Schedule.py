import streamlit as st
import datetime
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from services.api_client import APIClient

st.set_page_config(page_title="Bulk Schedule", page_icon="📅", layout="wide")
st.title("📅 Bulk Schedule Emails")

st.markdown("Compose your email and schedule it for multiple leads.")

with st.spinner("Loading accounts and leads..."):
    accounts = APIClient.get_email_accounts()
    leads = APIClient.get_leads()

active_accounts = [acc for acc in accounts if acc.get("is_active")]

if not active_accounts:
    st.error("You need at least one active email account to schedule emails. Please connect an account in the Email Accounts page.")
elif not leads:
    st.error("No leads found. Please upload leads in the Leads page.")
else:
    # Prepare dropdown options
    account_options = {acc["account_id"]: acc["email"] for acc in active_accounts}
    lead_options = {lead["id"]: f"{lead.get('name', 'Unknown')} ({lead.get('email', 'No Email')})" for lead in leads}
    
    with st.form("schedule_form"):
        # Select Account
        selected_account_name = st.selectbox(
            "Select Sender Account", 
            options=list(account_options.values())
        )
        # Reverse lookup for account ID
        selected_account_id = next(acc_id for acc_id, email in account_options.items() if email == selected_account_name)
        
        # Select Leads
        selected_lead_names = st.multiselect(
            "Select Target Leads",
            options=list(lead_options.values()),
            help="Select one or more leads to send this email to."
        )
        # Reverse lookup for lead IDs
        selected_lead_ids = [lead_id for lead_id, name in lead_options.items() if name in selected_lead_names]

        # Email Content
        subject = st.text_input("Subject", placeholder="e.g., Quick Question")
        body = st.text_area("Body", placeholder="Hi {{name}}, ...", height=200)
        
        # Schedule Time
        col1, col2 = st.columns(2)
        with col1:
            send_date = st.date_input("Send Date", min_value=datetime.date.today())
        with col2:
            send_time = st.time_input("Send Time")
            
        submitted = st.form_submit_button("Schedule Emails")
        
        if submitted:
            if not selected_lead_ids:
                st.warning("Please select at least one lead.")
            elif not subject or not body:
                st.warning("Subject and body cannot be empty.")
            else:
                # Combine date and time
                send_datetime = datetime.datetime.combine(send_date, send_time)
                # Convert to UTC ISO format. For simplicity, we'll assume the naive datetime is local and we just append Z (or timezone info if known).
                # Actually, AWS expects a standard ISO format. Let's force it to UTC for now.
                iso_send_at = send_datetime.isoformat() + "Z"
                
                with st.spinner("Scheduling..."):
                    result = APIClient.bulk_schedule(
                        account_id=selected_account_id,
                        lead_ids=selected_lead_ids,
                        subject=subject,
                        body=body,
                        send_at=iso_send_at
                    )
                    
                    if "error" in result:
                        st.error(f"Failed to schedule: {result['error']}")
                    else:
                        st.success(f"Successfully scheduled {result.get('scheduled_count', len(selected_lead_ids))} emails!")
