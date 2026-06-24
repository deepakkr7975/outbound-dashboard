import requests
import time

BASE_URL = "http://127.0.0.1:8000"

def test_fetch_emails():
    print("\nTesting Fetch Emails...")
    try:
        response = requests.get(f"{BASE_URL}/emails/fetch?filter_type=received&max_results=5")
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"Count: {data['count']}")
            if data['emails']:
                print(f"Sample Email: {data['emails'][0]['subject']}")
        else:
            print(f"Error: {response.text}")
    except Exception as e:
        print(f"Exception: {e}")

def test_unique_contacts():
    print("\nTesting Unique Contacts...")
    try:
        response = requests.get(f"{BASE_URL}/emails/unique-contacts?type=received")
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"Unique Contacts Count: {data['count']}")
            print(f"Contacts: {data['contacts'][:5]}")
        else:
            print(f"Error: {response.text}")
    except Exception as e:
        print(f"Exception: {e}")

def test_export_data():
    print("\nTesting Export Data...")
    try:
        response = requests.get(f"{BASE_URL}/backup/export?format=csv")
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            print("CSV Content Start:")
            print(response.text[:200])
        else:
            print(f"Error: {response.text}")
    except Exception as e:
        print(f"Exception: {e}")

def test_auth_login():
    print("\nTesting Auth Login...")
    try:
        response = requests.get(f"{BASE_URL}/auth/login")
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"Auth URL: {data['auth_url'][:50]}...")
        else:
            print(f"Error: {response.text}")
    except Exception as e:
        print(f"Exception: {e}")

if __name__ == "__main__":
    test_auth_login()
    test_fetch_emails()
    test_unique_contacts()
    test_export_data()
