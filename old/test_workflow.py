import requests
import json
import time

BASE_URL = "http://127.0.0.1:8000"
SENDER = "bhagrajyotibehera91923118@gmail.com"
RECEIVER = "bhagrajyotibehera91923118@gmail.com"

def test_create_template():
    print("Testing Template Creation...")
    payload = {
        "name": "test_template_v1",
        "subject": "Test Subject",
        "body": "<h1>Hello World</h1>"
    }
    try:
        response = requests.post(f"{BASE_URL}/templates/create", json=payload)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text}")
    except Exception as e:
        print(f"Error: {e}")

def test_list_templates():
    print("\nTesting List Templates...")
    try:
        response = requests.get(f"{BASE_URL}/templates")
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            templates = response.json().get("templates", [])
            found = any(t.get('name') == "test_template_v1" for t in templates)
            print(f"Template found: {found}")
            print(f"Templates count: {len(templates)}")
        else:
            print(f"Failed to list templates: {response.text}")
    except Exception as e:
        print(f"Error: {e}")

def test_send_email():
    print("\nTesting Send Email...")
    payload = {
        "sender": SENDER,
        "receiver": RECEIVER,
        "subject": "Direct Test Email",
        "body": "This is a direct test email."
    }
    try:
        response = requests.post(f"{BASE_URL}/send-email", json=payload)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_create_template()
    time.sleep(2) # Wait for eventual consistency
    test_list_templates()
    test_send_email()
