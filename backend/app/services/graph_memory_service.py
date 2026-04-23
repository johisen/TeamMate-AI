from typing import Dict, List, Any, Optional, Set
from dataclasses import dataclass, field
from datetime import datetime
import threading
import hashlib
import json


@dataclass
class KnowledgeNode:
    node_id: str
    content: str
    content_hash: str
    entity_type: str
    agent_id: str
    agent_name: str
    created_at: datetime
    updated_at: datetime
    connections: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "node_id": self.node_id,
            "content": self.content,
            "entity_type": self.entity_type,
            "agent_id": self.agent_id,
            "agent_name": self.agent_name,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "connections": self.connections,
            "metadata": self.metadata,
        }


class GraphMemoryService:
    """Graph-based memory service with deduplication

    Features:
    - Knowledge stored as nodes in a graph
    - Duplicate content detection via hash
    - Token growth control through deduplication
    - Relationship tracking between knowledge pieces
    """

    MAX_NODES = 500
    MAX_CONNECTIONS_PER_NODE = 10

    def __init__(self):
        self._nodes: Dict[str, KnowledgeNode] = {}
        self._hash_index: Dict[str, str] = {}
        self._entity_index: Dict[str, List[str]] = {}
        self._lock = threading.RLock()
        self._total_token_count: int = 0

    def _generate_node_id(self, content: str, agent_id: str) -> str:
        raw = f"{content}:{agent_id}:{datetime.utcnow().isoformat()}"
        return hashlib.sha256(raw.encode()).hexdigest()[:16]

    def _compute_hash(self, content: str) -> str:
        return hashlib.sha256(content.encode()).hexdigest()[:32]

    def add_knowledge(
        self,
        content: str,
        entity_type: str,
        agent_id: str,
        agent_name: str,
        connections: Optional[List[str]] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Optional[KnowledgeNode]:
        with self._lock:
            content_hash = self._compute_hash(content)

            if content_hash in self._hash_index:
                existing_node_id = self._hash_index[content_hash]
                if existing_node_id in self._nodes:
                    return None

            node_id = self._generate_node_id(content, agent_id)
            now = datetime.utcnow()

            node = KnowledgeNode(
                node_id=node_id,
                content=content,
                content_hash=content_hash,
                entity_type=entity_type,
                agent_id=agent_id,
                agent_name=agent_name,
                created_at=now,
                updated_at=now,
                connections=connections or [],
                metadata=metadata or {},
            )

            self._nodes[node_id] = node
            self._hash_index[content_hash] = node_id

            if entity_type not in self._entity_index:
                self._entity_index[entity_type] = []
            self._entity_index[entity_type].append(node_id)

            self._total_token_count += len(content) // 4

            if connections:
                for conn_id in connections[:self.MAX_CONNECTIONS_PER_NODE]:
                    if conn_id in self._nodes:
                        if node_id not in self._nodes[conn_id].connections:
                            self._nodes[conn_id].connections.append(node_id)

            self._cleanup_old_nodes()

            return node

    def get_knowledge(self, node_id: str) -> Optional[KnowledgeNode]:
        with self._lock:
            return self._nodes.get(node_id)

    def get_by_hash(self, content_hash: str) -> Optional[KnowledgeNode]:
        with self._lock:
            node_id = self._hash_index.get(content_hash)
            if node_id:
                return self._nodes.get(node_id)
            return None

    def get_by_entity_type(self, entity_type: str) -> List[KnowledgeNode]:
        with self._lock:
            node_ids = self._entity_index.get(entity_type, [])
            return [self._nodes[nid] for nid in node_ids if nid in self._nodes]

    def get_related_knowledge(self, node_id: str, max_depth: int = 1) -> List[KnowledgeNode]:
        with self._lock:
            if node_id not in self._nodes:
                return []

            result = []
            visited = set()
            queue = [(node_id, 0)]

            while queue:
                current_id, depth = queue.pop(0)
                if current_id in visited or depth > max_depth:
                    continue

                visited.add(current_id)
                current = self._nodes.get(current_id)
                if current:
                    result.append(current)
                    for conn_id in current.connections:
                        if conn_id not in visited:
                            queue.append((conn_id, depth + 1))

            return result

    def search(self, query: str, max_results: int = 5) -> List[KnowledgeNode]:
        with self._lock:
            query_lower = query.lower()
            scored = []

            for node in self._nodes.values():
                if query_lower in node.content.lower():
                    score = node.content.lower().count(query_lower)
                    scored.append((score, node))

            scored.sort(key=lambda x: x[0], reverse=True)
            return [node for _, node in scored[:max_results]]

    def get_deduplication_stats(self) -> Dict[str, Any]:
        with self._lock:
            unique_hashes = len(self._hash_index)
            total_nodes = len(self._nodes)

            return {
                "total_nodes": total_nodes,
                "unique_contents": unique_hashes,
                "deduplication_ratio": 1.0 - (unique_hashes / total_nodes) if total_nodes > 0 else 0.0,
                "estimated_tokens": self._total_token_count,
                "total_connections": sum(len(n.connections) for n in self._nodes.values()),
            }

    def get_token_count(self) -> int:
        with self._lock:
            return self._total_token_count

    def token_count_stalled(self, check_interval: int = 3) -> bool:
        with self._lock:
            if len(self._nodes) < check_interval:
                return False

            recent_nodes = sorted(
                self._nodes.values(),
                key=lambda n: n.created_at,
                reverse=True
            )[:check_interval]

            if len(recent_nodes) < check_interval:
                return False

            hashes = set(n.content_hash for n in recent_nodes)
            return len(hashes) < check_interval

    def clear(self):
        with self._lock:
            self._nodes.clear()
            self._hash_index.clear()
            self._entity_index.clear()
            self._total_token_count = 0

    def clear_for_agent(self, agent_id: str):
        with self._lock:
            to_remove = [
                node_id for node_id, node in self._nodes.items()
                if node.agent_id == agent_id
            ]

            for node_id in to_remove:
                node = self._nodes[node_id]
                if node.content_hash in self._hash_index:
                    del self._hash_index[node.content_hash]

                if node.entity_type in self._entity_index:
                    self._entity_index[node.entity_type] = [
                        n for n in self._entity_index[node.entity_type]
                        if n != node_id
                    ]

                for other_id in node.connections:
                    if other_id in self._nodes:
                        if node_id in self._nodes[other_id].connections:
                            self._nodes[other_id].connections.remove(node_id)

                self._total_token_count -= len(node.content) // 4
                del self._nodes[node_id]

    def _cleanup_old_nodes(self):
        if len(self._nodes) <= self.MAX_NODES:
            return

        sorted_nodes = sorted(
            self._nodes.items(),
            key=lambda x: x[1].updated_at
        )

        to_remove = sorted_nodes[:len(self._nodes) - self.MAX_NODES]
        for node_id, node in to_remove:
            if node.content_hash in self._hash_index:
                del self._hash_index[node.content_hash]

            if node.entity_type in self._entity_index:
                self._entity_index[node.entity_type] = [
                    n for n in self._entity_index[node.entity_type]
                    if n != node_id
                ]

            for other_id in node.connections:
                if other_id in self._nodes and node_id in self._nodes[other_id].connections:
                    self._nodes[other_id].connections.remove(node_id)

            self._total_token_count -= len(node.content) // 4
            del self._nodes[node_id]

    def get_graph_summary(self, max_length: int = 1500) -> str:
        with self._lock:
            if not self._nodes:
                return "知识图谱为空"

            stats = self.get_deduplication_stats()
            recent_nodes = sorted(
                self._nodes.values(),
                key=lambda n: n.created_at,
                reverse=True
            )[:5]

            lines = [
                f"=== 知识图谱 ===",
                f"节点数: {stats['total_nodes']}, 去重率: {stats['deduplication_ratio']:.1%}",
                f"估算Token: {stats['estimated_tokens']}",
                "",
                "最近知识:",
            ]

            for node in recent_nodes:
                line = f"- [{node.entity_type}] {node.content[:100]}"
                if len(line) > 120:
                    line = line[:120] + "..."
                lines.append(line)

            result = "\n".join(lines)
            if len(result) > max_length:
                result = result[:max_length] + "...\n[内容过长已截断]"

            return result


graph_memory_service = GraphMemoryService()
