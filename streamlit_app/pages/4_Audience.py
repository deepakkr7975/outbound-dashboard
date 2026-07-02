import streamlit as st
import pandas as pd
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from services.api_client import APIClient

st.set_page_config(page_title="Audience", page_icon="👥", layout="wide")
st.title("👥 Audience Management")

st.markdown("Create and manage named groups of leads for your campaigns.")

# ── Create Audience ──────────────────────────────────────────────────────
st.subheader("Create New Audience")

with st.spinner("Loading leads..."):
    leads = APIClient.get_leads()

if not leads:
    st.warning("No leads available. Upload leads in the Leads page first.")
else:
    with st.form("create_audience_form"):
        aud_name = st.text_input("Audience Name", placeholder="e.g., Tech Startups Q3")
        aud_desc = st.text_area("Description (optional)", placeholder="Describe this audience...", height=80)

        lead_options = {
            lead["id"]: f"{lead.get('name', 'Unknown')} ({lead.get('email', 'No Email')}) — {lead.get('company', '')}"
            for lead in leads
        }
        selected_lead_labels = st.multiselect(
            "Select Leads",
            options=list(lead_options.values()),
            help="Pick leads to add to this audience."
        )
        selected_lead_ids = [
            lid for lid, label in lead_options.items()
            if label in selected_lead_labels
        ]

        if st.form_submit_button("✅ Create Audience"):
            if not aud_name:
                st.warning("Please enter an audience name.")
            elif not selected_lead_ids:
                st.warning("Please select at least one lead.")
            else:
                result = APIClient.create_audience({
                    "name": aud_name,
                    "description": aud_desc if aud_desc else None,
                    "lead_ids": selected_lead_ids
                })
                if "error" in result:
                    st.error(result["error"])
                else:
                    st.success(f"Audience '{aud_name}' created with {len(selected_lead_ids)} members!")
                    st.rerun()

st.divider()

# ── List Audiences ───────────────────────────────────────────────────────
st.subheader("Your Audiences")

with st.spinner("Fetching audiences..."):
    audiences = APIClient.get_audiences()

if not audiences:
    st.info("No audiences created yet.")
else:
    for aud in audiences:
        aud_id = aud.get("id")
        aud_name = aud.get("name", "Unnamed")
        member_count = aud.get("member_count", 0)

        with st.expander(f"**{aud_name}** — {member_count} members", expanded=False):
            st.markdown(f"*{aud.get('description') or 'No description'}*")
            st.caption(f"Created: {aud.get('created_at', '—')} | Updated: {aud.get('updated_at', '—')}")

            # Load full audience details with members
            if st.button(f"📋 View Members", key=f"view_{aud_id}"):
                with st.spinner("Loading members..."):
                    details = APIClient.get_audience(aud_id)
                    members = details.get("members", [])

                if members:
                    df_data = []
                    for m in members:
                        df_data.append({
                            "Name": m.get("name"),
                            "Email": m.get("email"),
                            "Company": m.get("company"),
                            "Sent": m.get("sent", 0),
                            "Pending": m.get("pending", 0),
                            "Failed": m.get("failed", 0),
                            "Opened": m.get("opened") or "—",
                            "Clicked": m.get("clicked") or "—",
                            "Replied": m.get("replied") or "—",
                        })
                    df = pd.DataFrame(df_data)
                    st.dataframe(df, use_container_width=True)
                else:
                    st.info("No members in this audience.")

            # ── Edit Audience ────────────────────────────────────────
            with st.form(f"edit_form_{aud_id}"):
                new_name = st.text_input("Rename", value=aud_name, key=f"edit_name_{aud_id}")
                new_desc = st.text_input("Description", value=aud.get("description") or "", key=f"edit_desc_{aud_id}")

                if st.form_submit_button("💾 Update"):
                    update_data = {}
                    if new_name != aud_name:
                        update_data["name"] = new_name
                    if new_desc != (aud.get("description") or ""):
                        update_data["description"] = new_desc

                    if update_data:
                        result = APIClient.update_audience(aud_id, update_data)
                        if "error" in result:
                            st.error(result["error"])
                        else:
                            st.success("Audience updated!")
                            st.rerun()
                    else:
                        st.info("No changes detected.")

            # ── Delete ───────────────────────────────────────────────
            if st.button(f"🗑️ Delete Audience", key=f"del_{aud_id}"):
                result = APIClient.delete_audience(aud_id)
                if "error" in result:
                    st.error(result["error"])
                else:
                    if result.get("warning"):
                        st.warning(result["warning"])
                    st.success("Audience deleted!")
                    st.rerun()
