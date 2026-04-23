from typing import Dict, Any, Optional, List
import asyncio
import time
from datetime import datetime, timedelta
import json

try:
    import redis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False


class CacheManager:
    """In-memory cache with optional Redis backend"""

    def __init__(self, redis_url: Optional[str] = None):
        self._memory_cache: Dict[str, tuple[Any, datetime]] = {}
        self._default_ttl = 300  # 5 minutes
        self._redis_client = None
        self._use_redis = False

        if redis_url and REDIS_AVAILABLE:
            try:
                self._redis_client = redis.from_url(redis_url, decode_responses=True)
                self._redis_client.ping()
                self._use_redis = True
            except Exception as e:
                print(f"Redis connection failed, using memory cache: {e}")

    async def get(self, key: str) -> Optional[Any]:
        """Get value from cache"""
        if self._use_redis and self._redis_client:
            try:
                value = self._redis_client.get(key)
                if value:
                    return json.loads(value)
            except Exception as e:
                print(f"Redis get error: {e}")

        # Memory cache fallback
        if key in self._memory_cache:
            value, expiry = self._memory_cache[key]
            if datetime.utcnow() < expiry:
                return value
            else:
                del self._memory_cache[key]
        return None

    async def set(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        """Set value in cache"""
        ttl = ttl or self._default_ttl

        if self._use_redis and self._redis_client:
            try:
                self._redis_client.setex(key, ttl, json.dumps(value))
                return True
            except Exception as e:
                print(f"Redis set error: {e}")

        # Memory cache fallback
        expiry = datetime.utcnow() + timedelta(seconds=ttl)
        self._memory_cache[key] = (value, expiry)
        return True

    async def delete(self, key: str) -> bool:
        """Delete key from cache"""
        if self._use_redis and self._redis_client:
            try:
                self._redis_client.delete(key)
            except Exception as e:
                print(f"Redis delete error: {e}")

        if key in self._memory_cache:
            del self._memory_cache[key]
        return True

    async def clear_pattern(self, pattern: str) -> int:
        """Clear all keys matching pattern"""
        count = 0
        if self._use_redis and self._redis_client:
            try:
                keys = self._redis_client.keys(pattern)
                if keys:
                    count = len(keys)
                    self._redis_client.delete(*keys)
            except Exception as e:
                print(f"Redis clear pattern error: {e}")

        # Clear from memory cache
        keys_to_delete = [k for k in self._memory_cache.keys() if pattern.replace('*', '') in k]
        for k in keys_to_delete:
            del self._memory_cache[k]
            count += 1

        return count


class AgentPool:
    """Pool of agents for concurrent processing"""

    def __init__(self, max_concurrent: int = 10):
        self._semaphore = asyncio.Semaphore(max_concurrent)
        self._active_tasks: Dict[str, asyncio.Task] = {}
        self._max_concurrent = max_concurrent

    async def run_task(self, task_id: str, coro) -> Any:
        """Run task with concurrency control"""
        async with self._semaphore:
            task = asyncio.create_task(coro)
            self._active_tasks[task_id] = task

            try:
                result = await task
                return result
            finally:
                if task_id in self._active_tasks:
                    del self._active_tasks[task_id]

    async def cancel_task(self, task_id: str) -> bool:
        """Cancel a running task"""
        if task_id in self._active_tasks:
            self._active_tasks[task_id].cancel()
            del self._active_tasks[task_id]
            return True
        return False

    def get_active_count(self) -> int:
        """Get number of active tasks"""
        return len(self._active_tasks)

    def is_busy(self) -> bool:
        """Check if pool is at capacity"""
        return self._active_tasks >= self._max_concurrent


class RateLimiter:
    """Token bucket rate limiter"""

    def __init__(self, max_requests: int, window_seconds: int):
        self._max_requests = max_requests
        self._window_seconds = window_seconds
        self._requests: Dict[str, List[float]] = {}

    async def acquire(self, key: str) -> bool:
        """Try to acquire a permit"""
        now = time.time()

        if key not in self._requests:
            self._requests[key] = []

        # Remove old requests outside the window
        self._requests[key] = [
            t for t in self._requests[key]
            if now - t < self._window_seconds
        ]

        if len(self._requests[key]) < self._max_requests:
            self._requests[key].append(now)
            return True

        return False

    async def get_wait_time(self, key: str) -> float:
        """Get seconds to wait before next request"""
        if key not in self._requests:
            return 0

        now = time.time()
        recent = [t for t in self._requests[key] if now - t < self._window_seconds]

        if len(recent) < self._max_requests:
            return 0

        oldest = min(recent)
        return max(0, self._window_seconds - (now - oldest))


class PerformanceMonitor:
    """Monitor agent performance metrics"""

    def __init__(self):
        self._metrics: Dict[str, List[Dict[str, Any]]] = {}
        self._max_metrics_per_agent = 1000

    def record_request(
        self,
        agent_id: str,
        duration_ms: float,
        token_count: int = 0,
        success: bool = True,
    ):
        """Record a request metric"""
        if agent_id not in self._metrics:
            self._metrics[agent_id] = []

        metric = {
            "timestamp": datetime.utcnow().isoformat(),
            "duration_ms": duration_ms,
            "token_count": token_count,
            "success": success,
        }

        self._metrics[agent_id].append(metric)

        # Trim old metrics
        if len(self._metrics[agent_id]) > self._max_metrics_per_agent:
            self._metrics[agent_id] = self._metrics[agent_id][-self._max_metrics_per_agent:]

    def get_stats(self, agent_id: str) -> Dict[str, Any]:
        """Get performance stats for an agent"""
        if agent_id not in self._metrics or not self._metrics[agent_id]:
            return {
                "total_requests": 0,
                "avg_duration_ms": 0,
                "avg_token_count": 0,
                "success_rate": 0,
            }

        metrics = self._metrics[agent_id]
        total = len(metrics)
        successes = sum(1 for m in metrics if m["success"])

        return {
            "total_requests": total,
            "avg_duration_ms": sum(m["duration_ms"] for m in metrics) / total,
            "avg_token_count": sum(m["token_count"] for m in metrics) / total,
            "success_rate": successes / total if total > 0 else 0,
            "min_duration_ms": min(m["duration_ms"] for m in metrics),
            "max_duration_ms": max(m["duration_ms"] for m in metrics),
        }

    def get_all_stats(self) -> Dict[str, Dict[str, Any]]:
        """Get stats for all agents"""
        return {agent_id: self.get_stats(agent_id) for agent_id in self._metrics}


# Global instances
cache_manager = CacheManager()
agent_pool = AgentPool(max_concurrent=10)
rate_limiter = RateLimiter(max_requests=100, window_seconds=60)
performance_monitor = PerformanceMonitor()
