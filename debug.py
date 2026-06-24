import os
from dotenv import load_dotenv
load_dotenv()
print("ID:", os.getenv("AWS_ACCESS_KEY_ID"))
