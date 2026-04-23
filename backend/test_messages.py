import requests
import json

# Test getting messages
group_id = "c0e5ca16-4f80-4cc7-9f00-b115f33da5a1"
url = f"http://localhost:8000/api/v1/project-groups/{group_id}/messages"
response = requests.get(url)
print(f"Status: {response.status_code}")
if response.status_code == 200:
    messages = response.json()
    print(f"Found {len(messages)} messages")
    print("\nLast 5 messages:")
    for msg in messages[:5]:  # Show first 5 (most recent since ordered desc)
        print(f"  ID: {msg['id']}")
        print(f"  Type: {msg['message_type']}")
        print(f"  Sender: {msg['sender_agent_id']}")
        print(f"  Content: {msg['content'][:100]}...")
        print(f"  Created: {msg['created_at']}")
        print()
else:
    print(f"Error: {response.text}")