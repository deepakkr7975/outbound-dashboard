import os
from typing import List, Dict, Any
from botocore.exceptions import ClientError
from app.database.connection import dynamodb

def get_table(table_env_var: str, default_name: str):
    return dynamodb.Table(os.getenv(table_env_var, default_name))

# Generic DynamoDB operations
def put_item(table_name: str, item: Dict[str, Any]):
    table = get_table(f"{table_name.upper()}_TABLE", table_name)
    table.put_item(Item=item)

def get_item(table_name: str, key: Dict[str, Any]) -> Dict[str, Any]:
    table = get_table(f"{table_name.upper()}_TABLE", table_name)
    response = table.get_item(Key=key)
    return response.get("Item")

def update_item(table_name: str, key: Dict[str, Any], update_expression: str, expression_values: Dict[str, Any], expression_names: Dict[str, str] = None, condition_expression: str = None):
    """
    Returns True on success. If condition_expression is provided and the
    condition fails, returns False instead of raising.
    """
    table = get_table(f"{table_name.upper()}_TABLE", table_name)
    kwargs = {
        "Key": key,
        "UpdateExpression": update_expression,
        "ExpressionAttributeValues": expression_values
    }
    if expression_names:
        kwargs["ExpressionAttributeNames"] = expression_names
    if condition_expression:
        kwargs["ConditionExpression"] = condition_expression
    try:
        table.update_item(**kwargs)
        return True
    except ClientError as e:
        if condition_expression and e.response["Error"]["Code"] == "ConditionalCheckFailedException":
            return False
        raise

def scan_table(table_name: str) -> List[Dict[str, Any]]:
    table = get_table(f"{table_name.upper()}_TABLE", table_name)
    response = table.scan()
    items = response.get('Items', [])
    # Handle pagination
    while 'LastEvaluatedKey' in response:
        response = table.scan(ExclusiveStartKey=response['LastEvaluatedKey'])
        items.extend(response.get('Items', []))
    return items

def batch_write_items(table_name: str, items: List[Dict[str, Any]]):
    table = get_table(f"{table_name.upper()}_TABLE", table_name)
    with table.batch_writer() as batch:
        for item in items:
            batch.put_item(Item=item)

def delete_item(table_name: str, key: Dict[str, Any]):
    table = get_table(f"{table_name.upper()}_TABLE", table_name)
    table.delete_item(Key=key)

def batch_delete_items(table_name: str, keys: List[Dict[str, Any]]):
    table = get_table(f"{table_name.upper()}_TABLE", table_name)
    with table.batch_writer() as batch:
        for key in keys:
            batch.delete_item(Key=key)

def batch_get_items(table_name: str, keys: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Batch-fetch items by key. Handles the 100-key-per-request limit,
    deduplicates keys, and retries unprocessed keys.
    Missing items are simply absent from the result.
    """
    table = get_table(f"{table_name.upper()}_TABLE", table_name)
    real_table_name = table.name

    # Deduplicate keys (DynamoDB rejects duplicate keys in one batch)
    seen = set()
    unique_keys = []
    for key in keys:
        marker = tuple(sorted(key.items()))
        if marker not in seen:
            seen.add(marker)
            unique_keys.append(key)

    items = []
    for i in range(0, len(unique_keys), 100):
        chunk = unique_keys[i:i + 100]
        request = {real_table_name: {"Keys": chunk}}
        while request:
            response = dynamodb.batch_get_item(RequestItems=request)
            items.extend(response.get("Responses", {}).get(real_table_name, []))
            request = response.get("UnprocessedKeys") or None
    return items
def query_gsi(table_name: str, index_name: str, key_condition_expression: str, expression_values: Dict[str, Any], expression_names: Dict[str, str] = None) -> List[Dict[str, Any]]:
    table = get_table(f"{table_name.upper()}_TABLE", table_name)
    kwargs = {
        "IndexName": index_name,
        "KeyConditionExpression": key_condition_expression,
        "ExpressionAttributeValues": expression_values
    }
    if expression_names:
        kwargs["ExpressionAttributeNames"] = expression_names
    response = table.query(**kwargs)
    items = response.get('Items', [])
    while 'LastEvaluatedKey' in response:
        kwargs["ExclusiveStartKey"] = response['LastEvaluatedKey']
        response = table.query(**kwargs)
        items.extend(response.get('Items', []))
    return items

def query_table(table_name: str, key_condition_expression: str, expression_values: Dict[str, Any], expression_names: Dict[str, str] = None) -> List[Dict[str, Any]]:
    table = get_table(f"{table_name.upper()}_TABLE", table_name)
    kwargs = {
        "KeyConditionExpression": key_condition_expression,
        "ExpressionAttributeValues": expression_values
    }
    if expression_names:
        kwargs["ExpressionAttributeNames"] = expression_names
    response = table.query(**kwargs)
    items = response.get('Items', [])
    while 'LastEvaluatedKey' in response:
        kwargs["ExclusiveStartKey"] = response['LastEvaluatedKey']
        response = table.query(**kwargs)
        items.extend(response.get('Items', []))
    return items
