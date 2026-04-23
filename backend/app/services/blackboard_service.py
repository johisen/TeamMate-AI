from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field
from datetime import datetime
import threading
import hashlib


@dataclass
class BlackboardEntry:
    id: str
    key: str
    value: str
    agent_id: str
    agent_name: str
    created_at: datetime
    updated_at: datetime
    version: int = 1
    tags: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "key": self.key,
            "value": self.value,
            "agent_id": self.agent_id,
            "agent_name": self.agent_name,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "version": self.version,
            "tags": self.tags,
        }


class BlackboardService:
    """Shared blackboard for multi-agent collaboration

    Provides a shared space where agents can:
    - Write key findings and conclusions
    - Read what other agents have posted
    - Avoid repeating information already known
    """

    MAX_ENTRY_SIZE = 5000
    MAX_ENTRIES = 1000

    def __init__(self):
        self._entries: Dict[str, BlackboardEntry] = {}
        self._keys_index: Dict[str, List[str]] = {}
        self._tags_index: Dict[str, List[str]] = {}
        self._lock = threading.RLock()
        self._knowledge_hash: Dict[str, str] = {}

    def _generate_id(self, key: str, agent_id: str) -> str:
        return hashlib.sha256(f"{key}:{agent_id}:{datetime.utcnow().isoformat()}".encode()).hexdigest()[:16]

    def write(
        self,
        key: str,
        value: str,
        agent_id: str,
        agent_name: str,
        tags: Optional[List[str]] = None,
    ) -> BlackboardEntry:
        with self._lock:
            if len(value) > self.MAX_ENTRY_SIZE:
                value = value[:self.MAX_ENTRY_SIZE] + "...[truncated]"

            value_hash = hashlib.sha256(value.encode()).hexdigest()

            if value_hash in self._knowledge_hash:
                existing_entry_id = self._knowledge_hash[value_hash]
                if existing_entry_id in self._entries:
                    existing = self._entries[existing_entry_id]
                    return existing

            entry_id = self._generate_id(key, agent_id)
            now = datetime.utcnow()

            entry = BlackboardEntry(
                id=entry_id,
                key=key,
                value=value,
                agent_id=agent_id,
                agent_name=agent_name,
                created_at=now,
                updated_at=now,
                version=1,
                tags=tags or [],
            )

            self._entries[entry_id] = entry

            if key not in self._keys_index:
                self._keys_index[key] = []
            self._keys_index[key].append(entry_id)

            for tag in entry.tags:
                if tag not in self._tags_index:
                    self._tags_index[tag] = []
                self._tags_index[tag].append(entry_id)

            self._knowledge_hash[value_hash] = entry_id

            self._cleanup_old_entries()

            return entry

    def read(self, key: str) -> List[BlackboardEntry]:
        with self._lock:
            entry_ids = self._keys_index.get(key, [])
            return [self._entries[eid] for eid in entry_ids if eid in self._entries]

    def read_by_tag(self, tag: str) -> List[BlackboardEntry]:
        with self._lock:
            entry_ids = self._tags_index.get(tag, [])
            return [self._entries[eid] for eid in entry_ids if eid in self._entries]

    def read_all(self) -> List[BlackboardEntry]:
        with self._lock:
            return list(self._entries.values())

    def get_recent_entries(self, limit: int = 20) -> List[BlackboardEntry]:
        with self._lock:
            sorted_entries = sorted(
                self._entries.values(),
                key=lambda e: e.updated_at,
                reverse=True
            )
            return sorted_entries[:limit]

    def get_summary(self, max_length: int = 2000) -> str:
        with self._lock:
            entries = self.get_recent_entries(limit=10)
            if not entries:
                return "黑板为空"

            summary_parts = ["=== 共享黑板摘要 ==="]
            for entry in entries:
                part = f"[{entry.agent_name}@{entry.key}]: {entry.value[:200]}"
                if len(part) > max_length:
                    part = part[:max_length] + "..."
                summary_parts.append(part)

            result = "\n".join(summary_parts)
            if len(result) > max_length:
                result = result[:max_length] + "...\n[内容过长已截断]"
            return result

    def get_key_count(self, key: str) -> int:
        with self._lock:
            return len(self._keys_index.get(key, []))

    def has_key(self, key: str) -> bool:
        with self._lock:
            return key in self._keys_index and len(self._keys_index[key]) > 0

    def clear(self):
        with self._lock:
            self._entries.clear()
            self._keys_index.clear()
            self._tags_index.clear()
            self._knowledge_hash.clear()

    def clear_for_project(self, project_group_id: str):
        with self._lock:
            to_remove = [
                eid for eid, entry in self._entries.items()
                if entry.tags and project_group_id in entry.tags
            ]
            for eid in to_remove:
                entry = self._entries[eid]
                if entry.key in self._keys_index:
                    self._keys_index[entry.key] = [
                        k for k in self._keys_index[entry.key] if k != eid
                    ]
                for tag in entry.tags:
                    if tag in self._tags_index:
                        self._tags_index[tag] = [
                            t for t in self._tags_index[tag] if t != eid
                        ]
                del self._entries[eid]

    def _cleanup_old_entries(self):
        if len(self._entries) <= self.MAX_ENTRIES:
            return

        sorted_entries = sorted(
            self._entries.items(),
            key=lambda x: x[1].updated_at
        )

        to_remove = sorted_entries[:len(self._entries) - self.MAX_ENTRIES]
        for entry_id, entry in to_remove:
            if entry.key in self._keys_index:
                self._keys_index[entry.key] = [
                    k for k in self._keys_index[entry.key] if k != entry_id
                ]
            for tag in entry.tags:
                if tag in self._tags_index:
                    self._tags_index[tag] = [
                        t for t in self._tags_index[tag] if t != entry_id
                    ]
            del self._entries[entry_id]


blackboard_service = BlackboardService()
