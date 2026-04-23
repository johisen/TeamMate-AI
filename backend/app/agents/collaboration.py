import asyncio
import json
import uuid
import re
from typing import Optional, List, Dict, Any, Callable
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum

from langchain_core.messages import HumanMessage, AIMessage, SystemMessage, BaseMessage

from app.core.config import settings
from app.agents.agent import llm_provider, TeamMateAgent, SubAgent, MainAgent, AgentManager
from app.services.blackboard_service import blackboard_service
from app.services.graph_memory_service import graph_memory_service
from app.services.task_router import task_router, TaskComplexity


class TaskStatus(Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    NEEDS_HUMAN_INTERVENTION = "needs_human_intervention"


@dataclass
class AgentTask:
    """Task assigned to an agent"""
    task_id: str
    agent_id: str
    agent_name: str
    description: str
    status: TaskStatus = TaskStatus.PENDING
    attempts: int = 0
    max_attempts: int = 7
    result: Optional[str] = None
    summary: Optional[str] = None
    error: Optional[str] = None
    model_used: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class RoundResult:
    """Result of a collaboration round"""
    round_number: int
    tasks: List[AgentTask]
    supervisor_response: str
    is_complete: bool
    needs_human_intervention: bool = False
    model_used: Optional[str] = None
    complexity: Optional[str] = None


class TeamCollaborationSession:
    """Manages multi-agent collaboration with context isolation

    Key principles:
    - Sub-agents work in isolation (no global history, no memory.md)
    - Sub-agents post conclusions to shared blackboard
    - Main agent only receives condensed summaries (100 chars)
    - Task routing selects appropriate model based on complexity
    """

    MAX_ROUNDS = 50
    PAUSE_INTERVAL = 50

    def __init__(
        self,
        session_id: str,
        supervisor_agent: MainAgent,
        member_agents: Dict[str, SubAgent],
        user_id: Optional[str] = None,
        project_group_id: Optional[str] = None,
    ):
        self.session_id = session_id
        self.supervisor = supervisor_agent
        self.members = member_agents
        self.user_id = user_id or "anonymous"
        self.project_group_id = project_group_id or session_id
        self.rounds: List[RoundResult] = []
        self.current_round: int = 0
        self.conversation_history: List[Dict[str, Any]] = []
        self.is_active: bool = True
        self.needs_human_intervention: bool = False
        self.human_intervention_message: Optional[str] = None

    def _build_supervisor_prompt(self, task_description: str) -> str:
        """Build supervisor prompt for task coordination with isolation"""
        member_list = "\n".join([
            f"- **{agent.name}** (ID: {agent.agent_id}): {agent.role}"
            for agent in self.members.values()
        ])

        blackboard_preview = blackboard_service.get_summary(max_length=500)

        return f"""You are {self.supervisor.name}, the team coordinator with CONTEXT ISOLATION.

IMPORTANT: You operate under strict context isolation rules:
- You receive ONLY 100-character summaries from sub-agents
- You do NOT have full conversation history
- You do NOT access memory.md, user.md, or long histories
- All shared knowledge comes from the BLACKBOARD
- Check the blackboard before assigning duplicate tasks

Your team members:
{member_list}

Current task: {task_description}

Blackboard Summary:
{blackboard_preview}

Your responsibilities:
1. Analyze task and break into sub-tasks
2. Assign @[agent_name]: [task] to SUB-AGENTS (they work in isolation)
3. Wait for sub-agents to post conclusions to blackboard
4. Read blackboard conclusions and aggregate
5. Provide final answer ONLY when user explicitly asks

Workflow:
1. User sends request
2. You decompose into sub-tasks
3. Sub-agents work ISOLATED, post to blackboard
4. You read blackboard conclusions
5. Aggregate and respond to user

CRITICAL RULES:
- YOU MUST ONLY USE AGENTS FROM THE "Your team members" LIST
- NEVER invent or reference non-existent agents
- Always use format @agent_name without brackets
"""

    def _build_sub_agent_task_prompt(self, agent: SubAgent, task: str) -> str:
        """Build isolated prompt for sub-agent task execution"""
        blackboard_context = ""

        recent_entries = blackboard_service.get_recent_entries(limit=5)
        if recent_entries:
            entries_text = "\n".join([
                f"- [{e.agent_name}]: {e.value[:100]}"
                for e in recent_entries
            ])
            blackboard_context = f"\nShared blackboard (avoid duplication):\n{entries_text}\n"

        routing_info = task_router.get_routing_info(task)
        model_info = f"[Use model: {routing_info['recommended_model']} - {routing_info['complexity']} task]"

        return f"""TASK: {task}

{agent.system_prompt}

{agent.role}

CONTEXT ISOLATION (STRICT):
- You are a SUB-AGENT handling a LOCAL task only
- NO access to global conversation history
- NO memory.md or user profile files
- Only task instruction + necessary tools
- Post your conclusion to blackboard when done

{blackboard_context}

{model_info}

Execute the task and provide your conclusion.
"""

    async def _execute_supervisor_round(self, user_message: str) -> Dict[str, Any]:
        """Execute a round with supervisor using isolated context"""
        self.current_round += 1

        routing_info = task_router.get_routing_info(user_message)
        model_name = routing_info["recommended_model"]

        blackboard_context = blackboard_service.get_summary(max_length=800)

        supervisor_prompt = self._build_supervisor_prompt(user_message)
        if blackboard_context:
            supervisor_prompt += f"\n\nLatest blackboard entries:\n{blackboard_context}\n"

        messages = [
            SystemMessage(content=supervisor_prompt),
            HumanMessage(content=user_message),
        ]

        try:
            response = await llm_provider.chat(messages, model_name=model_name)
            supervisor_response = response.content
        except Exception as e:
            supervisor_response = f"Supervisor error: {str(e)}"

        tasks = []
        mentions = self._parse_agent_mentions(supervisor_response)
        valid_agent_names = [agent.name.lower() for agent in self.members.values()]

        for agent_name, task_desc in mentions:
            found = False
            for agent in self.members.values():
                if agent.name.lower() == agent_name.lower():
                    task = AgentTask(
                        task_id=str(uuid.uuid4()),
                        agent_id=agent.agent_id,
                        agent_name=agent.name,
                        description=task_desc.strip(),
                        status=TaskStatus.PENDING
                    )
                    tasks.append(task)
                    found = True
                    break

            if not found and valid_agent_names:
                import random
                random_agent = random.choice(list(self.members.values()))
                task = AgentTask(
                    task_id=str(uuid.uuid4()),
                    agent_id=random_agent.agent_id,
                    agent_name=random_agent.name,
                    description=task_desc.strip(),
                    status=TaskStatus.PENDING
                )
                tasks.append(task)

        return {
            "supervisor_response": supervisor_response,
            "tasks": tasks,
            "round": self.current_round,
            "model_used": model_name,
            "complexity": routing_info["complexity"],
        }

    async def _execute_sub_agent_tasks(self, tasks: List[AgentTask]) -> List[AgentTask]:
        """Execute tasks with sub-agents in isolation"""
        for task in tasks:
            if task.status != TaskStatus.PENDING:
                continue

            task.status = TaskStatus.IN_PROGRESS
            task.attempts += 1
            task.updated_at = datetime.utcnow()

            agent = self.members.get(task.agent_id)
            if not agent:
                task.status = TaskStatus.FAILED
                task.error = f"Agent {task.agent_name} not found"
                continue

            try:
                routing_info = task_router.get_routing_info(task.description)
                model_name = routing_info["recommended_model"]
                task.model_used = model_name

                task_prompt = self._build_sub_agent_task_prompt(agent, task.description)

                messages = [
                    SystemMessage(content=task_prompt),
                    HumanMessage(content=task.description),
                ]

                response = await llm_provider.chat(messages, model_name=model_name)
                response_content = response.content

                task.result = response_content
                task.summary = response_content[:100]

                blackboard_service.write(
                    key=f"task_result_{agent.name}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}",
                    value=response_content,
                    agent_id=agent.agent_id,
                    agent_name=agent.name,
                    tags=[self.project_group_id, "task_result"],
                )

                graph_memory_service.add_knowledge(
                    content=response_content[:500],
                    entity_type="task_result",
                    agent_id=agent.agent_id,
                    agent_name=agent.name,
                    metadata={
                        "task": task.description[:200],
                        "project_group_id": self.project_group_id,
                        "model": model_name,
                    },
                )

                task.status = TaskStatus.COMPLETED

            except Exception as e:
                task.error = str(e)
                task.status = TaskStatus.FAILED

        return tasks

    def _parse_agent_mentions(self, text: str) -> List[tuple]:
        """Parse agent mentions from text"""
        pattern = r'@(?:\[([\w\d_-]+)\]|([\w\d_-]+))(?:\s*:\s*|\s+)(.+?)(?=(?:@(?:\[[\w\d_-]+\]|[\w\d_-]+))|$)'
        matches = []

        bracket_matches = re.findall(r'@\[([\w\d_-]+)\](?:\s*:\s*|\s+)(.+?)(?=(?:@(?:\[[\w\d_-]+\]|[\w\d_-]+))|$)', text, re.DOTALL)
        if bracket_matches:
            matches.extend(bracket_matches)

        if not matches:
            no_bracket_matches = re.findall(r'@([\w\d_-]+)(?:\s*:\s*|\s+)(.+?)(?=(?:@(?:\[[\w\d_-]+\]|[\w\d_-]+))|$)', text, re.DOTALL)
            if no_bracket_matches:
                matches.extend(no_bracket_matches)
            else:
                simple_pattern = r'@(?:\[([\w\d_-]+)\]|([\w\d_-]+))'
                simple_matches = re.findall(simple_pattern, text)
                for match in simple_matches:
                    agent_name = match[0] if match[0] else match[1]
                    matches.append((agent_name, text))

        return matches

    async def process_message(self, user_message: str) -> Dict[str, Any]:
        """Process a user message with context isolation"""

        if not self.is_active:
            return {
                "status": "error",
                "message": "Collaboration session is not active"
            }

        self.conversation_history.append({
            "role": "user",
            "content": user_message,
            "timestamp": datetime.utcnow().isoformat()
        })

        round_data = await self._execute_supervisor_round(user_message)

        if round_data["tasks"]:
            round_data["tasks"] = await self._execute_sub_agent_tasks(round_data["tasks"])
        elif not self.members:
            routing_info = task_router.get_routing_info(user_message)
            round_data["supervisor_response"] = f"{self.supervisor.name}: No sub-agents available. This is a {routing_info['complexity']} task."

        round_result = RoundResult(
            round_number=self.current_round,
            tasks=round_data["tasks"],
            supervisor_response=round_data["supervisor_response"],
            is_complete=False,
            model_used=round_data.get("model_used"),
            complexity=round_data.get("complexity"),
        )

        failed_tasks = [t for t in round_result.tasks if t.status == TaskStatus.FAILED]
        if failed_tasks and self.current_round >= self.MAX_ROUNDS:
            round_result.needs_human_intervention = True
            self.needs_human_intervention = True
            self.human_intervention_message = (
                f"After {self.MAX_ROUNDS} rounds, the following tasks could not be completed:\n" +
                "\n".join([f"- {t.agent_name}: {t.error}" for t in failed_tasks])
            )

        elif self.current_round % self.PAUSE_INTERVAL == 0:
            summary = self._generate_round_summary()
            round_result.needs_human_intervention = True
            self.needs_human_intervention = True
            self.human_intervention_message = (
                f"=== {self.PAUSE_INTERVAL} Rounds Summary ===\n" +
                f"Completed {self.current_round} rounds\n\n" +
                summary + "\n\nContinue?"
            )

        if all(t.status == TaskStatus.COMPLETED for t in round_result.tasks):
            round_result.is_complete = True

        self.conversation_history.append({
            "role": "assistant",
            "content": round_result.supervisor_response,
            "timestamp": datetime.utcnow().isoformat()
        })

        self.rounds.append(round_result)

        return self._format_response(round_result)

    def _format_response(self, result: RoundResult) -> Dict[str, Any]:
        """Format round result with isolated context info"""

        messages = []

        if result.supervisor_response:
            messages.append({
                "type": "supervisor",
                "agent_id": self.supervisor.agent_id,
                "agent_name": self.supervisor.name,
                "content": result.supervisor_response,
                "timestamp": datetime.utcnow().isoformat()
            })

        for task in result.tasks:
            if task.result:
                messages.append({
                    "type": "agent",
                    "agent_id": task.agent_id,
                    "agent_name": task.agent_name,
                    "content": task.result,
                    "summary": task.summary,
                    "task_status": task.status.value,
                    "model_used": task.model_used,
                    "timestamp": datetime.utcnow().isoformat()
                })

        response = {
            "status": "in_progress" if not result.is_complete else "completed",
            "round": result.round_number,
            "max_rounds": self.MAX_ROUNDS,
            "messages": messages,
            "is_complete": result.is_complete,
            "model_used": result.model_used,
            "complexity": result.complexity,
        }

        if result.needs_human_intervention:
            response["needs_human_intervention"] = True
            response["human_intervention_message"] = self.human_intervention_message

        return response

    def request_human_intervention(self, message: str) -> Dict[str, Any]:
        """Request human intervention"""
        self.needs_human_intervention = True
        self.human_intervention_message = message
        return {
            "status": "needs_human_intervention",
            "message": message,
            "session_id": self.session_id
        }

    def continue_after_intervention(self, user_feedback: str) -> Dict[str, Any]:
        """Continue after human intervention"""
        self.needs_human_intervention = False
        self.human_intervention_message = None
        return asyncio.run(self.process_message(user_feedback))

    def _generate_round_summary(self) -> str:
        """Generate summary of collaboration progress"""
        summary = []

        completed_tasks = 0
        failed_tasks = 0
        total_tasks = 0

        for round_result in self.rounds:
            for task in round_result.tasks:
                total_tasks += 1
                if task.status == TaskStatus.COMPLETED:
                    completed_tasks += 1
                elif task.status == TaskStatus.FAILED:
                    failed_tasks += 1

        summary.append(f"Tasks: {completed_tasks}/{total_tasks} completed")
        if failed_tasks > 0:
            summary.append(f"Failed: {failed_tasks}")

        agent_participation = {}
        for round_result in self.rounds:
            for task in round_result.tasks:
                if task.agent_name not in agent_participation:
                    agent_participation[task.agent_name] = 0
                agent_participation[task.agent_name] += 1

        summary.append("\nAgent participation:")
        for agent, count in agent_participation.items():
            summary.append(f"- {agent}: {count} tasks")

        dedup_stats = graph_memory_service.get_deduplication_stats()
        summary.append(f"\nGraph memory: {dedup_stats['total_nodes']} nodes, {dedup_stats['deduplication_ratio']:.1%} dedup")

        return "\n".join(summary)

    def get_blackboard_summary(self) -> str:
        """Get current blackboard summary"""
        return blackboard_service.get_summary()

    def get_graph_stats(self) -> Dict[str, Any]:
        """Get graph memory statistics"""
        return graph_memory_service.get_deduplication_stats()

    def stop(self) -> Dict[str, Any]:
        """Stop the collaboration session"""
        self.is_active = False
        return {
            "status": "stopped",
            "session_id": self.session_id,
            "rounds_completed": len(self.rounds)
        }


collaboration_sessions: Dict[str, TeamCollaborationSession] = {}


def get_or_create_collaboration_session(
    session_id: str,
    supervisor_agent: MainAgent,
    member_agents: Dict[str, SubAgent],
    user_id: Optional[str] = None,
    project_group_id: Optional[str] = None,
) -> TeamCollaborationSession:
    """Get or create a collaboration session with isolation"""
    if session_id in collaboration_sessions:
        return collaboration_sessions[session_id]

    session = TeamCollaborationSession(
        session_id=session_id,
        supervisor_agent=supervisor_agent,
        member_agents=member_agents,
        user_id=user_id,
        project_group_id=project_group_id,
    )
    collaboration_sessions[session_id] = session
    return session


async def process_collaboration_message(
    session_id: str,
    user_message: str,
    supervisor_agent: MainAgent,
    member_agents: Dict[str, SubAgent],
    user_id: Optional[str] = None,
    project_group_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Process a collaboration message with context isolation"""
    session = get_or_create_collaboration_session(
        session_id=session_id,
        supervisor_agent=supervisor_agent,
        member_agents=member_agents,
        user_id=user_id,
        project_group_id=project_group_id,
    )
    return await session.process_message(user_message)
