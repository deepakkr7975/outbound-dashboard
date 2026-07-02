import os
from dotenv import load_dotenv
from app.database.connection import dynamodb

load_dotenv()

def clear_table(table_name):
    print(f"Clearing table: {table_name}")
    try:
        table = dynamodb.Table(table_name)
        
        # Scan all items
        response = table.scan()
        items = response.get('Items', [])
        
        while 'LastEvaluatedKey' in response:
            response = table.scan(ExclusiveStartKey=response['LastEvaluatedKey'])
            items.extend(response.get('Items', []))
            
        if not items:
            print(f"No items to delete in {table_name}")
            return
            
        print(f"Found {len(items)} items. Deleting...")
        
        # Batch delete items
        with table.batch_writer() as batch:
            for item in items:
                batch.delete_item(
                    Key={
                        'id': item['id']
                    }
                )
        print(f"Successfully cleared {table_name}")
    except Exception as e:
        print(f"Error clearing {table_name}: {e}")

if __name__ == "__main__":
    tables = [
        "leads", "scheduled_emails", "email_accounts", "sequences", 
        "sequence_steps", "campaigns", "campaign_emails", "audiences", "email_logs"
    ]
    for table in tables:
        clear_table(os.getenv(f"{table.upper()}_TABLE", table))
