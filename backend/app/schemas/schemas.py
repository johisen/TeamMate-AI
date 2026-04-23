from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Any
from uuid import UUID
from datetime import datetime


# ============ User Schemas ============
class UserBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=100)
    email: str = Field(..., max_length=255)
    full_name: Optional[str] = None


class UserCreate(UserBase):
    password: str = Field(..., min_length=6)


class UserUpdate(BaseModel):
    email: Optional[str] = None
    full_name: Optional[str] = None
    password: Optional[str] = None


class UserResponse(UserBase):
    id: UUID
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ============ Workspace Schemas ============
class WorkspaceBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None


class WorkspaceCreate(WorkspaceBase):
    pass


class WorkspaceUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class WorkspaceResponse(WorkspaceBase):
    id: UUID
    owner_id: UUID
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class WorkspaceMemberBase(BaseModel):
    user_id: UUID
    role: str = "member"


class WorkspaceMemberAdd(BaseModel):
    user_id: UUID
    role: str = "member"


class WorkspaceMemberUpdate(BaseModel):
    role: str


class WorkspaceMemberResponse(WorkspaceMemberBase):
    id: UUID
    workspace_id: UUID
    joined_at: datetime
    user_email: Optional[str] = None
    user_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# ============ Agent Schemas ============
class AgentBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    avatar: Optional[str] = None
    role: str = Field(..., min_length=1, max_length=100)
    department_id: Optional[UUID] = None
    job_id: Optional[UUID] = None


class AgentCreate(AgentBase):
    workspace_id: UUID
    system_prompt: Optional[str] = "You are a helpful AI assistant."
    model_config_json: Optional[dict] = None
    tools: Optional[List[str]] = []
    knowledge_base_ids: Optional[List[UUID]] = []


class AgentUpdate(BaseModel):
    name: Optional[str] = None
    avatar: Optional[str] = None
    role: Optional[str] = None
    department_id: Optional[UUID] = None
    job_id: Optional[UUID] = None
    system_prompt: Optional[str] = None
    model_config_json: Optional[dict] = None
    tools: Optional[List[str]] = None
    status: Optional[str] = None
    knowledge_base_ids: Optional[List[UUID]] = None


class AgentResponse(AgentBase):
    id: UUID
    workspace_id: UUID
    owner_id: UUID
    department_id: Optional[UUID] = None
    system_prompt: str
    model_config_json: Optional[dict] = None
    tools: List[str] = []
    knowledge_base_ids: List[UUID] = []
    memory_namespace: UUID
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AgentCreateResponse(BaseModel):
    id: UUID
    name: str
    role: str
    department_id: Optional[UUID] = None
    job_id: Optional[UUID] = None
    workspace_id: UUID
    owner_id: UUID
    system_prompt: str
    status: str
    knowledge_base_ids: List[UUID] = []


# ============ Message Schemas ============
class MessageBase(BaseModel):
    content: str = Field(..., min_length=1)


class MessageCreate(MessageBase):
    agent_id: UUID
    session_id: UUID


class MessageResponse(MessageBase):
    id: UUID
    message_type: str
    agent_id: Optional[UUID] = None
    user_id: UUID
    session_id: UUID
    token_count: int
    metadata: Optional[dict] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class WebSocketMessage(BaseModel):
    type: str  # chat, typing, status_update
    content: Optional[str] = None
    agent_id: Optional[UUID] = None
    session_id: Optional[UUID] = None
    metadata: Optional[dict] = None


# ============ Session Schemas ============
class SessionCreate(BaseModel):
    agent_id: UUID


class SessionResponse(BaseModel):
    id: UUID
    agent_id: UUID
    user_id: UUID
    title: Optional[str] = None
    is_archived: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ============ Workspace Schemas ============
class WorkspaceBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None


class WorkspaceCreate(WorkspaceBase):
    pass


class WorkspaceUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class WorkspaceResponse(WorkspaceBase):
    id: UUID
    owner_id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ============ Department Schemas ============
class DepartmentBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None


class DepartmentCreate(DepartmentBase):
    workspace_id: UUID


class DepartmentResponse(DepartmentBase):
    id: UUID
    workspace_id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ============ Knowledge Base Schemas ============
class KnowledgeBaseBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None


class KnowledgeBaseCreate(KnowledgeBaseBase):
    workspace_id: UUID
    visibility: Optional[str] = "private"


class KnowledgeBaseUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    visibility: Optional[str] = None


class KnowledgeBaseResponse(KnowledgeBaseBase):
    id: UUID
    workspace_id: UUID
    visibility: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ============ Document Schemas ============
class DocumentBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    content: str
    file_path: Optional[str] = None
    file_type: Optional[str] = None


class DocumentCreate(DocumentBase):
    knowledge_base_id: UUID


class DocumentResponse(DocumentBase):
    id: UUID
    knowledge_base_id: UUID
    chunk_count: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ============ Chat Schemas ============
class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1)
    agent_id: UUID
    session_id: UUID


class ChatResponse(BaseModel):
    message_id: UUID
    content: str
    agent_id: UUID
    token_count: int


class ResetContextRequest(BaseModel):
    session_id: UUID


class ResetContextResponse(BaseModel):
    success: bool
    message: str


# ============ Export Schemas ============
class ExportRequest(BaseModel):
    workspace_id: Optional[str] = None
    agent_id: Optional[str] = None
    session_id: Optional[str] = None
    format: Optional[str] = "json"  # json or csv


# ============ Project Group Schemas ============
class ProjectGroupBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    is_active: bool = True


class ProjectGroupCreate(ProjectGroupBase):
    workspace_id: UUID
    supervisor_id: UUID
    member_agent_ids: List[UUID] = []


class ProjectGroupUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    supervisor_id: Optional[UUID] = None
    config: Optional[dict] = None


class ProjectGroupMemberResponse(BaseModel):
    id: UUID
    agent_id: UUID
    joined_at: datetime
    role_in_group: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class ProjectGroupResponse(ProjectGroupBase):
    id: UUID
    workspace_id: UUID
    supervisor_id: UUID
    config: Optional[dict] = None
    created_at: datetime
    updated_at: datetime
    members: List[ProjectGroupMemberResponse] = []

    model_config = ConfigDict(from_attributes=True)


class AddGroupMemberRequest(BaseModel):
    agent_id: UUID
    role_in_group: Optional[str] = None


class RemoveGroupMemberRequest(BaseModel):
    agent_id: UUID


# ============ Group Message Schemas ============
class GroupMessageBase(BaseModel):
    content: str = Field(..., min_length=1)


class GroupMessageCreate(GroupMessageBase):
    project_group_id: UUID


class GroupMessageResponse(GroupMessageBase):
    id: UUID
    project_group_id: UUID
    message_type: str
    sender_agent_id: Optional[UUID] = None
    user_id: Optional[UUID] = None
    token_count: int
    metadata: Optional[dict] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ============ LLM Provider Schemas ============
class LLMProviderBase(BaseModel):
    name: str
    default_model: str
    api_key_env: str


class LLMProviderCreate(LLMProviderBase):
    id: str


class LLMProviderUpdate(BaseModel):
    name: Optional[str] = None
    default_model: Optional[str] = None
    api_key_env: Optional[str] = None


class LLMProviderResponse(LLMProviderBase):
    id: str
    configured: bool

    model_config = ConfigDict(from_attributes=True)


# ============ LLM Model Schemas ============
class LLMModelBase(BaseModel):
    name: str
    provider: str


class LLMModelCreate(LLMModelBase):
    pass


class LLMModelUpdate(BaseModel):
    name: Optional[str] = None
    provider: Optional[str] = None


class LLMModelResponse(LLMModelBase):
    id: str

    model_config = ConfigDict(from_attributes=True)


# ============ Group Chat Schemas ============
class GroupChatRequest(BaseModel):
    message: str = Field(..., min_length=1)
    mention_agent_ids: List[str] = []


class GroupChatResponse(BaseModel):
    message_id: UUID
    content: str
    sender_agent_id: Optional[UUID] = None
    token_count: int


# ============ Usage Stats Schemas ============
class UsageStatsRequest(BaseModel):
    start_date: Optional[str] = None  # YYYY-MM-DD
    end_date: Optional[str] = None    # YYYY-MM-DD
    group_by: str = "day"  # day, week, month


class UsageStatsResponse(BaseModel):
    total_token_count: int
    total_message_count: int
    by_date: List[dict] = []
    by_agent: List[dict] = []


# ============ Config Version Schemas ============
class ConfigVersionResponse(BaseModel):
    id: UUID
    entity_type: str
    entity_id: UUID
    config_type: str
    old_value: Optional[dict] = None
    new_value: dict
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
