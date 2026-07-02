import streamlit as st
import pandas as pd
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from services.api_client import APIClient

st.set_page_config(page_title="Leads", page_icon="👥", layout="wide")
st.title("👥 Leads Management")

# Upload Section
st.subheader("Upload Leads CSV")
uploaded_file = st.file_uploader("Choose a CSV file", type="csv")

if uploaded_file is not None:
    if st.button("Upload to Database"):
        with st.spinner("Uploading..."):
            file_bytes = uploaded_file.getvalue()
            result = APIClient.upload_leads(file_bytes, uploaded_file.name)
            
            if "error" in result:
                st.error(f"Upload failed: {result['error']}")
            else:
                num = result.get('num_leads', 0)
                name = result.get('lead_name', 'Unknown')
                st.success(f"Successfully uploaded {num} leads into list '{name}'!")

st.markdown("---")

# View Leads Section
st.subheader("Your Leads")

with st.spinner("Fetching leads..."):
    leads = APIClient.get_leads()

if not leads:
    st.info("No leads found. Please upload a CSV.")
else:
    # Search functionality
    search_query = st.text_input("Search leads by Name, Company, or Email", "")
    
    # Filter logic
    filtered_leads = []
    for lead in leads:
        name = str(lead.get("name", "")).lower()
        company = str(lead.get("company", "")).lower()
        email = str(lead.get("email", "")).lower()
        q = search_query.lower()
        
        if q in name or q in company or q in email:
            filtered_leads.append({
                "Name": lead.get("name"),
                "Email": lead.get("email"),
                "Company": lead.get("company")
            })

    if filtered_leads:
        df = pd.DataFrame(filtered_leads)
        st.dataframe(df, use_container_width=True)
    else:
        st.warning("No leads match your search query.")
