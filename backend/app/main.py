from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from sqlalchemy.ext.asyncio import AsyncSession
import uuid
from datetime import datetime

from app.core.config import settings
from app.core.database import engine, Base, get_db
from app.api import agents, workspaces, websocket, project_groups, analytics, export, knowledge, llm, tools, performance, departments, jobs
from app.models.models import Workspace


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Create database tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Initialize default departments
    from sqlalchemy import select
    from app.models.models import Department, Workspace, Agent
    from app.agents.agent import agent_manager

    async with AsyncSession(engine) as session:
        # Check if departments exist
        result = await session.execute(select(Department))
        existing_depts = result.scalars().all()

        if len(existing_depts) == 0:
            # Create default workspace if not exists
            ws_result = await session.execute(select(Workspace).where(Workspace.id == uuid.UUID('00000000-0000-0000-0000-000000000001')))
            workspace = ws_result.scalar_one_or_none()

            if not workspace:
                workspace = Workspace(
                    id=uuid.UUID('00000000-0000-0000-0000-000000000001'),
                    name="默认工作区",
                    description="系统默认工作区",
                    owner_id=uuid.UUID('00000000-0000-0000-0000-000000000000'),
                    is_active=True,
                )
                session.add(workspace)

            # Create default departments
            builtin_dept = Department(
                id=uuid.UUID('00000000-0000-0000-0000-000000000002'),
                name="内置",
                description="系统内置部门，不可编辑",
                workspace_id=uuid.UUID('00000000-0000-0000-0000-000000000001'),
            )
            default_dept = Department(
                id=uuid.UUID('00000000-0000-0000-0000-000000000003'),
                name="项目管理部",
                description="项目管理部门",
                workspace_id=uuid.UUID('00000000-0000-0000-0000-000000000001'),
            )

            session.add(builtin_dept)
            session.add(default_dept)
            await session.commit()
            print("Default departments initialized")

        # Load agents from database into agent_manager
        agents_result = await session.execute(select(Agent))
        existing_agents = agents_result.scalars().all()
        for agent in existing_agents:
            agent_manager.create_agent(
                agent_id=str(agent.id),
                name=agent.name,
                role=agent.role,
                system_prompt=agent.system_prompt,
                model_config=agent.model_config,
                tools=agent.tools or [],
            )
        print(f"Loaded {len(existing_agents)} agents into agent_manager")

        # Load project groups from database into group_agent_manager
        from app.models.models import ProjectGroup, ProjectGroupMember
        from app.agents.agent import group_agent_manager, SubAgent, MainAgent

        groups_result = await session.execute(select(ProjectGroup).where(ProjectGroup.is_active == True))
        existing_groups = groups_result.scalars().all()

        for group in existing_groups:
            # Get supervisor agent
            supervisor_agent = agent_manager.get_agent(str(group.supervisor_id))

            # Get member agents
            members_result = await session.execute(
                select(ProjectGroupMember).where(ProjectGroupMember.project_group_id == group.id)
            )
            members = members_result.scalars().all()
            member_agents = []
            for member in members:
                if str(member.agent_id) != str(group.supervisor_id):
                    agent = agent_manager.get_agent(str(member.agent_id))
                    if agent:
                        # Convert to SubAgent
                        sub_agent = SubAgent(
                            agent_id=agent.agent_id,
                            name=agent.name,
                            role=agent.role,
                            system_prompt=agent.system_prompt,
                            model_config=agent.model_config,
                            tools=agent.tools,
                            project_group_id=str(group.id),
                        )
                        member_agents.append(sub_agent)

            # Create group in group_agent_manager
            if supervisor_agent:
                # Convert to MainAgent
                main_agent = MainAgent(
                    agent_id=supervisor_agent.agent_id,
                    name=supervisor_agent.name,
                    role=supervisor_agent.role,
                    system_prompt=supervisor_agent.system_prompt,
                    model_config=supervisor_agent.model_config,
                    tools=supervisor_agent.tools,
                    project_group_id=str(group.id),
                )
                group_agent_manager.create_group(
                    project_group_id=str(group.id),
                    supervisor_agent=main_agent,
                    member_agents=member_agents,
                )
                print(f"Loaded project group: {group.name} ({group.id})")

        print(f"Loaded {len(existing_groups)} project groups into group_agent_manager")

    yield
    # Shutdown: Dispose engine
    await engine.dispose()


# Create FastAPI app
app = FastAPI(
    title="Teamily AI API",
    description="Teamily AI 系统 API",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routes
app.include_router(agents.router, prefix=settings.API_V1_STR, tags=["agents"])
app.include_router(workspaces.router, prefix=settings.API_V1_STR, tags=["workspaces"])
app.include_router(departments.router, prefix=settings.API_V1_STR, tags=["departments"])
app.include_router(jobs.router, prefix=settings.API_V1_STR, tags=["jobs"])
app.include_router(project_groups.router, prefix=settings.API_V1_STR, tags=["project-groups"])
app.include_router(analytics.router, prefix=settings.API_V1_STR, tags=["analytics"])
app.include_router(export.router, prefix=settings.API_V1_STR, tags=["export"])
app.include_router(knowledge.router, prefix=settings.API_V1_STR, tags=["knowledge"])
app.include_router(llm.router, prefix=settings.API_V1_STR, tags=["llm"])
app.include_router(tools.router, prefix=settings.API_V1_STR, tags=["tools"])
app.include_router(performance.router, prefix=settings.API_V1_STR, tags=["performance"])

# WebSocket route
app.include_router(websocket.router)


@app.get("/")
async def root():
    return {"message": "Teamily AI API"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


@app.get("/api/v1/test")
async def test_endpoint():
    return {"message": "Test endpoint works!"}