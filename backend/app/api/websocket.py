from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Dict, List, Set, Callable, Awaitable, Any
from collections import defaultdict
from queue import Queue as SyncQueue
import json
import uuid
import asyncio
from datetime import datetime
from app.core.database import get_db
from app.models.models import Agent, Message
from app.agents.agent import agent_manager

router = APIRouter()


class MessageQueue:
    """Thread-safe message queue for real-time message delivery"""

    def __init__(self):
        self._queues: Dict[str, asyncio.Queue] = {}
        self._lock = asyncio.Lock()

    async def create_queue(self, group_id: str) -> asyncio.Queue:
        """Create a new message queue for a group"""
        async with self._lock:
            if group_id not in self._queues:
                self._queues[group_id] = asyncio.Queue()
            return self._queues[group_id]

    async def get_queue(self, group_id: str) -> asyncio.Queue:
        """Get existing queue for a group"""
        async with self._lock:
            return self._queues.get(group_id)

    async def put_message(self, group_id: str, message: dict):
        """Put a message into the group's queue"""
        queue = await self.get_queue(group_id)
        if queue:
            try:
                await asyncio.wait_for(queue.put(message), timeout=1.0)
            except asyncio.TimeoutError:
                print(f"[MessageQueue] Timeout putting message for group {group_id}")

    async def get_message(self, group_id: str, timeout: float = 0.1) -> dict:
        """Get a message from the group's queue"""
        queue = await self.get_queue(group_id)
        if queue:
            try:
                return await asyncio.wait_for(queue.get(), timeout=timeout)
            except asyncio.TimeoutError:
                return None
        return None

    async def close_queue(self, group_id: str):
        """Close and remove a queue"""
        async with self._lock:
            if group_id in self._queues:
                del self._queues[group_id]

    def has_messages(self, group_id: str) -> bool:
        """Check if queue has messages (sync, for debugging)"""
        return group_id in self._queues


message_queue = MessageQueue()


class ConnectionManager:
    """Manage WebSocket connections"""

    def __init__(self):
        # session_id -> WebSocket
        self.active_connections: Dict[str, WebSocket] = {}
        # agent_id -> Set[session_ids]
        self.agent_sessions: Dict[str, Set[str]] = {}
        # project_group_id -> Set[session_ids]
        self.group_sessions: Dict[str, Set[str]] = {}
        # session_id -> agent_id
        self.session_agent: Dict[str, str] = {}
        # session_id -> project_group_id
        self.session_group: Dict[str, str] = {}
        # session_id -> user_info
        self.session_user: Dict[str, dict] = {}

    async def connect(self, websocket: WebSocket, session_id: str, agent_id: str = None, project_group_id: str = None, user_info: dict = None):
        """Connect a new WebSocket"""
        await websocket.accept()
        self.active_connections[session_id] = websocket

        if user_info:
            self.session_user[session_id] = user_info

        if agent_id:
            if agent_id not in self.agent_sessions:
                self.agent_sessions[agent_id] = set()
            self.agent_sessions[agent_id].add(session_id)
            self.session_agent[session_id] = agent_id

        if project_group_id:
            if project_group_id not in self.group_sessions:
                self.group_sessions[project_group_id] = set()
            self.group_sessions[project_group_id].add(session_id)
            self.session_group[session_id] = project_group_id

    def disconnect(self, session_id: str):
        """Disconnect a WebSocket"""
        if session_id in self.active_connections:
            del self.active_connections[session_id]

        if session_id in self.session_agent:
            agent_id = self.session_agent[session_id]
            if agent_id in self.agent_sessions:
                self.agent_sessions[agent_id].discard(session_id)
            del self.session_agent[session_id]

        if session_id in self.session_group:
            group_id = self.session_group[session_id]
            if group_id in self.group_sessions:
                self.group_sessions[group_id].discard(session_id)
            del self.session_group[session_id]

        if session_id in self.session_user:
            del self.session_user[session_id]

    async def send_message(self, session_id: str, message: dict):
        """Send message to a specific session"""
        if session_id in self.active_connections:
            websocket = self.active_connections[session_id]
            try:
                await websocket.send_json(message)
            except RuntimeError as e:
                # WebSocket可能已关闭，忽略发送错误
                print(f"WebSocket send error (session may be closed): {str(e)}")
            except Exception as e:
                # 其他错误，记录日志但不中断流程
                print(f"Failed to send message to session {session_id}: {str(e)}")

    async def broadcast_to_agent(self, agent_id: str, message: dict):
        """Broadcast message to all sessions of an agent"""
        if agent_id in self.agent_sessions:
            for session_id in self.agent_sessions[agent_id]:
                await self.send_message(session_id, message)

    async def broadcast_to_group(self, group_id: str, message: dict, exclude_session: str = None):
        """Broadcast message to all sessions of a project group"""
        if group_id in self.group_sessions:
            for session_id in self.group_sessions[group_id]:
                if session_id != exclude_session:
                    await self.send_message(session_id, message)

    async def consume_queue_and_broadcast(self, group_id: str, queue: asyncio.Queue):
        """Consume messages from queue and broadcast to group sessions"""
        while True:
            try:
                message = await asyncio.wait_for(queue.get(), timeout=0.5)
                if message is None:
                    break
                if group_id in self.group_sessions:
                    for session_id in self.group_sessions[group_id]:
                        await self.send_message(session_id, message)
            except asyncio.TimeoutError:
                continue
            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"[MessageQueue] Error consuming queue: {e}")
                break

    async def send_typing_indicator(self, session_id: str, is_typing: bool):
        """Send typing indicator"""
        await self.send_message(session_id, {
            "type": "typing",
            "is_typing": is_typing
        })

    async def broadcast_typing_indicator(self, group_id: str, user_id: str, is_typing: bool, agent_name: str = None):
        """Broadcast typing indicator to project group"""
        message = {
            "type": "typing",
            "is_typing": is_typing,
            "user_id": user_id
        }
        if agent_name:
            message["agent_name"] = agent_name
        await self.broadcast_to_group(group_id, message)

    def get_group_online_users(self, group_id: str) -> List[dict]:
        """Get online users in a project group"""
        online_users = []
        if group_id in self.group_sessions:
            for session_id in self.group_sessions[group_id]:
                if session_id in self.session_user:
                    online_users.append(self.session_user[session_id])
        return online_users

    def get_agent_online_count(self, agent_id: str) -> int:
        """Get online count for an agent"""
        if agent_id in self.agent_sessions:
            return len(self.agent_sessions[agent_id])
        return 0

    def get_group_online_count(self, group_id: str) -> int:
        """Get online count for a project group"""
        if group_id in self.group_sessions:
            return len(self.group_sessions[group_id])
        return 0

# Global connection manager
manager = ConnectionManager()


@router.websocket("/ws/chat/{agent_id}/{session_id}")
async def websocket_chat(
    websocket: WebSocket,
    agent_id: str,
    session_id: str
):
    """WebSocket endpoint for real-time chat"""
    await manager.connect(websocket, session_id, agent_id)

    try:
        # Send connection success message
        await manager.send_message(session_id, {
            "type": "connected",
            "agent_id": agent_id,
            "session_id": session_id
        })

        while True:
            # Receive message
            data = await websocket.receive_text()
            message_data = json.loads(data)

            if message_data.get("type") == "chat":
                user_message = message_data.get("content", "")

                if not user_message.strip():
                    continue

                # Send typing indicator
                await manager.send_typing_indicator(session_id, True)

                try:
                    # Get agent response
                    response = await agent_manager.chat(
                        agent_id=agent_id,
                        message=user_message,
                        session_id=session_id,
                    )

                    # Send response
                    await manager.send_message(session_id, {
                        "type": "message",
                        "content": response["response"],
                        "agent_id": agent_id,
                        "session_id": session_id,
                    })

                except Exception as e:
                    await manager.send_message(session_id, {
                        "type": "error",
                        "content": f"Error: {str(e)}",
                    })

                finally:
                    # Stop typing indicator
                    await manager.send_typing_indicator(session_id, False)

            elif message_data.get("type") == "ping":
                await manager.send_message(session_id, {"type": "pong"})

    except WebSocketDisconnect:
        manager.disconnect(session_id)
    except Exception as e:
        await manager.send_message(session_id, {
            "type": "error",
            "content": str(e)
        })
        manager.disconnect(session_id)


@router.websocket("/ws/status")
async def websocket_status(websocket: WebSocket):
    """WebSocket endpoint for agent status updates"""
    await websocket.accept()

    try:
        while True:
            data = await websocket.receive_text()
            message_data = json.loads(data)

            if message_data.get("type") == "subscribe":
                # Subscribe to agent status updates
                agent_id = message_data.get("agent_id")
                if agent_id:
                    await websocket.send_json({
                        "type": "subscribed",
                        "agent_id": agent_id,
                        "agents": agent_manager.list_agents()
                    })

            elif message_data.get("type") == "get_status":
                await websocket.send_json({
                    "type": "status",
                    "agents": agent_manager.list_agents()
                })

    except WebSocketDisconnect:
        pass
    except Exception as e:
        await websocket.send_json({
            "type": "error",
            "content": str(e)
        })


@router.websocket("/ws/group/{project_group_id}/{session_id}")
async def websocket_group_chat(
    websocket: WebSocket,
    project_group_id: str,
    session_id: str
):
    """WebSocket endpoint for project group chat"""
    # Note: We don't get database session here to avoid async context issues
    # The group_chat function in agents.agent module doesn't use database directly
    
    await manager.connect(websocket, session_id, project_group_id=project_group_id, user_info={
        "session_id": session_id,
        "joined_at": datetime.utcnow().isoformat()
    })

    try:
        # Send connection success message
        await manager.send_message(session_id, {
            "type": "connected",
            "project_group_id": project_group_id,
            "session_id": session_id,
            "online_count": manager.get_group_online_count(project_group_id),
            "online_users": manager.get_group_online_users(project_group_id)
        })

        # Broadcast user joined message
        await manager.broadcast_to_group(project_group_id, {
            "type": "user_joined",
            "session_id": session_id,
            "online_count": manager.get_group_online_count(project_group_id)
        }, exclude_session=session_id)

        while True:
            # Receive message
            data = await websocket.receive_text()
            message_data = json.loads(data)

            if message_data.get("type") == "chat":
                user_message = message_data.get("content", "")
                mention_agent_ids = message_data.get("mention_agent_ids", [])

                if not user_message.strip():
                    continue

                try:
                    from app.agents.agent import group_agent_manager

                    project_group = group_agent_manager.get_group(project_group_id)

                    supervisor_agent = None
                    if project_group:
                        supervisor_agent = project_group.supervisor

                    agent_name = supervisor_agent.name if supervisor_agent else None
                    await manager.broadcast_typing_indicator(project_group_id, session_id, True, agent_name)

                    if supervisor_agent:
                        print(f"[DEBUG] Sending agent_thinking for supervisor: {supervisor_agent.agent_id} ({supervisor_agent.name})")
                        await manager.broadcast_to_group(project_group_id, {
                            "type": "agent_thinking",
                            "agent_id": supervisor_agent.agent_id,
                            "agent_name": supervisor_agent.name,
                            "content": "正在分析用户问题...",
                            "timestamp": datetime.utcnow().isoformat()
                        })

                    member_agents = []
                    if project_group:
                        for agent_id in project_group.members.keys():
                            agent = agent_manager.get_agent(agent_id)
                            if agent:
                                member_agents.append(agent)

                    queue = await message_queue.create_queue(project_group_id)

                    # 只跟踪实际参与任务的agent
                    active_agents = []

                    async def queue_message_callback(message: dict):
                        """Callback to put messages into queue for real-time delivery"""
                        print(f"[DEBUG] queue_message_callback: received message: {message['type']} from {message.get('agent_name')}")
                        # 当agent开始思考时，将其添加到活跃agent列表
                        if message['type'] == 'agent_thinking' and 'agent_id' in message:
                            agent_id = message['agent_id']
                            # 查找对应的agent
                            for agent in member_agents:
                                if agent.agent_id == agent_id and agent not in active_agents:
                                    active_agents.append(agent)
                                    print(f"[DEBUG] Added {agent.name} to active_agents")
                                    break
                        # 当agent完成响应时，将其从活跃agent列表中移除
                        elif message['type'] == 'agent_response' and 'agent_id' in message:
                            agent_id = message['agent_id']
                            # 查找对应的agent并移除
                            for i, agent in enumerate(active_agents):
                                if agent.agent_id == agent_id:
                                    active_agents.pop(i)
                                    print(f"[DEBUG] Removed {agent.name} from active_agents")
                                    break
                        await message_queue.put_message(project_group_id, message)

                    async def send_progress_updates():
                        update_count = 0
                        last_active_count = 0
                        while True:
                            await asyncio.sleep(3)
                            try:
                                if member_agents and active_agents:
                                    # 如果活跃agent数量减少了，重置计数器避免越界
                                    current_active_count = len(active_agents)
                                    if current_active_count < last_active_count:
                                        update_count = 0
                                    last_active_count = current_active_count
                                    
                                    agent = active_agents[update_count % len(active_agents)]
                                    print(f"[DEBUG] Progress update: sending agent_responding for {agent.name}")
                                    await manager.broadcast_to_group(project_group_id, {
                                        "type": "agent_responding",
                                        "agent_id": agent.agent_id,
                                        "agent_name": agent.name,
                                        "content": f"正在处理任务... ({update_count * 3}秒)",
                                        "timestamp": datetime.utcnow().isoformat()
                                    })
                                    update_count += 1
                                elif not active_agents:
                                    # 当没有活跃agent时，重置计数器
                                    update_count = 0
                                    last_active_count = 0
                            except Exception as e:
                                print(f"[DEBUG] Progress update error: {e}")
                                break

                    async def send_heartbeat():
                        for _ in range(60):
                            await asyncio.sleep(5)
                            try:
                                await manager.broadcast_to_group(project_group_id, {
                                    "type": "heartbeat",
                                    "timestamp": datetime.utcnow().isoformat()
                                })
                            except Exception:
                                break

                    progress_task = asyncio.create_task(send_progress_updates())
                    heartbeat_task = asyncio.create_task(send_heartbeat())
                    queue_broadcast_task = asyncio.create_task(
                        manager.consume_queue_and_broadcast(project_group_id, queue)
                    )

                    chat_complete = asyncio.Event()
                    chat_result = {"response": None, "error": None}

                    async def run_chat():
                        try:
                            response = await group_agent_manager.group_chat(
                                project_group_id=project_group_id,
                                message=user_message,
                                mention_agent_ids=mention_agent_ids,
                                message_callback=queue_message_callback
                            )
                            chat_result["response"] = response
                        except Exception as e:
                            print(f"[DEBUG] Chat error: {e}")
                            chat_result["error"] = str(e)
                        finally:
                            chat_complete.set()

                    chat_task = asyncio.create_task(run_chat())

                    try:
                        await asyncio.wait_for(chat_complete.wait(), timeout=120.0)
                    except asyncio.TimeoutError:
                        print("[DEBUG] Chat timeout after 120 seconds")
                        chat_task.cancel()
                        try:
                            await chat_task
                        except asyncio.CancelledError:
                            pass
                        raise Exception("处理超时，请稍后再试")

                    progress_task.cancel()
                    heartbeat_task.cancel()
                    queue_broadcast_task.cancel()

                    # 保存消息到数据库
                    from app.core.database import AsyncSessionLocal
                    from app.models.models import GroupMessage
                    import uuid

                    async with AsyncSessionLocal() as db:
                        try:
                            # 保存用户消息
                            user_msg = GroupMessage(
                                project_group_id=uuid.UUID(project_group_id),
                                content=user_message,
                                message_type="user",
                                user_id=uuid.UUID("00000000-0000-0000-0000-000000000000"),
                            )
                            db.add(user_msg)
                            await db.commit()
                            await db.refresh(user_msg)

                            # 保存agent响应
                            if chat_result["response"]:
                                for response in chat_result["response"]["responses"]:
                                    sender_id = uuid.UUID(response["sender_agent_id"]) if response["sender_agent_id"] else None
                                    agent_msg = GroupMessage(
                                        project_group_id=uuid.UUID(project_group_id),
                                        content=response["content"],
                                        message_type="agent",
                                        sender_agent_id=sender_id,
                                        token_count=len(response["content"]) // 4,
                                    )
                                    db.add(agent_msg)
                                await db.commit()
                        except Exception as db_error:
                            print(f"[DEBUG] Database error while saving messages: {db_error}")
                            try:
                                await db.rollback()
                            except:
                                pass

                    try:
                        await progress_task
                    except asyncio.CancelledError:
                        pass
                    try:
                        await heartbeat_task
                    except asyncio.CancelledError:
                        pass
                    try:
                        await queue_broadcast_task
                    except asyncio.CancelledError:
                        pass

                    if chat_result["error"]:
                        print(f"[DEBUG] Chat error: {chat_result['error']}")
                        raise Exception(chat_result["error"])

                    response = chat_result["response"]
                    if not response:
                        raise Exception("处理失败，未收到响应")

                    print(f"[DEBUG] Chat completed, response keys: {response.keys() if hasattr(response, 'keys') else 'no keys'}")

                    # 只为实际参与回复的agent发送agent_result事件
                    if 'responses' in response:
                        print(f"[DEBUG] Sending agent_result events for {len(response['responses'])} agents")
                        # 使用set来跟踪已发送agent_result的agent，避免重复
                        sent_agent_ids = set()
                        for resp in response['responses']:
                            if 'sender_agent_id' in resp:
                                agent_id = resp['sender_agent_id']
                                # 跳过已经发送过agent_result的agent
                                if agent_id in sent_agent_ids:
                                    print(f"[DEBUG] Skipping duplicate agent_result for {agent_id}")
                                    continue
                                sent_agent_ids.add(agent_id)
                                # 查找对应的agent
                                for agent in member_agents:
                                    if agent.agent_id == agent_id:
                                        print(f"[DEBUG] Sending agent_result for {agent.name}")
                                        await manager.broadcast_to_group(project_group_id, {
                                            "type": "agent_result",
                                            "agent_id": agent.agent_id,
                                            "agent_name": agent.name,
                                            "content": f"已完成回复",
                                            "timestamp": datetime.utcnow().isoformat()
                                        })
                                        break
                    else:
                        print(f"[DEBUG] No responses found in chat result")
                    print("[DEBUG] Finished sending agent_result events")

                    print(f"[DEBUG] Sending final message, length: {len(response['final_response'])}")
                    await manager.broadcast_to_group(project_group_id, {
                        "type": "message",
                        "content": response["final_response"],
                        "project_group_id": project_group_id,
                        "session_id": session_id,
                        "timestamp": datetime.utcnow().isoformat()
                    })
                    print("[DEBUG] Final message sent")

                    if project_group:
                        print(f"[DEBUG] Sending agent_status updates for {len(project_group.members)} members")
                        for agent_id in project_group.members.keys():
                            await manager.broadcast_to_group(project_group_id, {
                                "type": "agent_status",
                                "agent_id": agent_id,
                                "status": "idle",
                                "timestamp": datetime.utcnow().isoformat()
                            })
                    print("[DEBUG] All messages sent successfully")

                    await message_queue.close_queue(project_group_id)

                except Exception as e:
                    await manager.send_message(session_id, {
                        "type": "error",
                        "content": f"Error: {str(e)}",
                    })

                finally:
                    # Stop typing indicator
                    await manager.broadcast_typing_indicator(project_group_id, session_id, False, agent_name)

            elif message_data.get("type") == "typing":
                is_typing = message_data.get("is_typing", False)
                await manager.broadcast_typing_indicator(project_group_id, session_id, is_typing)

            elif message_data.get("type") == "ping":
                await manager.send_message(session_id, {"type": "pong"})

    except WebSocketDisconnect:
        # Broadcast user left message
        await manager.broadcast_to_group(project_group_id, {
            "type": "user_left",
            "session_id": session_id,
            "online_count": manager.get_group_online_count(project_group_id) - 1
        })
        manager.disconnect(session_id)
    except Exception as e:
        await manager.send_message(session_id, {
            "type": "error",
            "content": str(e)
        })
        manager.disconnect(session_id)
