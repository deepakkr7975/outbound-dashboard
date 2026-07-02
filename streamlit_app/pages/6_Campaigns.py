import streamlit as st
import pandas as pd
from datetime import datetime, timedelta
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from services.api_client import APIClient

st.set_page_config(page_title="Campaigns", page_icon="🚀", layout="wide")
st.title("🚀 Campaign Management")

st.markdown("Launch and monitor your email automation campaigns.")

# ── Create Campaign ──────────────────────────────────────────────────────
st.subheader("Create New Campaign")

with st.spinner("Loading dependencies..."):
    audiences = APIClient.get_audiences()
    sequences = APIClient.get_sequences()
    accounts = APIClient.get_email_accounts()

if not audiences or not sequences or not accounts:
    st.warning("You need at least one Audience, Sequence, and Email Account to create a campaign.")
else:
    with st.expander("➕ New Campaign Setup", expanded=False):
        with st.form("create_campaign_form"):
            c_name = st.text_input("Campaign Name", placeholder="e.g., Q3 Founder Outreach")
            c_desc = st.text_area("Description (optional)", placeholder="Internal notes about this campaign...")
            
            col1, col2 = st.columns(2)
            with col1:
                # Audience Dropdown
                aud_options = {a["id"]: f"{a.get('name', 'Unnamed')} ({a.get('member_count', 0)} leads)" for a in audiences}
                selected_aud_label = st.selectbox("Select Audience", options=list(aud_options.values()))
                selected_aud_id = next((k for k, v in aud_options.items() if v == selected_aud_label), None)
                
                # Sequence Dropdown
                seq_options = {s["id"]: f"{s.get('name', 'Unnamed')} ({s.get('step_count', 0)} steps)" for s in sequences}
                selected_seq_label = st.selectbox("Select Sequence", options=list(seq_options.values()))
                selected_seq_id = next((k for k, v in seq_options.items() if v == selected_seq_label), None)

            with col2:
                # Senders Multiselect
                acc_options = {a["account_id"]: f"{a.get('email')} (Limit: {a.get('daily_limit')})" for a in accounts if a.get("is_active")}
                selected_acc_labels = st.multiselect("Select Sender Accounts (Pool)", options=list(acc_options.values()))
                selected_acc_ids = [k for k, v in acc_options.items() if v in selected_acc_labels]
                
                # Schedule At
                min_time = datetime.now()
                c_date = st.date_input("Start Date", value=min_time.date())
                c_time = st.time_input("Start Time", value=(min_time + timedelta(minutes=5)).time())
            
            if st.form_submit_button("Launch Campaign"):
                if not c_name or not selected_aud_id or not selected_seq_id or not selected_acc_ids:
                    st.warning("Please fill in all required fields (Name, Audience, Sequence, Senders).")
                else:
                    schedule_dt = datetime.combine(c_date, c_time).isoformat()
                    res = APIClient.create_campaign({
                        "name": c_name,
                        "description": c_desc if c_desc else None,
                        "sender_email_ids": selected_acc_ids,
                        "sequence_id": selected_seq_id,
                        "audience_id": selected_aud_id,
                        "schedule_at": schedule_dt
                    })
                    if "error" in res:
                        st.error(res["error"])
                    else:
                        st.success(f"Campaign '{c_name}' created successfully!")
                        st.rerun()

st.divider()

# ── List Campaigns ───────────────────────────────────────────────────────
st.subheader("Your Campaigns")

col_f1, col_f2 = st.columns(2)
with col_f1:
    filter_status = st.selectbox("Filter Status", ["All", "draft", "scheduled", "running", "paused", "completed", "cancelled", "failed"])
with col_f2:
    filter_name = st.text_input("Search Name")

with st.spinner("Fetching campaigns..."):
    status_arg = filter_status if filter_status != "All" else None
    campaigns = APIClient.get_campaigns(name=filter_name if filter_name else None, status=status_arg)

if not campaigns:
    st.info("No campaigns found.")
else:
    for camp in campaigns:
        c_id = camp.get("id")
        c_name = camp.get("name", "Unnamed")
        c_status = camp.get("status", "unknown")
        
        status_colors = {
            "draft": "⚪", "scheduled": "🟡", "running": "🔵", 
            "paused": "🟠", "completed": "🟢", "cancelled": "⚫", "failed": "🔴"
        }
        icon = status_colors.get(c_status, "⚪")
        
        pct = camp.get("completion_percentage", 0)
        
        with st.expander(f"{icon} **{c_name}** — {c_status.upper()} ({pct}%)", expanded=False):
            st.markdown(f"*{camp.get('description') or 'No description'}*")
            
            # Quick Stats
            c1, c2, c3, c4 = st.columns(4)
            c1.metric("Current Step", f"{camp.get('current_step_order', 0)} / {camp.get('total_steps', 0)}")
            c2.metric("Sent", camp.get("sent", 0))
            c3.metric("Pending", camp.get("pending", 0))
            c4.metric("Failed", camp.get("failed", 0))
            
            st.progress(pct / 100.0)
            
            # Action Buttons
            col_a, col_b, col_c, col_d = st.columns(4)
            
            # Pause / Resume
            with col_a:
                if c_status == "running":
                    if st.button("⏸ Pause", key=f"pause_{c_id}"):
                        res = APIClient.pause_campaign(c_id)
                        if "error" in res: st.error(res["error"])
                        else: st.rerun()
                elif c_status == "paused":
                    if st.button("▶️ Resume", key=f"resume_{c_id}"):
                        res = APIClient.resume_campaign(c_id)
                        if "error" in res: st.error(res["error"])
                        else: st.rerun()
            
            # Cancel
            with col_b:
                if c_status in ("scheduled", "running", "paused", "draft"):
                    if st.button("⏹ Cancel", key=f"cancel_{c_id}"):
                        res = APIClient.cancel_campaign(c_id)
                        if "error" in res: st.error(res["error"])
                        else: st.rerun()
            
            # Delete
            with col_c:
                if st.button("🗑️ Delete", key=f"del_{c_id}"):
                    res = APIClient.delete_campaign(c_id)
                    if "error" in res: st.error(res["error"])
                    else:
                        st.success("Deleted!")
                        st.rerun()

            # View Details
            with col_d:
                if st.button("📊 Monitor", key=f"mon_{c_id}"):
                    # We can store the selected campaign in session state and navigate to Monitor
                    st.session_state.selected_campaign_id = c_id
                    st.switch_page("pages/7_Campaign_Monitor.py")
