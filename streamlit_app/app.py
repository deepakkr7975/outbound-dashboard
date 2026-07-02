import streamlit as st

st.set_page_config(
    page_title="Email Automation Platform",
    page_icon="📧",
    layout="wide",
)

st.title("Welcome to the Email Automation Platform 🚀")

st.markdown("""
### Powerful, Scalable Email Outreach

Use the sidebar on the left to navigate through the platform:
- **Dashboard**: View high-level metrics of your outreach operations.
- **Sender Emails**: Connect and manage your Gmail sender accounts, signatures, and daily limits.
- **Leads**: Upload CSVs and view your prospective contacts.
- **Audience**: Group your leads into targeted audiences.
- **Sequences**: Build multi-step email sequences with A/B subject variants and automated delays.
- **Campaigns**: Launch campaigns that automatically distribute emails across your sender pool and follow up over time.
- **Campaign Monitor**: Track real-time progress, view analytics, and inspect detailed email logs for your running campaigns.

---

> **Note**: This frontend is built with Streamlit, talking seamlessly to our FastAPI backend and AWS DynamoDB infrastructure.
""")

st.info("👈 Select a page from the sidebar to get started.")
