import http.client
import json

conn = http.client.HTTPConnection("127.0.0.1", 8000)
payload = json.dumps({
  "receiver": "test@example.com",
  "subject": "Test Default Sender",
  "body": "This is a test to verify default sender."
})
headers = {
  'Content-Type': 'application/json'
}
conn.request("POST", "/send-email", payload, headers)
res = conn.getresponse()
data = res.read()
print(res.status)
print(data.decode("utf-8"))
