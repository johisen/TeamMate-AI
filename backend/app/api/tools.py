from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
import json

from app.services.tools import TOOL_REGISTRY, WebSearchTool, CodeExecutorTool

router = APIRouter(prefix="/tools", tags=["tools"])


# In-memory tool settings (would be stored in database in production)
TOOL_SETTINGS = {
    "web_search": {"enabled": True},
    "code_executor": {"enabled": True},
    "file_reader": {"enabled": True},
}


@router.get("/")
async def list_tools() -> List[Dict[str, Any]]:
    """List all available tools"""
    tools = []
    for tool_id, tool_info in TOOL_REGISTRY.items():
        tools.append({
            **tool_info,
            "enabled": TOOL_SETTINGS.get(tool_id, {}).get("enabled", True),
        })
    return tools


@router.get("/{tool_id}")
async def get_tool(tool_id: str) -> Dict[str, Any]:
    """Get tool details"""
    if tool_id not in TOOL_REGISTRY:
        raise HTTPException(status_code=404, detail="Tool not found")

    return {
        **TOOL_REGISTRY[tool_id],
        "enabled": TOOL_SETTINGS.get(tool_id, {}).get("enabled", True),
    }


@router.put("/{tool_id}/enable")
async def enable_tool(tool_id: str) -> Dict[str, Any]:
    """Enable a tool"""
    if tool_id not in TOOL_REGISTRY:
        raise HTTPException(status_code=404, detail="Tool not found")

    TOOL_SETTINGS[tool_id] = {"enabled": True}

    return {
        "success": True,
        "tool_id": tool_id,
        "enabled": True,
    }


@router.put("/{tool_id}/disable")
async def disable_tool(tool_id: str) -> Dict[str, Any]:
    """Disable a tool"""
    if tool_id not in TOOL_REGISTRY:
        raise HTTPException(status_code=404, detail="Tool not found")

    TOOL_SETTINGS[tool_id] = {"enabled": False}

    return {
        "success": True,
        "tool_id": tool_id,
        "enabled": False,
    }


@router.post("/web_search/test")
async def test_web_search(query: str = "test") -> Dict[str, Any]:
    """Test web search"""
    tool = WebSearchTool()
    return await tool.search(query)


@router.post("/code_executor/test")
async def test_code_executor(code: str = "print('Hello, World!')") -> Dict[str, Any]:
    """Test code executor"""
    tool = CodeExecutorTool()
    return await tool.execute(code)


@router.get("/enabled")
async def get_enabled_tools() -> List[str]:
    """Get list of enabled tool IDs"""
    return [
        tool_id
        for tool_id, settings in TOOL_SETTINGS.items()
        if settings.get("enabled", True)
    ]
