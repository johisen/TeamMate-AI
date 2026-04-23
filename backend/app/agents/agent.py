import json
import uuid
import sys
from typing import Optional, List, Dict, Any, Callable, Awaitable
from dataclasses import dataclass, field
from datetime import datetime

from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage, BaseMessage
from langchain_core.callbacks import CallbackManagerForRetrieverRun
from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic

from app.core.config import settings
from app.services.memory_service import memory_service
from app.services.blackboard_service import blackboard_service
from app.services.graph_memory_service import graph_memory_service
from app.services.task_router import task_router, TaskComplexity
from app.services.context_compressor import context_compressor


@dataclass
class AgentState:
    messages: List[BaseMessage] = field(default_factory=list)
    context: Dict[str, Any] = field(default_factory=dict)
    agent_id: Optional[str] = None
    session_id: Optional[str] = None
    user_id: Optional[str] = None


@dataclass
class SubAgentConfig:
    isolation_mode: bool = True
    max_summary_length: int = 100
    enable_blackboard: bool = True
    enable_graph_memory: bool = True
    disable_memory_files: bool = True
    disable_user_context: bool = True


class LLMProvider:
    """Unified LLM provider supporting multiple models"""

    def __init__(self):
        self.models = {}
        self.default_model = settings.DEFAULT_MODEL

    def get_model(self, model_name: Optional[str] = None) -> ChatOpenAI:
        """Get or create LLM model instance"""
        model = model_name or self.default_model

        if model in self.models:
            return self.models[model]

        if "deepseek" in model:
            llm = ChatOpenAI(
                model=model,
                api_key=settings.DEEPSEEK_API_KEY or "",
                base_url="https://api.deepseek.com",
                temperature=settings.DEFAULT_TEMPERATURE,
                max_tokens=settings.DEFAULT_MAX_TOKENS,
            )
        elif "gpt" in model or "o1" in model:
            llm = ChatOpenAI(
                model=model,
                api_key=settings.OPENAI_API_KEY or "",
                temperature=settings.DEFAULT_TEMPERATURE,
                max_tokens=settings.DEFAULT_MAX_TOKENS,
            )
        elif "claude" in model:
            llm = ChatAnthropic(
                model=model,
                api_key=settings.ANTHROPIC_API_KEY or "",
                temperature=settings.DEFAULT_TEMPERATURE,
                max_tokens=settings.DEFAULT_MAX_TOKENS,
            )
        elif "glm" in model:
            llm = ChatOpenAI(
                model=model,
                api_key=settings.ZHIPU_API_KEY or "",
                base_url="https://open.bigmodel.cn/api/paas/v4",
                temperature=settings.DEFAULT_TEMPERATURE,
                max_tokens=settings.DEFAULT_MAX_TOKENS,
            )
        else:
            llm = ChatOpenAI(
                model="deepseek-chat",
                api_key=settings.DEEPSEEK_API_KEY or "",
                base_url="https://api.deepseek.com",
                temperature=settings.DEFAULT_TEMPERATURE,
                max_tokens=settings.DEFAULT_MAX_TOKENS,
            )

        self.models[model] = llm
        return llm

    async def chat(
        self,
        messages: List[BaseMessage],
        model_name: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
    ) -> AIMessage:
        """Send chat request to LLM"""
        import asyncio
        
        # If a specific model is requested, only try that model
        if model_name:
            models_to_try = [model_name]
        else:
            # Try models in order of preference as fallback
            models_to_try = ["deepseek-chat"]
        
        for model in models_to_try:
            try:
                llm = self.get_model(model)
                
                if temperature is not None:
                    llm = ChatOpenAI(
                        model=llm.model_name,
                        api_key=llm.openai_api_key,
                        temperature=temperature,
                        max_tokens=max_tokens or settings.DEFAULT_MAX_TOKENS,
                    )

                # Add timeout for each model invocation
                try:
                    response = await asyncio.wait_for(
                        llm.ainvoke(messages),
                        timeout=60.0  # 60 seconds timeout per model (increased for complex tasks and network latency)
                    )
                    print(f"Successfully used model: {model}")
                    return response
                except asyncio.TimeoutError:
                    print(f"Model {model} invocation timed out")
                    # If a specific model was requested, don't try other models
                    if model_name:
                        raise Exception(f"Model {model} timed out after 60 seconds")
                    continue
            except Exception as e:
                import traceback
                print(f"Model {model} invocation failed: {str(e)}")
                print(f"Error traceback: {traceback.format_exc()}")
                # If a specific model was requested, don't try other models
                if model_name:
                    raise
                # Continue to next model
                continue
        
        # All models failed
        raise Exception("All LLM models failed to respond. Please check your API keys and network connection.")


llm_provider = LLMProvider()


class TeamMateAgent:
    """TeamMateAI Agent with LangGraph integration"""

    def __init__(
        self,
        agent_id: str,
        name: str,
        role: str,
        system_prompt: str,
        model_config: Optional[Dict[str, Any]] = None,
        tools: Optional[List[Any]] = None,
    ):
        self.agent_id = agent_id
        self.name = name
        self.role = role
        self.system_prompt = system_prompt
        self.model_config = model_config or {}
        self.tools = tools or []
        self.graph = None
        self.checkpointer = None
        self.full_system_prompt = self._build_system_prompt()

    def _build_system_prompt(self) -> str:
        """Build full system prompt with role and context"""
        return f"""You are {self.name}, a {self.role} at TeamMateAI.

{self.system_prompt}

Remember:
- You are part of a team working together
- Be helpful, professional, and collaborative
- If you need information from other team members, ask them directly
- Always provide accurate and well-reasoned responses
"""

    def _create_chat_node(self, llm: ChatOpenAI):
        """Create the chat processing node with memory support"""

        async def chat_node(state: AgentState) -> AgentState:
            messages = state.messages
            agent_id = state.agent_id or self.agent_id
            user_message = messages[-1].content if messages else ""

            relevant_memories = []
            if user_message and agent_id:
                relevant_memories = await memory_service.get_relevant_memories(
                    agent_id=agent_id,
                    query=user_message,
                    limit=5,
                )

            memory_prompt = ""
            if relevant_memories:
                memory_prompt = "\n\n=== Relevant Past Conversations ===\n"
                memory_prompt += "\n".join(relevant_memories)
                memory_prompt += "\n=== End of Memories ===\n"

            if not any(isinstance(m, SystemMessage) for m in messages):
                full_prompt = self.full_system_prompt + memory_prompt
                messages = [SystemMessage(content=full_prompt)] + messages
            elif memory_prompt:
                first_message = messages[0]
                if isinstance(first_message, SystemMessage):
                    enhanced_content = first_message.content + memory_prompt
                    messages = [SystemMessage(content=enhanced_content)] + messages[1:]

            response = await llm_provider.chat(messages)

            new_messages = messages + [response]

            if len(new_messages) >= 10 and agent_id:
                message_list = [
                    {"type": m.type, "content": m.content}
                    for m in new_messages
                ]
                session_id = state.context.get("session_id", "")
                await memory_service.store_conversation_memory(
                    agent_id=agent_id,
                    session_id=session_id,
                    messages=message_list,
                )

            return {
                "messages": new_messages,
                "context": state.context,
                "agent_id": agent_id,
            }

        return chat_node

    def build_graph(self, checkpointer: Optional[Any] = None):
        """Build the LangGraph state machine"""
        model_name = self.model_config.get("model", settings.DEFAULT_MODEL)
        llm = llm_provider.get_model(model_name)

        graph = StateGraph(AgentState)

        graph.add_node("chat", self._create_chat_node(llm))

        graph.set_entry_point("chat")

        graph.add_edge("chat", END)

        self.graph = graph.compile(checkpointer=checkpointer)

        return self.graph

    async def invoke(
        self,
        user_message: str,
        session_id: Optional[str] = None,
        user_id: Optional[str] = None,
        config: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Invoke the agent with a user message"""
        if self.graph is None:
            self.build_graph()

        initial_state = AgentState(
            messages=[HumanMessage(content=user_message)],
            context={
                "agent_id": self.agent_id,
                "session_id": session_id or str(uuid.uuid4()),
                "user_id": user_id or "anonymous",
            }
        )

        config = config or {}
        if session_id:
            config["configurable"] = {"thread_id": session_id}

        result = await self.graph.ainvoke(initial_state, config=config)

        response_message = result["messages"][-1] if result["messages"] else ""

        return {
            "response": response_message.content if hasattr(response_message, "content") else str(response_message),
            "messages": [
                {"type": m.type, "content": m.content}
                for m in result["messages"]
            ],
            "session_id": result["context"].get("session_id", session_id),
        }

    async def get_stream(
        self,
        user_message: str,
        session_id: Optional[str] = None,
        user_id: Optional[str] = None,
    ):
        """Get streaming response from the agent"""
        if self.graph is None:
            self.build_graph()

        initial_state = AgentState(
            messages=[HumanMessage(content=user_message)],
            context={
                "agent_id": self.agent_id,
                "session_id": session_id or str(uuid.uuid4()),
                "user_id": user_id or "anonymous",
            }
        )

        config = {}
        if session_id:
            config["configurable"] = {"thread_id": session_id}

        async for chunk in self.graph.astream(initial_state, config=config):
            if "chat" in chunk:
                messages = chunk["chat"].get("messages", [])
                if messages:
                    last_message = messages[-1]
                    if hasattr(last_message, "content"):
                        yield last_message.content


class SubAgent(TeamMateAgent):
    """Sub-agent with context isolation

    Characteristics:
    - No global history
    - No memory.md, user.md files
    - Only receives: task instruction + necessary tools
    - Posts conclusions to blackboard
    """

    def __init__(
        self,
        agent_id: str,
        name: str,
        role: str,
        system_prompt: str,
        model_config: Optional[Dict[str, Any]] = None,
        tools: Optional[List[Any]] = None,
        project_group_id: Optional[str] = None,
    ):
        super().__init__(agent_id, name, role, system_prompt, model_config, tools)
        self.project_group_id = project_group_id
        self.isolation_config = SubAgentConfig(
            isolation_mode=True,
            max_summary_length=100,
            enable_blackboard=True,
            enable_graph_memory=True,
            disable_memory_files=True,
            disable_user_context=True,
        )

    def _build_isolated_system_prompt(self, task_instruction: str) -> str:
        """Build isolated system prompt for sub-agent

        Only contains:
        - Role info
        - Task instruction
        - Tool descriptions
        - NO historical context
        - NO user profile
        - NO memory references
        """
        base_prompt = f"""You are {self.name}, a {self.role}.

TASK: {task_instruction}

Your role: {self.role}
{self.system_prompt}

IMPORTANT CONTEXT ISOLATION RULES:
- You are a SUB-AGENT handling a LOCAL task
- Do NOT ask about or reference global conversation history
- Do NOT access memory.md or user profile information
- Only focus on completing the assigned task
- When done, write your conclusion to the shared blackboard

After completing the task:
1. Provide your direct answer/conclusion
2. Write key findings to the blackboard using: @blackboard:[key]=[conclusion]
3. If the task is complex, break it into steps and report progress

DO NOT:
- Ask for clarification about unrelated topics
- Reference previous conversations
- Access information outside your task scope
"""
        return base_prompt

    async def invoke_isolated(
        self,
        task_instruction: str,
        context_from_blackboard: Optional[str] = None,
        parent_agent_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Invoke sub-agent with isolated context

        Args:
            task_instruction: Specific task to complete
            context_from_blackboard: Optional context from shared blackboard
            parent_agent_id: ID of parent/main agent for blackboard posting

        Returns:
            Dict with response content and blackboard entries
        """
        routing_info = task_router.get_routing_info(task_instruction)
        model_name = routing_info["recommended_model"]

        system_prompt = self._build_isolated_system_prompt(task_instruction)

        if context_from_blackboard:
            system_prompt += f"\n\n=== Shared Context from Blackboard ===\n{context_from_blackboard}\n===\n"

        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=task_instruction),
        ]

        try:
            response = await llm_provider.chat(messages, model_name=model_name)
            response_content = response.content

            if self.isolation_config.enable_blackboard and self.project_group_id:
                blackboard_entry = blackboard_service.write(
                    key=f"task_result_{self.name}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}",
                    value=response_content[:self.isolation_config.max_summary_length * 10],
                    agent_id=self.agent_id,
                    agent_name=self.name,
                    tags=[self.project_group_id, "task_result"],
                )

                if self.isolation_config.enable_graph_memory:
                    graph_memory_service.add_knowledge(
                        content=response_content[:500],
                        entity_type="task_result",
                        agent_id=self.agent_id,
                        agent_name=self.name,
                        metadata={
                            "task": task_instruction[:200],
                            "project_group_id": self.project_group_id,
                        },
                    )

                return {
                    "response": response_content,
                    "summary": response_content[:self.isolation_config.max_summary_length],
                    "blackboard_written": True,
                    "model_used": model_name,
                    "complexity": routing_info["complexity"],
                    "sender_agent_id": self.agent_id,  # Include sender agent ID
                }

            return {
                "response": response_content,
                "summary": response_content[:self.isolation_config.max_summary_length],
                "blackboard_written": False,
                "model_used": model_name,
                "complexity": routing_info["complexity"],
                "sender_agent_id": self.agent_id,  # Include sender agent ID
            }

        except Exception as e:
            return {
                "error": str(e),
                "response": None,
                "summary": None,
                "blackboard_written": False,
                "model_used": model_name,
                "complexity": routing_info["complexity"],
                "sender_agent_id": self.agent_id,  # Include sender agent ID
            }


class MainAgent(TeamMateAgent):
    """Main/Supervisor agent with context aggregation

    Characteristics:
    - Only receives condensed conclusions (100 char summary)
    - Uses Blackboard for shared information
    - Uses Graph Memory for deduplicated knowledge
    - Coordinates sub-agents
    - Does NOT process full conversations
    """

    def __init__(
        self,
        agent_id: str,
        name: str,
        role: str,
        system_prompt: str,
        model_config: Optional[Dict[str, Any]] = None,
        tools: Optional[List[Any]] = None,
        project_group_id: Optional[str] = None,
    ):
        super().__init__(agent_id, name, role, system_prompt, model_config, tools)
        self.project_group_id = project_group_id
        self.max_conclusion_length = 100

    def _build_main_agent_prompt(self) -> str:
        """Build system prompt for main/supervisor agent"""
        member_info = ""
        if hasattr(self, 'member_agents') and self.member_agents:
            member_info = "\nTeam members:\n"
            for agent in self.member_agents.values():
                member_info += f"- {agent.name} ({agent.role})\n"

        return f"""You are {self.name}, the SUPERVISOR/MAIN AGENT of this project group.

Your role:
1. Analyze user requests and decompose into sub-tasks
2. Assign sub-tasks to SUB-AGENTS (NOT yourself)
3. Wait for sub-agents to post their conclusions to the blackboard
4. Aggregate conclusions and provide final answer to user
5. You do NOT execute tasks yourself - you delegate

KEY CONTEXT ISOLATION RULES:
- You receive ONLY condensed conclusions from sub-agents (max 100 chars each)
- You do NOT see full conversation history
- You do NOT access memory.md or user profile
- All shared knowledge comes from the BLACKBOARD
- Check the blackboard for previous findings before assigning tasks

{member_info}

Workflow:
1. User sends request
2. You decompose into sub-tasks
3. You assign @[sub-agent-name]: [task]
4. Sub-agents work ISOLATED and post to blackboard
5. You read blackboard conclusions and aggregate
6. You provide final answer to user

DO NOT:
- Process full documents or long histories
- Access sub-agent internal states
- Keep full conversation context
"""

    async def get_blackboard_summary(self) -> str:
        """Get condensed summary from blackboard"""
        if not self.project_group_id:
            return ""

        entries = blackboard_service.get_recent_entries(limit=10)
        if not entries:
            return ""

        parts = ["=== Sub-Agent Conclusions ==="]
        for entry in entries:
            if entry.tags and self.project_group_id in entry.tags:
                summary = entry.value[:self.max_conclusion_length]
                if len(entry.value) > self.max_conclusion_length:
                    summary += "..."
                parts.append(f"[{entry.agent_name}]: {summary}")

        return "\n".join(parts)

    async def invoke_with_isolation(
        self,
        user_message: str,
        mention_agent_ids: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Main agent invocation with full context isolation"""
        complexity, reason = task_router.analyze_complexity(user_message)
        model_name = task_router.route(user_message)

        blackboard_context = await self.get_blackboard_summary()
        graph_summary = graph_memory_service.get_graph_summary()

        system_prompt = self._build_main_agent_prompt()

        if blackboard_context:
            system_prompt += f"\n\n{blackboard_context}\n"
        if graph_summary:
            system_prompt += f"\n\n{graph_summary}\n"

        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_message),
        ]

        try:
            response = await llm_provider.chat(messages, model_name=model_name)

            return {
                "response": response.content,
                "model_used": model_name,
                "complexity": complexity.value,
                "blackboard_context_used": bool(blackboard_context),
                "graph_memory_used": bool(graph_summary),
            }

        except Exception as e:
            return {
                "error": str(e),
                "response": None,
                "model_used": model_name,
                "complexity": complexity.value,
            }


class AgentManager:
    """Manager for all TeamMateAI agents"""

    def __init__(self):
        self.agents: Dict[str, TeamMateAgent] = {}
        self.sessions: Dict[str, List[Dict[str, Any]]] = {}

    def create_agent(
        self,
        agent_id: str,
        name: str,
        role: str,
        system_prompt: str,
        model_config: Optional[Dict[str, Any]] = None,
        tools: Optional[List[Any]] = None,
    ) -> TeamMateAgent:
        """Create and register a new agent"""
        agent = TeamMateAgent(
            agent_id=agent_id,
            name=name,
            role=role,
            system_prompt=system_prompt,
            model_config=model_config,
            tools=tools,
        )
        agent.build_graph()
        self.agents[agent_id] = agent
        return agent

    def get_agent(self, agent_id: str) -> Optional[TeamMateAgent]:
        """Get an agent by ID"""
        return self.agents.get(agent_id)

    def remove_agent(self, agent_id: str) -> bool:
        """Remove an agent"""
        if agent_id in self.agents:
            del self.agents[agent_id]
            return True
        return False

    async def chat(
        self,
        agent_id: str,
        message: str,
        session_id: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Chat with an agent"""
        agent = self.get_agent(agent_id)
        if not agent:
            raise ValueError(f"Agent {agent_id} not found")

        return await agent.invoke(
            user_message=message,
            session_id=session_id,
            user_id=user_id,
        )

    async def reset_session(self, session_id: str) -> bool:
        """Reset a session (clears conversation history)"""
        if session_id in self.sessions:
            self.sessions[session_id] = []
            return True
        return False

    def list_agents(self) -> List[Dict[str, Any]]:
        """List all registered agents"""
        return [
            {
                "agent_id": agent.agent_id,
                "name": agent.name,
                "role": agent.role,
            }
            for agent in self.agents.values()
        ]


agent_manager = AgentManager()


@dataclass
class GroupState:
    """Group conversation state for multi-agent collaboration"""
    messages: List[BaseMessage] = field(default_factory=list)
    context: Dict[str, Any] = field(default_factory=dict)
    project_group_id: Optional[str] = None
    current_speaker: Optional[str] = None
    next_speakers: List[str] = field(default_factory=list)
    mention_agent_ids: List[str] = field(default_factory=list)
    task_completed: bool = False


class ProjectGroupAgent:
    """Supervisor agent for multi-agent group collaboration with context isolation"""

    def __init__(
        self,
        project_group_id: str,
        supervisor_agent: MainAgent,
        member_agents: List[SubAgent],
    ):
        self.project_group_id = project_group_id
        self.supervisor = supervisor_agent
        self.members = {agent.agent_id: agent for agent in member_agents}
        self.members[supervisor_agent.agent_id] = supervisor_agent
        self.graph = None
        self.conversation_history: List[BaseMessage] = []
        
        print(f"[DEBUG] ProjectGroupAgent.__init__")
        print(f"[DEBUG]   supervisor: {supervisor_agent.name} ({supervisor_agent.agent_id})")
        print(f"[DEBUG]   member_agents count: {len(member_agents)}")
        for ma in member_agents:
            print(f"[DEBUG]   member: {ma.name} ({ma.agent_id})")
        print(f"[DEBUG]   self.members count: {len(self.members)}")
        for mid, m in self.members.items():
            print(f"[DEBUG]   self.members[{mid}]: {m.name}")

    def _build_supervisor_prompt(self) -> str:
        """Build supervisor system prompt with member info"""
        member_descriptions = "\n".join([
            f"- {agent.name} (ID: {agent.agent_id}): {agent.role}"
            for agent in self.members.values()
        ])

        return f"""You are {self.supervisor.name}, the supervisor of this project group.

Your role:
1. Analyze user messages and determine which team member(s) should handle the task
2. Assign tasks to appropriate team members using @[name]: [task]
3. Coordinate communication between team members
4. Summarize results and provide final responses ONLY when explicitly requested

Team members:
{member_descriptions}

Guidelines:
- If a specific team member is mentioned (@[name]), assign directly to them
- Otherwise, decide based on the task type and team member roles
- You can assign to multiple team members if needed
- Only summarize and provide final answer when the user explicitly asks (e.g., "总结", "summary")
- Check the blackboard for previous conclusions before assigning duplicate tasks

CONTEXT ISOLATION:
- You receive ONLY 100-char conclusions from sub-agents
- You do NOT have full conversation history
- Use blackboard and graph memory for shared knowledge
"""

    async def _invoke_supervisor(self, user_message: str) -> Dict[str, Any]:
        """Invoke supervisor with isolated context"""
        return await self.supervisor.invoke_with_isolation(user_message)

    async def _invoke_sub_agent(
        self,
        agent: SubAgent,
        task: str,
        context: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Invoke a sub-agent with isolated context"""
        result = await agent.invoke_isolated(
            task_instruction=task,
            context_from_blackboard=context,
            parent_agent_id=self.supervisor.agent_id,
        )
        return result

    async def invoke(
        self,
        user_message: str,
        mention_agent_ids: List[str] = None,
        config: Optional[Dict[str, Any]] = None,
        message_callback: Callable[[dict], Awaitable[None]] = None,
    ) -> Dict[str, Any]:
        """Invoke the group agent collaboration with context isolation"""
        
        async def send_message(msg_type: str, content: str, agent_id: str = None, agent_name: str = None, extra_data: dict = None):
            """Helper to send message via callback if provided"""
            if message_callback:
                msg = {
                    "type": msg_type,
                    "content": content,
                    "timestamp": datetime.utcnow().isoformat()
                }
                if agent_id:
                    msg["agent_id"] = agent_id
                if agent_name:
                    msg["agent_name"] = agent_name
                if extra_data:
                    msg.update(extra_data)
                try:
                    await message_callback(msg)
                except Exception as e:
                    print(f"[DEBUG] message_callback error: {e}")

        # Store message callback for use in graph nodes
        self.message_callback = message_callback

        # Build graph after setting message callback
        if self.graph is None:
            self.build_graph()

        cleaned_message = user_message.strip()

        if not cleaned_message or not cleaned_message.replace(' ', ''):
            return {
                "responses": [{
                    "content": "请提供具体的消息内容，以便我能更好地理解您的需求。",
                    "sender_agent_id": self.supervisor.agent_id
                }],
                "final_response": "请提供具体的消息内容，以便我能更好地理解您的需求。",
                "all_messages": [
                    {"type": "human", "content": user_message},
                    {"type": "ai", "content": "请提供具体的消息内容，以便我能更好地理解您的需求。"}
                ],
            }

        user_msg = HumanMessage(content=cleaned_message)

        all_messages = [user_msg]

        initial_state = GroupState(
            messages=all_messages,
            context={
                "project_group_id": self.project_group_id,
            },
            project_group_id=self.project_group_id,
            mention_agent_ids=mention_agent_ids or [],
        )

        result = await self.graph.ainvoke(initial_state, config=config or {})

        # Still store the conversation history for future reference
        for msg in result["messages"]:
            if msg.type in ["human", "ai"] and msg not in self.conversation_history:
                self.conversation_history.append(msg)

        if len(self.conversation_history) > 100:
            self.conversation_history = self.conversation_history[-100:]

        responses = []

        # Get mention agent IDs from initial state
        mention_agent_ids = initial_state.mention_agent_ids

        # Process messages - collect all AI messages
        ai_messages = [msg for msg in result["messages"] if msg.type == "ai"]

        # Get worker agent IDs from context (populated by worker nodes)
        context = result.get("context", {})
        worker_agent_ids = context.get("worker_agent_ids", [])

        print(f"[DEBUG] Worker agent IDs from context: {worker_agent_ids}")

        # Build a mapping of agent names to IDs
        agent_name_to_id = {agent.name: agent_id for agent_id, agent in self.members.items()}
        agent_id_to_name = {agent_id: name for name, agent_id in agent_name_to_id.items()}

        # Count how many supervisor delegation messages there are
        # These are messages that start with @ and contain a task (e.g., "@product-manager: 请做...")
        delegation_messages = []
        for msg in ai_messages:
            content = msg.content
            if content.strip().startswith("@") and ":" in content.split("\n")[0]:
                delegation_messages.append(msg)

        # Worker responses are the AI messages that are NOT delegation messages and NOT the last message
        worker_response_count = len(ai_messages) - len(delegation_messages) - 1  # -1 for summary

        print(f"[DEBUG] Worker response count: {worker_response_count}")
        print(f"[DEBUG] Mention agent IDs: {mention_agent_ids}")
        print(f"[DEBUG] AI messages count: {len(ai_messages)}")
        print(f"[DEBUG] Delegation messages count: {len(delegation_messages)}")

        # If we have worker_agent_ids from context, use them for assignment
        if worker_agent_ids:
            worker_index = 0
            for i, msg in enumerate(ai_messages):
                content = msg.content
                is_delegation = content.strip().startswith("@") and ":" in content.split("\n")[0]

                if is_delegation:
                    print(f"[DEBUG] Message {i} is delegation, assigned to supervisor")
                    responses.append({
                        "content": content,
                        "sender_agent_id": self.supervisor.agent_id,
                    })
                    await send_message("agent_thinking", f"正在协调任务分配...", self.supervisor.agent_id, self.supervisor.name)
                elif i == len(ai_messages) - 1:
                    print(f"[DEBUG] Message {i} is last (summary), assigned to supervisor")
                    responses.append({
                        "content": content,
                        "sender_agent_id": self.supervisor.agent_id,
                    })
                    # 不再发送agent_response，因为worker节点已经发送过了
                    # await send_message("agent_response", content, self.supervisor.agent_id, self.supervisor.name)
                else:
                    if worker_index < len(worker_agent_ids):
                        sender_agent_id = worker_agent_ids[worker_index]
                        sender_agent = self.members.get(sender_agent_id)
                        sender_name = sender_agent.name if sender_agent else "Unknown"
                        print(f"[DEBUG] Message {i} is worker response, assigned to {sender_agent_id} (worker_index={worker_index})")
                        worker_index += 1
                    else:
                        if worker_index < len(mention_agent_ids):
                            sender_agent_id = mention_agent_ids[worker_index]
                            sender_agent = self.members.get(sender_agent_id)
                            sender_name = sender_agent.name if sender_agent else "Unknown"
                            print(f"[DEBUG] Message {i} is worker response, fallback to mention {sender_agent_id} (mention_index={worker_index})")
                        else:
                            member_ids = list(self.members.keys())
                            member_ids.remove(self.supervisor.agent_id)
                            sender_agent_id = member_ids[worker_index % len(member_ids)]
                            sender_agent = self.members.get(sender_agent_id)
                            sender_name = sender_agent.name if sender_agent else "Unknown"
                            print(f"[DEBUG] Message {i} is worker response, fallback to member {sender_agent_id} (member_index={worker_index % len(member_ids)})")
                        worker_index += 1

                    responses.append({
                        "content": content,
                        "sender_agent_id": sender_agent_id,
                    })
                    # 不再发送agent_response，因为worker节点已经发送过了
                    # await send_message("agent_response", content, sender_agent_id, sender_name)
        # If we have mentions but no worker_agent_ids, use mentions for assignment
        elif mention_agent_ids and worker_response_count > 0:
            # Track which workers have been assigned
            worker_index = 0
            for i, msg in enumerate(ai_messages):
                content = msg.content
                is_delegation = content.strip().startswith("@") and ":" in content.split("\n")[0]

                if is_delegation:
                    print(f"[DEBUG] Message {i} is delegation, assigned to supervisor")
                    responses.append({
                        "content": content,
                        "sender_agent_id": self.supervisor.agent_id,
                    })
                    await send_message("agent_thinking", "正在协调任务分配...", self.supervisor.agent_id, self.supervisor.name)
                elif i == len(ai_messages) - 1:
                    print(f"[DEBUG] Message {i} is last (summary), assigned to supervisor")
                    responses.append({
                        "content": content,
                        "sender_agent_id": self.supervisor.agent_id,
                    })
                    await send_message("agent_response", content, self.supervisor.agent_id, self.supervisor.name)
                else:
                    if worker_index < len(mention_agent_ids):
                        sender_agent_id = mention_agent_ids[worker_index]
                        sender_agent = self.members.get(sender_agent_id)
                        sender_name = sender_agent.name if sender_agent else "Unknown"
                        print(f"[DEBUG] Message {i} is worker response, assigned to {sender_agent_id} (mention_index={worker_index})")
                    else:
                        member_ids = list(self.members.keys())
                        member_ids.remove(self.supervisor.agent_id)
                        if len(member_ids) == 0:
                            sender_agent_id = self.supervisor.agent_id
                        else:
                            sender_agent_id = member_ids[worker_index % len(member_ids)]
                        sender_agent = self.members.get(sender_agent_id)
                        sender_name = sender_agent.name if sender_agent else "Unknown"
                        print(f"[DEBUG] Message {i} is worker response, fallback assigned to {sender_agent_id} (member_index={worker_index % len(member_ids) if member_ids else 0})")
                    worker_index += 1

                    responses.append({
                        "content": content,
                        "sender_agent_id": sender_agent_id,
                    })
                    # 不再发送agent_response，因为worker节点已经发送过了
                    # await send_message("agent_response", content, sender_agent_id, sender_name)
        else:
            # No mentions - assign based on message position
            member_ids = list(self.members.keys())
            member_ids.remove(self.supervisor.agent_id)

            for i, msg in enumerate(ai_messages):
                if i == len(ai_messages) - 1:
                    sender_agent_id = self.supervisor.agent_id
                    sender_name = self.supervisor.name
                else:
                    if len(member_ids) == 0:
                        sender_agent_id = self.supervisor.agent_id
                    else:
                        member_index = i % len(member_ids)
                        sender_agent_id = member_ids[member_index]
                    sender_agent = self.members.get(sender_agent_id)
                    sender_name = sender_agent.name if sender_agent else "Unknown"

                responses.append({
                    "content": msg.content,
                    "sender_agent_id": sender_agent_id,
                })
                await send_message("agent_response", msg.content, sender_agent_id, sender_name)

        return {
            "responses": responses,
            "final_response": responses[-1]["content"] if responses else "",
            "all_messages": [
                {"type": m.type, "content": m.content}
                for m in result["messages"]
            ],
        }

    def _router(self, state: GroupState) -> str:
        """Route to next node based on state"""
        if state.task_completed:
            return END

        if not state.next_speakers or len(state.next_speakers) == 0:
            return "summarizer"

        current_speaker = state.current_speaker
        if current_speaker in self.members and current_speaker != self.supervisor.agent_id:
            return f"worker_{current_speaker}"

        return "summarizer"

    def build_graph(self):
        """Build the multi-agent group collaboration graph"""
        graph = StateGraph(GroupState)

        graph.add_node("supervisor", self._create_supervisor_node())

        for agent_id, agent in self.members.items():
            if agent_id != self.supervisor.agent_id:
                graph.add_node(f"worker_{agent_id}", self._create_worker_node(agent))

        graph.add_node("summarizer", self._create_summarizer_node())

        graph.set_entry_point("supervisor")

        graph.add_conditional_edges(
            "supervisor",
            self._router,
        )

        for agent_id in self.members.keys():
            if agent_id != self.supervisor.agent_id:
                graph.add_conditional_edges(
                    f"worker_{agent_id}",
                    self._router,
                )

        graph.add_conditional_edges(
            "summarizer",
            self._router,
        )

        self.graph = graph.compile()
        return self.graph

    def _create_supervisor_node(self):
        """Create supervisor decision node with isolated context"""

        async def supervisor_node(state: GroupState) -> GroupState:
            messages = state.messages
            last_message = messages[-1] if messages else None
            
            # Parse @mentions from message content
            mentioned_agent_ids = []
            if last_message and hasattr(last_message, 'content'):
                content = last_message.content
                print(f"[DEBUG] Parsing mentions from: {content}")
                print(f"[DEBUG] Available members: {[(aid, a.name) for aid, a in self.members.items()]}")
                # Extract @mentions from message
                for agent_id, agent in self.members.items():
                    if agent_id == self.supervisor.agent_id:
                        continue
                    if f"@{agent.name}" in content or f"@{agent.name} " in content:
                        mentioned_agent_ids.append(agent_id)
                        print(f"[DEBUG] Found mention: @{agent.name} -> agent_id: {agent_id}")
            
            print(f"[DEBUG] Parsed mentioned_agent_ids: {mentioned_agent_ids}")
            
            # If there are mentions in the message, trigger those agents to respond
            if mentioned_agent_ids:
                return {
                    "messages": messages,
                    "context": state.context,
                    "next_speakers": mentioned_agent_ids,
                    "current_speaker": mentioned_agent_ids[0],
                    "mention_agent_ids": mentioned_agent_ids,  # Keep mentions for speaker assignment
                }

            # No mentions - supervisor generates response and summarizes
            system_content = self._build_supervisor_prompt()

            supervisor_messages = [
                SystemMessage(content=system_content),
            ]

            if last_message:
                if hasattr(last_message, 'content'):
                    supervisor_messages.append(HumanMessage(content=last_message.content))

            model_name = self.supervisor.model_config.get("model", settings.DEFAULT_MODEL)
            response = await llm_provider.chat(
                supervisor_messages,
                model_name=model_name,
            )

            # Check if supervisor's response contains @mentions
            supervisor_response_content = response.content
            response_mentioned_agent_ids = []
            print(f"[DEBUG] Checking supervisor response for mentions: {supervisor_response_content}")
            for agent_id, agent in self.members.items():
                if agent_id == self.supervisor.agent_id:
                    continue
                if f"@{agent.name}" in supervisor_response_content or f"@{agent.name} " in supervisor_response_content:
                    response_mentioned_agent_ids.append(agent_id)
                    print(f"[DEBUG] Found mention in supervisor response: @{agent.name} -> agent_id: {agent_id}")
            
            print(f"[DEBUG] Parsed response_mentioned_agent_ids: {response_mentioned_agent_ids}")
            
            # If supervisor's response contains mentions, trigger those agents
            if response_mentioned_agent_ids:
                return {
                    "messages": messages + [response],
                    "context": state.context,
                    "next_speakers": response_mentioned_agent_ids,
                    "current_speaker": response_mentioned_agent_ids[0],
                    "mention_agent_ids": response_mentioned_agent_ids,  # Keep mentions for speaker assignment
                }

            # No mentions in supervisor response - just add the response and summarize
            return {
                "messages": messages + [response],
                "context": state.context,
                "next_speakers": [],
                "current_speaker": None,
                "mention_agent_ids": [],
            }

        return supervisor_node

    def _create_worker_node(self, agent: SubAgent):
        """Create worker agent node with isolated context"""

        # Store reference to self for use in the closure
        self_ref = self

        def create_worker_node(agent):
            async def worker_node(state: GroupState) -> GroupState:
                messages = state.messages

                # Check if agent has isolated system prompt method
                if hasattr(agent, '_build_isolated_system_prompt'):
                    system_prompt = agent._build_isolated_system_prompt("Complete the assigned task")
                else:
                    # Fallback for MainAgent or TeamMateAgent
                    system_prompt = f"You are {agent.name}, a {agent.role}.\n\n{agent.system_prompt}"

                # Only include the last message for context isolation
                worker_messages = [
                    SystemMessage(content=system_prompt),
                ]
                
                if messages:
                    last_message = messages[-1]
                    if hasattr(last_message, 'content'):
                        # Create a clear task instruction for the worker
                        task_instruction = f"Task for {agent.name}: {last_message.content}"
                        worker_messages.append(HumanMessage(content=task_instruction))

                # Send worker start message
                if hasattr(self_ref, 'message_callback') and self_ref.message_callback:
                    await self_ref.message_callback({
                        "type": "agent_thinking",
                        "agent_id": agent.agent_id,
                        "agent_name": agent.name,
                        "content": f"正在处理任务...",
                        "timestamp": datetime.utcnow().isoformat()
                    })

                try:
                    model_name = agent.model_config.get("model", settings.DEFAULT_MODEL)
                    response = await llm_provider.chat(
                        worker_messages,
                        model_name=model_name,
                    )
                except Exception as e:
                    print(f"[DEBUG] worker_node: Error calling llm for {agent.name}: {e}")
                    response = AIMessage(content=f"处理任务时出错: {str(e)}")

                # Send worker response message
                if hasattr(self_ref, 'message_callback') and self_ref.message_callback:
                    await self_ref.message_callback({
                        "type": "agent_response",
                        "agent_id": agent.agent_id,
                        "agent_name": agent.name,
                        "content": response.content if hasattr(response, 'content') else str(response),
                        "timestamp": datetime.utcnow().isoformat()
                    })

                # Add agent_id to response content as metadata (for sender assignment)
                # We store the sender info in the message itself via additional response info
                new_messages = messages + [response]

                # Store the sender agent ID in context for later assignment
                new_context = dict(state.context) if state.context else {}
                if "worker_agent_ids" not in new_context:
                    new_context["worker_agent_ids"] = []
                new_context["worker_agent_ids"].append(agent.agent_id)
                print(f"[DEBUG] worker_node: added {agent.agent_id} ({agent.name}) to worker_agent_ids, total: {new_context['worker_agent_ids']}")

                remaining_speakers = [
                    s for s in state.next_speakers if s != agent.agent_id
                ]

                return {
                    "messages": new_messages,
                    "context": new_context,
                    "next_speakers": remaining_speakers,
                    "current_speaker": remaining_speakers[0] if remaining_speakers else None,
                }

            return worker_node

        return create_worker_node(agent)

    def _create_summarizer_node(self):
        """Create summarizer node with blackboard integration"""

        async def summarizer_node(state: GroupState) -> GroupState:
            messages = state.messages

            blackboard_summary = blackboard_service.get_summary()
            graph_summary = graph_memory_service.get_graph_summary()

            summary_prompt = f"""You are {self.supervisor.name}. Summarize the conversation and provide a final answer.

BLACKBOARD CONCLUSIONS:
{blackboard_summary}

GRAPH MEMORY:
{graph_summary}

Recent conversation:
{[f"{m.type}: {m.content[:300]}..." for m in messages[-10:]]}

Provide a concise final summary (max 200 words).
"""

            summary_messages = [
                SystemMessage(content=summary_prompt),
            ]

            model_name = self.supervisor.model_config.get("model", settings.DEFAULT_MODEL)
            response = await llm_provider.chat(
                summary_messages,
                model_name=model_name,
            )

            return {
                "messages": messages + [response],
                "context": state.context,
                "next_speakers": [],
                "current_speaker": None,
                "task_completed": True,
            }

        return summarizer_node


class GroupAgentManager:
    """Manager for project group agents"""

    def __init__(self):
        self.groups: Dict[str, ProjectGroupAgent] = {}

    def create_group(
        self,
        project_group_id: str,
        supervisor_agent: MainAgent,
        member_agents: List[SubAgent],
    ) -> ProjectGroupAgent:
        """Create and register a new group agent"""
        group = ProjectGroupAgent(
            project_group_id=project_group_id,
            supervisor_agent=supervisor_agent,
            member_agents=member_agents,
        )
        group.build_graph()
        self.groups[project_group_id] = group
        return group

    def get_group(self, project_group_id: str) -> Optional[ProjectGroupAgent]:
        """Get a group by ID"""
        return self.groups.get(project_group_id)

    def remove_group(self, project_group_id: str) -> bool:
        """Remove a group"""
        if project_group_id in self.groups:
            blackboard_service.clear_for_project(project_group_id)
            graph_memory_service.clear()
            del self.groups[project_group_id]
            return True
        return False

    async def group_chat(
        self,
        project_group_id: str,
        message: str,
        mention_agent_ids: List[str] = None,
        message_callback: Callable[[dict], Awaitable[None]] = None,
    ) -> Dict[str, Any]:
        """Chat with a group agent"""
        group = self.get_group(project_group_id)
        if not group:
            raise ValueError(f"Group {project_group_id} not found")

        print(f"[DEBUG] group_chat: group.members count = {len(group.members)}")
        for mid, m in group.members.items():
            print(f"[DEBUG] group_chat: member {mid}: {m.name}")

        return await group.invoke(
            user_message=message,
            mention_agent_ids=mention_agent_ids,
            message_callback=message_callback,
        )


group_agent_manager = GroupAgentManager()
