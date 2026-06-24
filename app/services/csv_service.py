import pandas as pd
from typing import List, Dict
import io

def parse_leads_csv(file_content: bytes) -> List[Dict[str, str]]:
    """
    Parses a CSV file containing leads.
    Expects columns: name, email, company
    """
    df = pd.read_csv(io.BytesIO(file_content))
    
    # Clean up column names (lowercase, strip whitespace)
    df.columns = df.columns.str.strip().str.lower()
    
    required_columns = {'name', 'email', 'company'}
    if not required_columns.issubset(set(df.columns)):
        raise ValueError(f"CSV must contain the following columns: {required_columns}")
        
    # Drop rows where essential fields are missing
    df = df.dropna(subset=['email'])
    
    leads = []
    for _, row in df.iterrows():
        leads.append({
            "name": str(row.get('name', '')),
            "email": str(row['email']).strip(),
            "company": str(row.get('company', ''))
        })
        
    return leads
