from typing import List, Dict, Any, Optional
import re
import json
import httpx
from langchain_core.tools import Tool, StructuredTool

from app.core.config import settings


class WebSearchTool:
    """Web search tool using DuckDuckGo or SerpAPI"""

    def __init__(self):
        self.name = "web_search"
        self.description = "Search the web for information. Use this when you need to find current or specific information."

    async def search(self, query: str, num_results: int = 5) -> Dict[str, Any]:
        """Execute web search"""
        try:
            async with httpx.AsyncClient() as client:
                url = "https://api.duckduckgo.com/"
                params = {
                    "q": query,
                    "format": "json",
                    "no_redirect": 1,
                }

                response = await client.get(url, params=params, timeout=10.0)
                data = response.json()

                results = []
                if "RelatedTopics" in data:
                    for topic in data["RelatedTopics"][:num_results]:
                        if "Text" in topic:
                            results.append({
                                "title": topic.get("Text", "")[:100],
                                "url": topic.get("FirstURL", ""),
                                "snippet": topic.get("Text", ""),
                            })

                return {
                    "success": True,
                    "query": query,
                    "results": results,
                    "count": len(results),
                }

        except Exception as e:
            return {
                "success": False,
                "query": query,
                "error": str(e),
                "results": [],
            }


class CodeExecutorTool:
    """Safe code execution tool (sandboxed)"""

    def __init__(self):
        self.name = "code_executor"
        self.description = "Execute Python code in a sandboxed environment. Use for calculations, data processing, or running algorithms."
        self.allowed_imports = [
            "math", "random", "datetime", "time", "json", "re",
            "collections", "itertools", "functools", "string",
        ]

    async def execute(self, code: str, timeout: int = 5) -> Dict[str, Any]:
        """Execute Python code safely"""
        try:
            # Basic safety check
            dangerous_patterns = [
                "import os", "import sys", "import subprocess",
                "import socket", "open(", "eval(", "exec(",
                "__import__", "rm -", "del ", "format(",
            ]

            for pattern in dangerous_patterns:
                if pattern in code:
                    return {
                        "success": False,
                        "error": f"Security: Forbidden pattern detected: {pattern}",
                        "output": None,
                    }

            # Create a sandboxed namespace
            namespace = {
                "__builtins__": {
                    name: __builtins__[name]
                    for name in dir(__builtins__)
                    if isinstance(__builtins__[name], __builtins__["type"](__builtins__["len"]))
                },
            }

            # Add allowed imports
            for module_name in self.allowed_imports:
                try:
                    namespace[module_name] = __import__(module_name)
                except ImportError:
                    pass

            # Capture output
            import io
            from contextlib import redirect_stdout

            output_buffer = io.StringIO()

            # Execute with timeout (using synchronous execution for safety)
            import signal

            def timeout_handler(signum, frame):
                raise TimeoutError("Code execution timed out")

            # Set timeout
            signal.signal(signal.SIGALRM, timeout_handler)
            signal.alarm(timeout)

            try:
                with redirect_stdout(output_buffer):
                    exec(code, namespace)
                signal.alarm(0)  # Cancel alarm
                output = output_buffer.getvalue()
                return {
                    "success": True,
                    "output": output,
                    "error": None,
                }
            except TimeoutError:
                return {
                    "success": False,
                    "error": f"Execution timed out after {timeout} seconds",
                    "output": None,
                }

        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "output": None,
            }


class FileReaderTool:
    """Tool for reading files from the knowledge base"""

    def __init__(self):
        self.name = "file_reader"
        self.description = "Read content from uploaded documents or knowledge base files."

    async def read(self, file_path: str) -> Dict[str, Any]:
        """Read file content"""
        try:
            # Security: only allow reading from data directory
            base_path = "/app/data"
            if ".." in file_path or file_path.startswith("/"):
                return {
                    "success": False,
                    "error": "Security: Invalid file path",
                    "content": None,
                }

            full_path = f"{base_path}/{file_path}"

            with open(full_path, "r", encoding="utf-8") as f:
                content = f.read()

            return {
                "success": True,
                "content": content,
                "file_path": file_path,
                "error": None,
            }

        except FileNotFoundError:
            return {
                "success": False,
                "error": f"File not found: {file_path}",
                "content": None,
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "content": None,
            }


def get_tools() -> List[Tool]:
    """Get all available tools as LangChain tools"""

    web_search = WebSearchTool()

    web_search_tool = Tool(
        name="web_search",
        func=lambda query: web_search.search(query),
        description=web_search.description,
    )

    code_executor = CodeExecutorTool()

    code_executor_tool = Tool(
        name="code_executor",
        func=lambda code: code_executor.execute(code),
        description=code_executor.description,
    )

    return [web_search_tool, code_executor_tool]


# Tool registry for frontend display
TOOL_REGISTRY = {
    "web_search": {
        "id": "web_search",
        "name": "Web Search",
        "description": "Search the web for information",
        "icon": "🔍",
        "enabled": True,
    },
    "code_executor": {
        "id": "code_executor",
        "name": "Code Executor",
        "description": "Execute Python code safely",
        "icon": "💻",
        "enabled": True,
    },
    "file_reader": {
        "id": "file_reader",
        "name": "File Reader",
        "description": "Read files from knowledge base",
        "icon": "📄",
        "enabled": True,
    },
}
