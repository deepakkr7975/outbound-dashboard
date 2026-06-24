import streamlit as st

st.set_page_config(
    page_title="Email Outreach MVP",
    page_icon="📧",
    layout="wide",
)

st.title("Welcome to Email Outreach MVP 📧")

st.markdown("""
### Simple, Efficient, and Effective Email Automation

Use the sidebar on the left to navigate through the platform:
- **Dashboard**: View high-level metrics of your outreach operations.
- **Email Accounts**: Connect and manage your Gmail sender accounts.
- **Leads**: Upload CSVs and view your prospective contacts.
- **Bulk Schedule**: Compose messages and schedule them for automatic delivery.
- **Scheduled Emails**: Track the status of emails waiting in the queue or already sent.

---

> **Note**: This is the MVP frontend built with Streamlit, talking seamlessly to our FastAPI backend and AWS infrastructure.
""")

st.info("👈 Select a page from the sidebar to get started.")
