AC# TeamMateAI

AI Team Collaboration Platform - 原生即时通讯 × 多 AI Agent 协作平台

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python](https://img.shields.io/badge/Python-3.10+-blue.svg)](https://www.python.org/)
[![React](https://img.shields.io/badge/React-18-green.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue.svg)](https://www.typescriptlang.org/)

## 项目简介

TeamMateAI 是一个创新的多 AI Agent 协作平台，将即时通讯与多智能体协作完美结合。用户可以创建由多个专业 AI Agent 组成的工作团队，通过自然语言进行协作，解决复杂任务。

### 核心特性

- **多 Agent 协作**：创建专业 AI 团队，多 Agent 并行处理任务
- **实时通讯**：基于 WebSocket 的实时消息推送
- **即时通讯体验**：类似 IM 的用户体验，支持 @提及、引用、表情等
- **上下文隔离**：各 Agent 独立工作，通过黑板共享关键信息
- **长对话管理**：支持对话归档、重置和上下文压缩A
- **可视化协作状态**：实时查看各 Agent 工作状态和协作过程

## 技术架构

### 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend                            │
│  React 18 + TypeScript + Zustand + Tailwind CSS            │
│  ├── 项目组聊天 (ProjectGroupChat)                          │
│  ├── AI 员工管理 (AgentsPage)                               │
│  ├── 知识库管理 (KnowledgePage)                             │
│  └── 设置页面 (SettingsPage)                                │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ WebSocket + REST API
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                         Backend                             │
│  FastAPI + LangGraph + LangChain                           │
│  ├── Agent System (Agent, SubAgent, MainAgent)              │
│  ├── Project Group (GroupAgentManager)                      │
│  ├── Services (Memory, Blackboard, TaskRouter)              │
│  └── API Routes (agents, project_groups, websocket)         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Data Layer                             │
│  ├── SQLite/PostgreSQL (关系数据)                          │
│  ├── Redis (缓存 + 会话)                                    │
│  └── Qdrant (向量数据库 - 知识检索)                         │
└─────────────────────────────────────────────────────────────┘
```

### 技术栈

#### 后端
- **框架**: FastAPI 0.104+
- **AI 引擎**: LangGraph 0.0.20+, LangChain 0.1.0+
- **LLM 支持**: OpenAI GPT, DeepSeek, Anthropic Claude, 智谱 GLM
- **数据库**: SQLAlchemy 2.0+ (支持 PostgreSQL, SQLite)
- **缓存**: Redis 5.0+
- **向量数据库**: Qdrant 1.7+
- **实时通讯**: WebSocket

#### 前端
- **框架**: React 18 + TypeScript 5
- **状态管理**: Zustand 4.4+
- **样式**: Tailwind CSS 3.3+
- **路由**: React Router 6
- **HTTP 客户端**: Axios
- **图表**: Recharts
- **图标**: Lucide React

## 项目结构

```
teammate-ai/
├── backend/                      # 后端服务
│   ├── app/
│   │   ├── agents/              # Agent 核心逻辑
│   │   │   ├── agent.py         # Agent 基类和多 Agent 实现
│   │   │   └── collaboration.py # 协作相关逻辑
│   │   ├── api/                 # API 路由
│   │   │   ├── agents.py        # Agent 管理 API
│   │   │   ├── project_groups.py # 项目组 API
│   │   │   └── websocket.py     # WebSocket 处理
│   │   ├── core/
│   │   │   ├── config.py        # 配置管理
│   │   │   └── database.py      # 数据库连接
│   │   ├── models/
│   │   │   └── models.py        # SQLAlchemy 模型
│   │   ├── schemas/
│   │   │   └── schemas.py       # Pydantic schemas
│   │   ├── services/            # 业务服务
│   │   │   ├── blackboard_service.py  # 黑板服务
│   │   │   ├── memory_service.py       # 记忆服务
│   │   │   ├── task_router.py         # 任务路由
│   │   │   └── graph_memory_service.py # 图记忆服务
│   │   └── main.py              # FastAPI 应用入口
│   ├── requirements.txt          # Python 依赖
│   └── Dockerfile
├── frontend/                     # 前端应用
│   ├── src/
│   │   ├── components/          # React 组件
│   │   │   ├── ProjectGroupChat.tsx  # 项目组聊天
│   │   │   ├── AgentCard.tsx         # Agent 卡片
│   │   │   └── Sidebar.tsx           # 侧边栏
│   │   ├── pages/               # 页面组件
│   │   │   ├── HomePage.tsx         # 首页
│   │   │   ├── AgentsPage.tsx       # Agent 管理页
│   │   │   └── KnowledgePage.tsx     # 知识库页
│   │   ├── stores/              # Zustand 状态管理
│   │   │   ├── agent.ts         # Agent 状态
│   │   │   ├── projectGroup.ts  # 项目组状态
│   │   │   └── auth.ts          # 认证状态
│   │   └── App.tsx              # React 应用入口
│   ├── package.json
│   ├── Dockerfile
│   └── vite.config.ts
├── docker/
│   └── docker-compose.yml       # Docker 部署配置
└── README.md
```

## 快速开始

### 环境要求

- Python 3.10+
- Node.js 18+
- Docker & Docker Compose (可选)

### 1. 克隆项目

```bash
git clone https://github.com/johisen/TeamMate-AI.git
cd TeamMate-AI
```

### 2. 配置环境变量

创建 `backend/.env` 文件：

```env
# 数据库配置 (SQLite 默认)
DATABASE_URL=sqlite+aiosqlite:///./teammateai.db

# Redis 配置 (可选)
REDIS_URL=redis://localhost:6379/0

# 向量数据库配置 (可选)
QDRANT_HOST=localhost
QDRANT_PORT=6333

# LLM API 密钥 (至少配置一个)
OPENAI_API_KEY=your-openai-api-key
DEEPSEEK_API_KEY=your-deepseek-api-key
ANTHROPIC_API_KEY=your-anthropic-api-key
ZHIPU_API_KEY=your-zhipu-api-key

# 默认模型
DEFAULT_MODEL=deepseek-chat

# JWT 密钥
SECRET_KEY=your-secret-key-change-in-production
```

### 3. 使用 Docker Compose 启动 (推荐)

```bash
cd docker
docker-compose up -d
```

服务地址：
- 前端：http://localhost:3000
- 后端 API：http://localhost:8000
- API 文档：http://localhost:8000/docs

### 4. 本地开发

**后端启动：**

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

**前端启动：**

```bash
cd frontend
npm install
npm run dev
```

访问 http://localhost:3001

## 功能说明

### 1. 项目组聊天

项目组是多 Agent 协作的核心载体。用户可以：

- 创建项目组，添加多个专业 AI Agent
- 在项目组中发送消息，AI 团队自动协作处理
- 使用 @提及 特定 Agent 分配任务
- 查看实时协作状态，了解各 Agent 工作进度

### 2. AI 员工管理

- 创建和配置专业 AI Agent
- 设置 Agent 角色、头像、系统提示词
- 管理 Agent 的 LLM 模型配置
- 查看 Agent 工作状态

### 3. 协作机制

```
用户消息
    │
    ▼
┌─────────────┐
│ Supervisor  │ ← 主 Agent (协调者)
│   (main)    │
└─────────────┘
    │
    ├── @ui-designer ──────────────────┐
    ├── @workflow-architect ───────────┼── Sub Agents (工作者)
    ├── @api-tester ───────────────────┤
    └── @workflow-optimizer ────────────┘
    │
    ▼
┌─────────────┐
│ Blackboard  │ ← 共享黑板 (跨 Agent 上下文)
└─────────────┘
    │
    ▼
 Supervisor 聚合结果 ──→ 最终回复
```

### 4. 上下文隔离

- **SubAgent**：独立工作，不访问全局历史，只接收任务指令
- **MainAgent/Supervisor**：协调者，聚合 SubAgent 的结论，不处理完整文档
- **Blackboard**：共享黑板，SubAgent 完成后写入关键结论，Supervisor 读取聚合

### 5. 记忆系统

- **短期记忆**：基于 LangGraph 的对话历史
- **长期记忆**：向量数据库存储的语义记忆
- **图记忆**：基于图结构的实体关系记忆

## API 文档

启动后端服务后，访问 http://localhost:8000/docs 查看完整的 API 文档。

### 主要 API 端点

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | /api/v1/agents | 获取所有 Agent |
| POST | /api/v1/agents | 创建新 Agent |
| GET | /api/v1/project-groups | 获取所有项目组 |
| POST | /api/v1/project-groups | 创建新项目组 |
| WS | /ws/group/{group_id}/{session_id} | 项目组 WebSocket |

## 开发指南

### 添加新的 Agent 类型

1. 在 `backend/app/agents/agent.py` 中定义 Agent 类
2. 在 `agent_manager` 中注册新 Agent
3. 在前端添加对应的 UI 组件

### 添加新的 API 端点

1. 在 `backend/app/api/` 下创建或修改路由文件
2. 定义 Pydantic schema
3. 注册到 `main.py` 的 app 对象

### 前端组件开发

```tsx
// 示例：创建新组件
import { useAgentStore } from '@/stores/agent'

export const MyComponent = () => {
  const { agents, fetchAgents } = useAgentStore()

  useEffect(() => {
    fetchAgents()
  }, [])

  return (
    <div>
      {agents.map(agent => (
        <AgentCard key={agent.id} agent={agent} />
      ))}
    </div>
  )
}
```

## 配置说明

### LLM 模型配置

TeamMateAI 支持多种 LLM 模型，可以在创建 Agent 时指定：

```python
model_config = {
    "model": "deepseek-chat",  # deepseek, gpt-4, claude-3, glm-4
    "temperature": 0.7,
    "max_tokens": 2000
}
```

### Task Router 配置

任务路由器根据任务复杂度自动选择合适的模型：

- **简单任务**：使用较快的模型 (如 deepseek-chat)
- **复杂任务**：使用更强的模型 (如 GPT-4, Claude-3)

## 部署指南

### Docker 部署

```bash
cd docker
docker-compose up -d
```

### 生产环境注意事项

1. **环境变量**：确保配置正确的 API 密钥
2. **数据库**：生产环境建议使用 PostgreSQL
3. **反向代理**：建议使用 Nginx 配置 SSL
4. **进程管理**：使用 systemd 或 supervisord 管理进程

## 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

## 更新日志

### v1.0.0 (2026-04-23)

- 实现多 Agent 协作群聊
- 添加实时 WebSocket 通讯
- 实现上下文隔离机制
- 添加黑板服务
- 支持多种 LLM 提供商

## 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件

## 联系方式

- 项目主页：https://github.com/johisen/TeamMate-AI
- 问题反馈：https://github.com/johisen/TeamMate-AI/issues

## 致谢

- [LangGraph](https://github.com/langchain-ai/langgraph) - 多智能体工作流框架
- [LangChain](https://github.com/langchain-ai/langchain) - LLM 应用开发框架
- [FastAPI](https://github.com/tiangolo/fastapi) - 现代 Python Web 框架
- [React](https://github.com/facebook/react) - UI 库
- [Tailwind CSS](https://github.com/tailwindlabs/tailwindcss) - 实用优先的 CSS 框架
