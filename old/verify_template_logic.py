import http.client
import json

conn = http.client.HTTPConnection("127.0.0.1", 8000)
# Test case: Template name provided, NO body, NO subject (should fetch both)
payload = json.dumps({
  "receiver": "test_template@example.com",
  "template_name": "mobbin_weekly_update"
})
headers = {
  'Content-Type': 'application/json'
}
print("Sending request with template_name only...")
conn.request("POST", "/send-email", payload, headers)
res = conn.getresponse()
data = res.read()
print(f"Status: {res.status}")
print(f"Response: {data.decode('utf-8')}")

# Test case: Template name + Subject provided (should use manual subject, fetch body)
payload2 = json.dumps({
  "receiver": "test_template_override@example.com",
  "template_name": "mobbin_weekly_update",
  "subject": "Overridden Subject"
})
print("\nSending request with template_name + subject...")
conn.request("POST", "/send-email", payload2, headers)
res2 = conn.getresponse()
data2 = res2.read()
print(f"Status: {res2.status}")
print(f"Response: {data2.decode('utf-8')}")
