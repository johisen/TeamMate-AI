import asyncio
import websockets
import json

async def test_websocket():
    # Correct WebSocket URL format
    group_id = "c0e5ca16-4f80-4cc7-9f00-b115f33da5a1"
    session_id = "test-session-123"
    uri = f"ws://localhost:8000/ws/group/{group_id}/{session_id}"
    
    try:
        async with websockets.connect(uri) as websocket:
            print("Connected to WebSocket!")
            
            # Wait for connected message
            initial_msg = await websocket.recv()
            print(f"Initial message: {initial_msg}")
            
            # Send a test message
            test_message = {
                "type": "chat",
                "content": "@main let product-manager do an introduction",
                "mention_agent_ids": []
            }
            await websocket.send(json.dumps(test_message))
            print(f"Sent: {test_message}")
            
            # Listen for responses
            while True:
                try:
                    response = await asyncio.wait_for(websocket.recv(), timeout=15.0)
                    data = json.loads(response)
                    print(f"Received: {data}")
                    
                    # Check if we got agent status messages
                    if data.get("type") in ["agent_thinking", "agent_responding", "agent_result"]:
                        print(f"✓ Got agent status update: {data['type']} for {data.get('agent_name')}")
                    elif data.get("type") == "message":
                        print(f"✓ Got final response")
                        break
                    
                except asyncio.TimeoutError:
                    print("Timeout - no more messages")
                    break
                    
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_websocket())