import pandas as pd
from typing import List, Dict
import io

def parse_leads_csv(file_content: bytes) -> List[Dict[str, str]]:
    """
    Parses a CSV file containing leads.
    Requires columns: name, email, company.
    Preserves ALL extra columns (e.g. phone, role, title) so they are
    available as mail-merge variables at send time.
    """
    df = pd.read_csv(io.BytesIO(file_content))

    # Clean up column names (lowercase, strip whitespace)
    df.columns = df.columns.str.strip().str.lower()

    required_columns = {'name', 'email', 'company'}
    if not required_columns.issubset(set(df.columns)):
        raise ValueError(f"CSV must contain the following columns: {required_columns}")

    # Drop rows where the email is missing
    df = df.dropna(subset=['email'])

    # Fill remaining NaN values with empty strings to avoid 'nan' in output
    df = df.fillna('')

    leads = []
    for _, row in df.iterrows():
        # Start with all columns so extra fields (phone, role, etc.) are included
        lead = {col: str(row[col]).strip() for col in df.columns}
        # Ensure email is cleanly stripped (already done above, belt-and-suspenders)
        lead['email'] = lead['email'].strip()
        leads.append(lead)

    return leads
