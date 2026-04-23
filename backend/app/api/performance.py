from fastapi import APIRouter, HTTPException
from typing import Dict, Any

from app.services.performance import (
    cache_manager,
    agent_pool,
    rate_limiter,
    performance_monitor,
)

router = APIRouter(prefix="/performance", tags=["performance"])


@router.get("/stats")
async def get_performance_stats() -> Dict[str, Any]:
    """Get overall performance statistics"""
    return {
        "active_tasks": agent_pool.get_active_count(),
        "max_concurrent": agent_pool._max_concurrent,
        "cache_stats": {
            "memory_cache_size": len(cache_manager._memory_cache),
            "use_redis": cache_manager._use_redis,
        },
    }


@router.get("/agents/{agent_id}/stats")
async def get_agent_stats(agent_id: str) -> Dict[str, Any]:
    """Get performance stats for a specific agent"""
    return performance_monitor.get_stats(agent_id)


@router.get("/agents/stats")
async def get_all_agent_stats() -> Dict[str, Any]:
    """Get performance stats for all agents"""
    return performance_monitor.get_all_stats()


@router.post("/cache/clear")
async def clear_cache(pattern: str = "*") -> Dict[str, Any]:
    """Clear cache matching pattern"""
    count = await cache_manager.clear_pattern(pattern)
    return {"success": True, "cleared": count}


@router.get("/health")
async def health_check() -> Dict[str, Any]:
    """System health check"""
    return {
        "status": "healthy",
        "active_tasks": agent_pool.get_active_count(),
        "cache_available": True,
    }
