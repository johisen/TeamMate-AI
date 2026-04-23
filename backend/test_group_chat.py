import requests
import json

url = "http://localhost:8000/api/v1/project-groups/c0e5ca16-4f80-4cc7-9f00-b115f33da5a1/chat"
data = {
    "message": "@main 让product-manager做一个自我介绍",
    "user_id": "00000000-0000-0000-0000-000000000000"
}

try:
    response = requests.post(url, json=data)
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text}")
except Exception as e:
    print(f"Error: {e}")