import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, Boolean, ForeignKey, JSON, Integer, TypeDecorator
from sqlalchemy.orm import relationship
from app.core.database import Base


class UUIDType(TypeDecorator):
    """UUID type for SQLite compatibility"""
    impl = String
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, uuid.UUID):
            return str(value)
        return value

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, str):
            return uuid.UUID(value)
        return value


class User(Base):
    __tablename__ = "users"

    id = Column(UUIDType, primary_key=True, default=lambda: str(uuid.uuid4()))
    username = Column(String(100), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    agents = relationship("Agent", back_populates="owner", cascade="all, delete-orphan")
    workspaces = relationship("Workspace", back_populates="owner", cascade="all, delete-orphan")
    messages = relationship("Message", back_populates="user", cascade="all, delete-orphan")
    workspace_memberships = relationship("WorkspaceMember", back_populates="user", cascade="all, delete-orphan")


class Workspace(Base):
    __tablename__ = "workspaces"

    id = Column(UUIDType, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    owner_id = Column(UUIDType, ForeignKey("users.id"), nullable=False)
    is_active = Column(Boolean, default=True, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    owner = relationship("User", back_populates="workspaces")
    departments = relationship("Department", back_populates="workspace", cascade="all, delete-orphan")
    agents = relationship("Agent", back_populates="workspace", cascade="all, delete-orphan")
    members = relationship("WorkspaceMember", back_populates="workspace", cascade="all, delete-orphan")
    knowledge_bases = relationship("KnowledgeBase", back_populates="workspace", cascade="all, delete-orphan")
    project_groups = relationship("ProjectGroup", back_populates="workspace", cascade="all, delete-orphan")


class WorkspaceMember(Base):
    __tablename__ = "workspace_members"

    id = Column(UUIDType, primary_key=True, default=lambda: str(uuid.uuid4()))
    workspace_id = Column(UUIDType, ForeignKey("workspaces.id"), nullable=False)
    user_id = Column(UUIDType, ForeignKey("users.id"), nullable=False)
    role = Column(String(50), nullable=False, default="member")
    joined_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    workspace = relationship("Workspace", back_populates="members")
    user = relationship("User")


class Department(Base):
    __tablename__ = "departments"

    id = Column(UUIDType, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    workspace_id = Column(UUIDType, ForeignKey("workspaces.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    workspace = relationship("Workspace", back_populates="departments")
    agents = relationship("Agent", back_populates="department")
    jobs = relationship("Job", back_populates="department", cascade="all, delete-orphan")


class Job(Base):
    __tablename__ = "jobs"

    id = Column(UUIDType, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    department_id = Column(UUIDType, ForeignKey("departments.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    department = relationship("Department", back_populates="jobs")
    agents = relationship("Agent", back_populates="job")


class Agent(Base):
    __tablename__ = "agents"

    id = Column(UUIDType, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(100), nullable=False)
    avatar = Column(String(500), nullable=True)
    role = Column(String(100), nullable=False)
    department_id = Column(UUIDType, ForeignKey("departments.id"), nullable=True)
    job_id = Column(UUIDType, ForeignKey("jobs.id"), nullable=True)
    workspace_id = Column(UUIDType, ForeignKey("workspaces.id"), nullable=False)
    owner_id = Column(UUIDType, ForeignKey("users.id"), nullable=False)

    # Agent configuration
    system_prompt = Column(Text, nullable=False, default="You are a helpful AI assistant.")
    model_config = Column(JSON, nullable=True)
    tools = Column(JSON, nullable=True, default=lambda: [])
    memory_namespace = Column(UUIDType, default=lambda: str(uuid.uuid4()))

    # Knowledge base binding
    knowledge_base_ids = Column(JSON, nullable=True, default=lambda: [])

    # Status
    status = Column(String(50), default="idle")  # idle, thinking, working, error

    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    owner = relationship("User", back_populates="agents")
    workspace = relationship("Workspace", back_populates="agents")
    department = relationship("Department", back_populates="agents")
    job = relationship("Job", back_populates="agents")
    memories = relationship("AgentMemory", back_populates="agent", cascade="all, delete-orphan")
    messages = relationship("Message", back_populates="agent", cascade="all, delete-orphan")
    project_group_memberships = relationship("ProjectGroupMember", back_populates="agent", cascade="all, delete-orphan")


class ProjectGroup(Base):
    __tablename__ = "project_groups"

    id = Column(UUIDType, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    workspace_id = Column(UUIDType, ForeignKey("workspaces.id"), nullable=False)
    supervisor_id = Column(UUIDType, ForeignKey("agents.id"), nullable=False)
    is_active = Column(Boolean, default=True)
    config = Column(JSON, nullable=True)  # Group configuration
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    workspace = relationship("Workspace")
    supervisor = relationship("Agent")
    members = relationship("ProjectGroupMember", back_populates="project_group", cascade="all, delete-orphan")
    messages = relationship("GroupMessage", back_populates="project_group", cascade="all, delete-orphan")


class ProjectGroupMember(Base):
    __tablename__ = "project_group_members"

    id = Column(UUIDType, primary_key=True, default=lambda: str(uuid.uuid4()))
    project_group_id = Column(UUIDType, ForeignKey("project_groups.id"), nullable=False)
    agent_id = Column(UUIDType, ForeignKey("agents.id"), nullable=False)
    joined_at = Column(DateTime, default=datetime.utcnow)
    role_in_group = Column(String(100), nullable=True)

    # Relationships
    project_group = relationship("ProjectGroup", back_populates="members")
    agent = relationship("Agent", back_populates="project_group_memberships")


class Message(Base):
    __tablename__ = "messages"

    id = Column(UUIDType, primary_key=True, default=lambda: str(uuid.uuid4()))
    content = Column(Text, nullable=False)
    message_type = Column(String(50), nullable=False)  # user, agent, system
    agent_id = Column(UUIDType, ForeignKey("agents.id"), nullable=True)
    user_id = Column(UUIDType, ForeignKey("users.id"), nullable=False)
    session_id = Column(UUIDType, nullable=False)
    token_count = Column(Integer, default=0)
    message_metadata = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    agent = relationship("Agent", back_populates="messages")
    user = relationship("User", back_populates="messages")


class ConversationSession(Base):
    __tablename__ = "conversation_sessions"

    id = Column(UUIDType, primary_key=True, default=lambda: str(uuid.uuid4()))
    agent_id = Column(UUIDType, ForeignKey("agents.id"), nullable=False)
    user_id = Column(UUIDType, ForeignKey("users.id"), nullable=False)
    title = Column(String(255), nullable=True)
    is_archived = Column(Boolean, default=False)
    checkpoint_data = Column(Text, nullable=True)  # Serialized LangGraph state
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    archived_at = Column(DateTime, nullable=True)


class AgentMemory(Base):
    __tablename__ = "agent_memories"

    id = Column(UUIDType, primary_key=True, default=lambda: str(uuid.uuid4()))
    agent_id = Column(UUIDType, ForeignKey("agents.id"), nullable=False)
    memory_type = Column(String(50), nullable=False)  # short_term, long_term, semantic
    content = Column(Text, nullable=False)
    memory_metadata = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    agent = relationship("Agent", back_populates="memories")


class KnowledgeBase(Base):
    __tablename__ = "knowledge_bases"

    id = Column(UUIDType, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    workspace_id = Column(UUIDType, ForeignKey("workspaces.id"), nullable=False)
    visibility = Column(String(50), default="private")  # private, team, readonly
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    workspace = relationship("Workspace", back_populates="knowledge_bases")
    documents = relationship("Document", back_populates="knowledge_base", cascade="all, delete-orphan")


class Document(Base):
    __tablename__ = "documents"

    id = Column(UUIDType, primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    file_path = Column(String(500), nullable=True)
    file_type = Column(String(50), nullable=True)
    knowledge_base_id = Column(UUIDType, ForeignKey("knowledge_bases.id"), nullable=False)
    chunk_count = Column(Integer, default=0)
    document_metadata = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    knowledge_base = relationship("KnowledgeBase", back_populates="documents")


class GroupMessage(Base):
    __tablename__ = "group_messages"

    id = Column(UUIDType, primary_key=True, default=lambda: str(uuid.uuid4()))
    project_group_id = Column(UUIDType, ForeignKey("project_groups.id"), nullable=False)
    content = Column(Text, nullable=False)
    message_type = Column(String(50), nullable=False)  # user, agent, system
    sender_agent_id = Column(UUIDType, ForeignKey("agents.id"), nullable=True)
    user_id = Column(UUIDType, ForeignKey("users.id"), nullable=True)
    token_count = Column(Integer, default=0)
    message_metadata = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    project_group = relationship("ProjectGroup", back_populates="messages")
    sender_agent = relationship("Agent")


class ConfigVersion(Base):
    __tablename__ = "config_versions"

    id = Column(UUIDType, primary_key=True, default=lambda: str(uuid.uuid4()))
    entity_type = Column(String(50), nullable=False)  # agent, project_group, etc.
    entity_id = Column(UUIDType, nullable=False)
    config_type = Column(String(50), nullable=False)  # system_prompt, model_config, etc.
    old_value = Column(JSON, nullable=True)
    new_value = Column(JSON, nullable=False)
    changed_by_user_id = Column(UUIDType, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class UsageStats(Base):
    __tablename__ = "usage_stats"

    id = Column(UUIDType, primary_key=True, default=lambda: str(uuid.uuid4()))
    agent_id = Column(UUIDType, ForeignKey("agents.id"), nullable=True)
    project_group_id = Column(UUIDType, ForeignKey("project_groups.id"), nullable=True)
    workspace_id = Column(UUIDType, ForeignKey("workspaces.id"), nullable=False)
    user_id = Column(UUIDType, ForeignKey("users.id"), nullable=True)
    date = Column(String(10), nullable=False)  # YYYY-MM-DD
    token_count = Column(Integer, default=0)
    message_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)