from typing import List, Dict, Any, Optional
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, SystemMessage
from langchain_openai import ChatOpenAI

from app.core.config import settings


class ContextCompressor:
    """Context compression using LLM summarization"""

    def __init__(self, max_messages: int = 20, compression_threshold: int = 50):
        self.max_messages = max_messages
        self.compression_threshold = compression_threshold
        self.summarizer = ChatOpenAI(
            model="gpt-3.5-turbo",
            api_key=settings.OPENAI_API_KEY or "",
            temperature=0.3,
        )

    async def compress(
        self,
        messages: List[BaseMessage],
        current_system_prompt: Optional[str] = None
    ) -> List[BaseMessage]:
        """
        Compress messages by summarizing older ones while keeping recent context.
        Uses Map-Reduce strategy for efficient compression.
        """
        if len(messages) <= self.compression_threshold:
            return messages

        if not current_system_prompt:
            current_system_prompt = "You are a helpful AI assistant."

        # Keep system prompt and recent messages
        recent_messages = messages[-self.max_messages:]
        older_messages = messages[:-self.max_messages]

        # Summarize older messages
        summary = await self._summarize_messages(older_messages)

        # Build compressed message list
        compressed = [
            SystemMessage(content=current_system_prompt),
            AIMessage(content=f"[Previous conversation summary]: {summary}"),
        ] + recent_messages

        return compressed

    async def _summarize_messages(self, messages: List[BaseMessage]) -> str:
        """Summarize a list of messages into a concise summary"""
        if not messages:
            return "No previous conversation."

        # Build conversation text
        conversation_text = "\n".join([
            f"{'User' if isinstance(m, HumanMessage) else 'Assistant'}: {m.content}"
            for m in messages
        ])

        # Create summarization prompt
        prompt = f"""Please summarize the following conversation into a concise paragraph that captures:
1. Main topics discussed
2. Key decisions or conclusions reached
3. Any important information that should be remembered

Conversation:
{conversation_text}

Summary:"""

        try:
            response = await self.summarizer.agenerate([prompt])
            return response.generations[0][0].text
        except Exception as e:
            print(f"Summarization failed: {e}")
            return f"Conversation with {len(messages)} messages about various topics."

    async def extract_key_points(self, messages: List[BaseMessage]) -> List[str]:
        """Extract key points from a conversation"""
        if not messages:
            return []

        conversation_text = "\n".join([
            f"{'User' if isinstance(m, HumanMessage) else 'Assistant'}: {m.content}"
            for m in messages
        ])

        prompt = f"""Extract 3-5 key points from this conversation. 
Return them as a JSON array of strings.

Conversation:
{conversation_text}

Key points:"""

        try:
            response = await self.summarizer.agenerate([prompt])
            import json
            result = response.generations[0][0].text
            return json.loads(result)
        except Exception as e:
            print(f"Key points extraction failed: {e}")
            return []

    def should_compress(self, messages: List[BaseMessage]) -> bool:
        """Check if messages should be compressed"""
        return len(messages) > self.compression_threshold

    def get_memory_usage(self, messages: List[BaseMessage]) -> Dict[str, Any]:
        """Calculate approximate token usage for messages"""
        total_chars = sum(len(m.content) for m in messages)
        estimated_tokens = total_chars // 4

        return {
            "message_count": len(messages),
            "total_characters": total_chars,
            "estimated_tokens": estimated_tokens,
            "should_compress": self.should_compress(messages),
            "compression_available": len(messages) > self.max_messages,
        }


context_compressor = ContextCompressor()
