import boto3
import os
from dotenv import load_dotenv

load_dotenv(override=True)

AWS_REGION = os.getenv("AWS_REGION") or os.getenv("AWS_DEFAULT_REGION")
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")
TABLE_NAME = os.getenv("EMAIL_TEMPLATES_TABLE")

dynamodb = boto3.resource(
    "dynamodb",
    region_name=AWS_REGION,
    aws_access_key_id=AWS_ACCESS_KEY_ID,
    aws_secret_access_key=AWS_SECRET_ACCESS_KEY
)

table = dynamodb.Table(TABLE_NAME)

# Mobbin-style HTML Template
html_body = """
<!DOCTYPE html>
<html>
<head>
<style>
  body { font-family: Helvetica, Arial, sans-serif; background-color: #ffffff; margin: 0; padding: 0; }
  .container { max-width: 600px; margin: 0 auto; padding: 20px; }
  .header { margin-bottom: 30px; }
  .logo { width: 40px; height: 40px; background-color: #000; border-radius: 8px; } /* Placeholder for Mobbin logo */
  .title { font-size: 24px; font-weight: bold; color: #000; margin-bottom: 10px; }
  .subtitle { font-size: 16px; color: #666; margin-bottom: 30px; }
  .card { margin-bottom: 40px; border-radius: 16px; overflow: hidden; border: 1px solid #eee; }
  .card-img { width: 100%; height: auto; display: block; }
  .card-content { padding: 20px; }
  .app-icon { width: 40px; height: 40px; border-radius: 8px; margin-right: 10px; vertical-align: middle; }
  .app-name { font-weight: bold; font-size: 18px; vertical-align: middle; }
  .headline { font-size: 28px; font-weight: bold; margin: 15px 0; }
  .description { font-size: 16px; color: #666; line-height: 1.5; }
  .footer { font-size: 12px; color: #999; margin-top: 50px; text-align: center; }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <!-- Mobbin Logo Placeholder -->
    <img src="https://via.placeholder.com/40x40/000000/ffffff?text=M" alt="Mobbin" class="logo">
  </div>

  <div class="title">New mobile apps on Mobbin this week.</div>
  <div class="subtitle">Featuring AllTrails, Hatch Sleep, Binance, and 3 more.</div>

  <!-- Card 1: AllTrails -->
  <div class="card">
    <div style="background-color: #f0fdf4; padding: 20px;">
       <div style="margin-bottom: 15px;">
         <img src="https://via.placeholder.com/40?text=A" class="app-icon">
         <span class="app-name">AllTrails</span>
       </div>
       <img src="https://via.placeholder.com/500x300/e6ffe6/000000?text=AllTrails+App+Screen" class="card-img" style="border-radius: 12px;">
       <div class="headline">Hike, bike & run</div>
    </div>
    <div class="card-content">
      <div class="description">AllTrails is your companion and guide to the outdoors.</div>
    </div>
  </div>

  <!-- Card 2: Hatch Sleep -->
  <div class="card">
    <div style="background-color: #000000; padding: 20px; color: white;">
       <div style="margin-bottom: 15px;">
         <img src="https://via.placeholder.com/40?text=H" class="app-icon">
         <span class="app-name" style="color:white;">Hatch Sleep</span>
       </div>
       <img src="https://via.placeholder.com/500x300/111111/ffffff?text=Hatch+App+Screen" class="card-img" style="border-radius: 12px;">
       <div class="headline">Better sleep for everyone</div>
    </div>
    <div class="card-content">
      <div class="description">Hatch offers a variety of devices to help you sleep better night after night.</div>
    </div>
  </div>

  <!-- Card 3: Binance -->
  <div class="card">
    <div style="background-color: #fcfcfc; padding: 20px;">
       <div style="margin-bottom: 15px;">
         <img src="https://via.placeholder.com/40?text=B" class="app-icon">
         <span class="app-name">Binance</span>
       </div>
       <img src="https://via.placeholder.com/500x300/f0f0f0/000000?text=Binance+App+Screen" class="card-img" style="border-radius: 12px;">
       <div class="headline">Crypto exchange & wallet</div>
    </div>
    <div class="card-content">
      <div class="description">Binance is the world's largest cryptoasset marketplace.</div>
    </div>
  </div>

  <div class="footer">
    <p>&copy; 2025 Mobbin. Unsubscribe</p>
  </div>
</div>
</body>
</html>
"""

item = {
    "name": "mobbin_weekly_update",
    "subject": "Monday Mobile Drop",
    "body": html_body
}

print("Inserting template...")
try:
    table.put_item(Item=item)
    print("Success! Template 'mobbin_weekly_update' added.")
except Exception as e:
    print(f"Error: {e}")
