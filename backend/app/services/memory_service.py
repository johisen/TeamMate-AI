from typing import Optional, List, Dict, Any
from dataclasses import dataclass
from datetime import datetime
import uuid
import json

from langchain_openai import OpenAIEmbeddings
from langchain_community.vectorstores import Qdrant
from langchain_core.documents import Document
from qdrant_client import QdrantClient

from app.core.config import settings


@dataclass
class MemoryItem:
    """Memory item data structure"""
    id: str
    agent_id: str
    memory_type: str  # short_term, long_term, semantic
    content: str
    metadata: Dict[str, Any]
    created_at: datetime
    updated_at: datetime


class MemoryService:
    """Service for managing agent long-term memory with Qdrant"""

    def __init__(self):
        self.client: Optional[QdrantClient] = None
        self.embeddings: Optional[OpenAIEmbeddings] = None
        self.vector_store: Optional[Qdrant] = None
        self._initialized = False

    async def initialize(self):
        """Initialize the memory service"""
        if self._initialized:
            return

        if not settings.USE_QDRANT:
            print("Qdrant not enabled, memory service using in-memory storage")
            self._initialized = True
            return

        try:
            # Initialize Qdrant client
            self.client = QdrantClient(
                host=settings.QDRANT_HOST,
                port=settings.QDRANT_PORT,
            )

            # Initialize embeddings
            self.embeddings = OpenAIEmbeddings(
                model="text-embedding-3-small",
                api_key=settings.OPENAI_API_KEY or "",
            )

            # Check and create collection if not exists
            collections = self.client.get_collections()
            collection_names = [c.name for c in collections.collections]

            if settings.QDRANT_COLLECTION not in collection_names:
                self.client.create_collection(
                    collection_name=settings.QDRANT_COLLECTION,
                    vectors_config={
                        "size": 1536,  # text-embedding-3-small dimension
                        "distance": "Cosine",
                    },
                )

            # Initialize vector store
            self.vector_store = Qdrant(
                client=self.client,
                collection_name=settings.QDRANT_COLLECTION,
                embeddings=self.embeddings,
            )

            self._initialized = True
            print("Memory service initialized successfully")

        except Exception as e:
            print(f"Failed to initialize memory service: {e}")
            self._initialized = True  # Mark as initialized to avoid retries

    async def store_memory(
        self,
        agent_id: str,
        content: str,
        memory_type: str = "long_term",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> str:
        """Store a memory item"""
        await self.initialize()

        memory_id = str(uuid.uuid4())
        now = datetime.utcnow()

        if self.vector_store and self._initialized:
            # Store in Qdrant with namespace
            doc = Document(
                page_content=content,
                metadata={
                    "id": memory_id,
                    "agent_id": agent_id,
                    "memory_type": memory_type,
                    "namespace": f"agent_{agent_id}",
                    "created_at": now.isoformat(),
                    "updated_at": now.isoformat(),
                    **(metadata or {}),
                },
            )

            self.vector_store.add_documents([doc])
        else:
            # Fallback: In-memory storage (for dev)
            print(f"Storing memory in-memory: {memory_id}")

        return memory_id

    async def retrieve_memories(
        self,
        agent_id: str,
        query: Optional[str] = None,
        memory_type: Optional[str] = None,
        limit: int = 10,
    ) -> List[MemoryItem]:
        """Retrieve memories for an agent"""
        await self.initialize()

        if not self.vector_store or not self._initialized:
            return []  # Return empty for dev mode

        try:
            # Build filter
            filter_conditions = {
                "must": [
                    {"key": "namespace", "match": {"value": f"agent_{agent_id}"}},
                ]
            }

            if memory_type:
                filter_conditions["must"].append(
                    {"key": "memory_type", "match": {"value": memory_type}}
                )

            if query:
                # Similarity search
                docs = self.vector_store.similarity_search(
                    query=query,
                    k=limit,
                    filter=filter_conditions,
                )
            else:
                # Simple search (use a dummy query)
                docs = self.vector_store.similarity_search(
                    query="",
                    k=limit,
                    filter=filter_conditions,
                )

            # Convert to MemoryItem
            memories = []
            for doc in docs:
                memories.append(MemoryItem(
                    id=doc.metadata.get("id", str(uuid.uuid4())),
                    agent_id=doc.metadata.get("agent_id", agent_id),
                    memory_type=doc.metadata.get("memory_type", "long_term"),
                    content=doc.page_content,
                    metadata={k: v for k, v in doc.metadata.items() 
                             if k not in ["id", "agent_id", "memory_type", "namespace"]},
                    created_at=datetime.fromisoformat(doc.metadata.get("created_at", datetime.utcnow().isoformat())),
                    updated_at=datetime.fromisoformat(doc.metadata.get("updated_at", datetime.utcnow().isoformat())),
                ))

            return memories

        except Exception as e:
            print(f"Error retrieving memories: {e}")
            return []

    async def delete_memory(self, memory_id: str, agent_id: str) -> bool:
        """Delete a memory item"""
        await self.initialize()

        if not self.vector_store or not self._initialized:
            return True

        try:
            self.vector_store.delete(
                filter={
                    "must": [
                        {"key": "id", "match": {"value": memory_id}},
                        {"key": "agent_id", "match": {"value": agent_id}},
                    ]
                }
            )
            return True
        except Exception as e:
            print(f"Error deleting memory: {e}")
            return False

    async def clear_agent_memories(self, agent_id: str) -> bool:
        """Clear all memories for an agent"""
        await self.initialize()

        if not self.vector_store or not self._initialized:
            return True

        try:
            self.vector_store.delete(
                filter={
                    "must": [
                        {"key": "namespace", "match": {"value": f"agent_{agent_id}"}},
                    ]
                }
            )
            return True
        except Exception as e:
            print(f"Error clearing memories: {e}")
            return False

    async def store_conversation_memory(
        self,
        agent_id: str,
        session_id: str,
        messages: List[Dict[str, Any]],
    ):
        """Store a conversation as long-term memory"""
        await self.initialize()

        # Create a summary of the conversation
        conversation_text = "\n".join([
            f"{msg.get('type', 'unknown')}: {msg.get('content', '')}"
            for msg in messages[-20:]  # Last 20 messages
        ])

        summary = f"""Conversation Summary (Session: {session_id})
Time: {datetime.utcnow().isoformat()}

{conversation_text}
"""

        await self.store_memory(
            agent_id=agent_id,
            content=summary,
            memory_type="long_term",
            metadata={
                "session_id": session_id,
                "message_count": len(messages),
            },
        )

    async def get_relevant_memories(
        self,
        agent_id: str,
        query: str,
        limit: int = 5,
    ) -> List[str]:
        """Get relevant memories as formatted strings for prompt injection"""
        memories = await self.retrieve_memories(
            agent_id=agent_id,
            query=query,
            limit=limit,
        )

        return [
            f"[Memory {i+1}]\n{mem.content}\n"
            for i, mem in enumerate(memories)
        ]


# Global memory service instance
memory_service = MemoryService()
