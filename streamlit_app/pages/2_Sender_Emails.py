import streamlit as st
import pandas as pd
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from services.api_client import APIClient

st.set_page_config(page_title="Sender Emails", page_icon="📧", layout="wide")
st.title("📧 Sender Emails")

st.markdown("Manage your connected Gmail accounts, signatures, and campaign links.")

# ── Connect New Account ──────────────────────────────────────────────────
st.subheader("Add Sender Email")
if st.button("🔗 Connect New Gmail"):
    auth_url = APIClient.connect_email()
    if auth_url:
        st.success("Authorization URL generated!")
        st.markdown(f"[Click here to authenticate with Google]({auth_url})")
    else:
        st.error("Failed to generate authorization URL. Please check the backend.")

st.divider()

# ── Connected Accounts ───────────────────────────────────────────────────
st.subheader("Connected Accounts")
with st.spinner("Fetching accounts..."):
    accounts = APIClient.get_email_accounts()

if not accounts:
    st.info("No email accounts connected yet.")
else:
    for acc in accounts:
        acc_id = acc.get("account_id")
        email = acc.get("email", "Unknown")
        is_linked = acc.get("is_linked", False)
        linked_count = acc.get("linked_campaign_count", 0)

        status_badge = "🟢 Free" if not is_linked else f"🔗 Linked ({linked_count} campaigns)"

        with st.expander(f"**{email}** — {status_badge}", expanded=False):
            col1, col2, col3, col4 = st.columns(4)
            with col1:
                st.metric("Daily Limit", acc.get("daily_limit", 30))
            with col2:
                st.metric("Sent Today", acc.get("sent_today", 0))
            with col3:
                st.metric("Status", "✅ Active" if acc.get("is_active") else "❌ Inactive")
            with col4:
                connected_at_utc = acc.get("connected_at")
                if connected_at_utc:
                    try:
                        from datetime import datetime
                        dt_utc = datetime.fromisoformat(connected_at_utc.replace("Z", "+00:00"))
                        local_dt = dt_utc.astimezone()
                        connected_at_str = local_dt.strftime("%Y-%m-%d %I:%M %p")
                    except Exception:
                        connected_at_str = "Unknown"
                else:
                    connected_at_str = "Unknown"
                
                st.metric("Connected At", connected_at_str)

            st.markdown("---")

            # ── Domain Settings ──────────────────────────────────────
            st.markdown("**🌐 Domain Settings**")
            domain = acc.get("domain") or ""
            domain_name = acc.get("domain_name") or ""

            col_d1, col_d2 = st.columns(2)
            with col_d1:
                st.text_input("Domain (Read-Only)", value=domain, disabled=True, key=f"domain_ro_{acc_id}")
            with col_d2:
                new_domain_name = st.text_input("Domain Name", value=domain_name, key=f"domain_name_{acc_id}")

            if st.button("💾 Save Domain Settings", key=f"save_domain_{acc_id}"):
                if new_domain_name != domain_name:
                    result = APIClient.update_email_account(acc_id, {"domain_name": new_domain_name})
                    if "error" in result:
                        st.error(result["error"])
                    else:
                        st.success("Domain settings updated!")
                        st.rerun()
                else:
                    st.info("No changes made.")

            st.markdown("---")

            # ── Signature Section ────────────────────────────────────
            st.markdown("**📝 Email Signature**")
            sig_name = acc.get("signature_name") or ""
            sig_title = acc.get("signature_title") or ""
            sig_company = acc.get("signature_company") or ""
            sig_phone = acc.get("signature_phone") or ""
            sig_html = acc.get("signature_html") or ""

            with st.form(f"sig_form_{acc_id}"):
                new_name = st.text_input("Name", value=sig_name, key=f"sig_name_{acc_id}")
                new_title = st.text_input("Job Title", value=sig_title, key=f"sig_title_{acc_id}")
                new_company = st.text_input("Company", value=sig_company, key=f"sig_company_{acc_id}")
                new_phone = st.text_input("Phone", value=sig_phone, key=f"sig_phone_{acc_id}")
                new_html = st.text_area(
                    "Custom HTML Signature (overrides above fields)",
                    value=sig_html,
                    key=f"sig_html_{acc_id}",
                    height=100
                )

                if st.form_submit_button("💾 Save Signature"):
                    sig_data = {}
                    if new_name: sig_data["signature_name"] = new_name
                    if new_title: sig_data["signature_title"] = new_title
                    if new_company: sig_data["signature_company"] = new_company
                    if new_phone: sig_data["signature_phone"] = new_phone
                    if new_html: sig_data["signature_html"] = new_html

                    if sig_data:
                        result = APIClient.update_signature(acc_id, sig_data)
                        if "error" in result:
                            st.error(result["error"])
                        else:
                            st.success("Signature updated!")
                            st.rerun()
                    else:
                        st.warning("Please fill in at least one signature field.")

            # ── Linked Campaigns ─────────────────────────────────────
            if is_linked:
                linked_data = APIClient.get_linked_campaigns(acc_id)
                linked_campaigns = linked_data.get("linked_campaigns", [])
                if linked_campaigns:
                    st.markdown("**🔗 Linked Campaigns:**")
                    for lc in linked_campaigns:
                        st.markdown(f"- {lc.get('name', 'Unnamed')} — `{lc.get('status')}`")

            # ── Delete ───────────────────────────────────────────────
            st.markdown("---")
            if st.button(f"🗑️ Delete Account", key=f"del_{acc_id}"):
                result = APIClient.delete_email_account(acc_id)
                if "error" in result:
                    st.error(result["error"])
                else:
                    st.success("Account deleted!")
                    st.rerun()
