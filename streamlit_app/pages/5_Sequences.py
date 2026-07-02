import streamlit as st
import pandas as pd
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from services.api_client import APIClient

st.set_page_config(page_title="Sequences", page_icon="📝", layout="wide")
st.title("📝 Sequence Management")

st.markdown("Create email sequences with multiple steps and A/B tested subject lines.")

# ── Create Sequence ──────────────────────────────────────────────────────
st.subheader("Create New Sequence")
with st.form("create_sequence_form"):
    seq_name = st.text_input("Sequence Name", placeholder="e.g., Cold Outreach - Q3")
    seq_desc = st.text_area("Description (optional)", placeholder="Describe this sequence...", height=80)
    
    if st.form_submit_button("✅ Create Sequence"):
        if not seq_name:
            st.warning("Please enter a sequence name.")
        else:
            result = APIClient.create_sequence({
                "name": seq_name,
                "description": seq_desc if seq_desc else None,
                "steps": []
            })
            if "error" in result:
                st.error(result["error"])
            else:
                st.success(f"Sequence '{seq_name}' created!")
                st.rerun()

st.divider()

# ── List & Manage Sequences ──────────────────────────────────────────────
st.subheader("Your Sequences")

with st.spinner("Fetching sequences..."):
    sequences = APIClient.get_sequences()

if not sequences:
    st.info("No sequences created yet.")
else:
    for seq in sequences:
        seq_id = seq.get("id")
        seq_name = seq.get("name", "Unnamed")
        step_count = seq.get("step_count", 0)
        
        status_badges = []
        if seq.get("is_scheduled"): status_badges.append("⏳ Active in Campaigns")
        if seq.get("is_completed"): status_badges.append("✅ Completed in Campaigns")
        badges_str = " | ".join(status_badges) if status_badges else "📝 Draft"

        with st.expander(f"**{seq_name}** ({step_count} steps) — {badges_str}", expanded=False):
            st.markdown(f"*{seq.get('description') or 'No description'}*")
            
            # Load full sequence details (steps)
            details = APIClient.get_sequence(seq_id)
            steps = details.get("steps", [])
            
            if steps:
                st.markdown("### Steps")
                for step in steps:
                    step_id = step.get("id")
                    step_order = step.get("order")
                    titles = step.get("titles", [])
                    delay = step.get("separation_days", 0)
                    
                    with st.container(border=True):
                        col1, col2 = st.columns([4, 1])
                        with col1:
                            st.markdown(f"**Step {step_order}** (Wait: {delay} days)")
                            st.markdown(f"**Subjects (A/B):** {', '.join(titles)}")
                            st.text_area("Body", step.get("body", ""), height=100, disabled=True, key=f"body_view_{step_id}")
                        with col2:
                            with st.popover("⚙️ Edit Step"):
                                with st.form(f"edit_step_{step_id}"):
                                    new_titles = st.text_input("Subjects (comma separated)", value=", ".join(titles))
                                    new_body = st.text_area("Body", value=step.get("body", ""))
                                    new_delay = st.number_input("Wait Days", min_value=0, value=delay)
                                    
                                    if st.form_submit_button("Update"):
                                        title_list = [t.strip() for t in new_titles.split(",") if t.strip()]
                                        if not title_list:
                                            st.error("At least one subject is required.")
                                        else:
                                            up_res = APIClient.update_step(seq_id, step_id, {
                                                "titles": title_list,
                                                "body": new_body,
                                                "separation_days": new_delay
                                            })
                                            if "error" in up_res:
                                                st.error(up_res["error"])
                                            else:
                                                st.success("Updated!")
                                                st.rerun()
                                                
                            if st.button("🗑️ Delete", key=f"del_step_{step_id}"):
                                del_res = APIClient.delete_step(seq_id, step_id)
                                if "error" in del_res:
                                    st.error(del_res["error"])
                                else:
                                    st.success("Deleted!")
                                    st.rerun()
            else:
                st.info("No steps added yet.")

            # Add Step Form
            with st.popover("➕ Add Step"):
                with st.form(f"add_step_{seq_id}"):
                    new_order = len(steps) + 1
                    st.markdown(f"**Add Step {new_order}**")
                    step_titles = st.text_input("Subjects (A/B testing, comma separated)")
                    step_body = st.text_area("Email Body (HTML/Text)", height=150)
                    step_delay = st.number_input("Days to wait after previous step", min_value=0, value=0)
                    
                    if st.form_submit_button("Save Step"):
                        title_list = [t.strip() for t in step_titles.split(",") if t.strip()]
                        if not title_list:
                            st.warning("Please provide at least one subject.")
                        elif not step_body:
                            st.warning("Please provide an email body.")
                        else:
                            res = APIClient.add_step(seq_id, {
                                "order": new_order,
                                "titles": title_list,
                                "body": step_body,
                                "separation_days": step_delay
                            })
                            if "error" in res:
                                st.error(res["error"])
                            else:
                                st.success("Step added!")
                                st.rerun()

            st.markdown("---")
            col_a, col_b = st.columns(2)
            with col_a:
                # Edit Sequence Meta
                with st.popover("✏️ Edit Sequence Info"):
                    with st.form(f"edit_seq_{seq_id}"):
                        e_name = st.text_input("Name", value=seq_name)
                        e_desc = st.text_area("Description", value=seq.get("description") or "")
                        if st.form_submit_button("Save Info"):
                            if e_name:
                                APIClient.update_sequence(seq_id, {"name": e_name, "description": e_desc})
                                st.rerun()
            with col_b:
                if st.button("🗑️ Delete Sequence", key=f"del_seq_{seq_id}"):
                    del_res = APIClient.delete_sequence(seq_id)
                    if "error" in del_res:
                        st.error(del_res["error"])
                    else:
                        st.success("Sequence deleted!")
                        st.rerun()
