import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'

export interface Agent {
  id: string
  name: string
  avatar?: string
  role: string
  departmentId?: string
  jobId?: string
  workspaceId: string
  ownerId: string
  systemPrompt: string
  modelConfig?: Record<string, any>
  tools: string[]
  knowledgeBaseIds: string[]
  memoryNamespace: string
  status: 'idle' | 'thinking' | 'working' | 'error'
  createdAt: Date
  updatedAt: Date
  // OpenClaw 相关字段
  isOpenClawNative?: boolean
  openClawId?: string
  customApiKey?: string
  useCustomApiKey?: boolean
}

interface AgentState {
  agents: Agent[]
  currentAgent: Agent | null
  isLoading: boolean
  error: string | null

  // Actions
  fetchAgents: () => Promise<void>
  createAgent: (data: Partial<Agent>) => Promise<Agent | null>
  updateAgent: (id: string, data: Partial<Agent>) => Promise<void>
  deleteAgent: (id: string) => Promise<void>
  selectAgent: (agent: Agent) => void
  setAgentStatus: (id: string, status: Agent['status']) => void
  bulkAddAgents: (agents: Partial<Agent>[]) => Promise<void>
}

// 从localStorage加载初始化数据
const getInitialAgents = () => {
  try {
    const saved = localStorage.getItem('teamilyAgents')
    if (saved) {
      const agents = JSON.parse(saved)
      return agents.map((agent: any) => ({
        ...agent,
        departmentId: agent.departmentId || '00000000-0000-0000-0000-000000000002',
        createdAt: new Date(agent.createdAt),
        updatedAt: new Date(agent.updatedAt),
      }))
    }
  } catch (e) {
    console.error('Failed to load agents from localStorage:', e)
  }
  return []
}

export const useAgentStore = create<AgentState>((set, get) => ({
  agents: getInitialAgents(),
  currentAgent: null,
  isLoading: false,
  error: null,

  fetchAgents: async () => {
    set({ isLoading: true, error: null })
    try {
      const response = await fetch('/api/v1/agents')
      if (response.ok) {
        const data = await response.json()

        if (!data || data.length === 0) {
          const localAgents = getInitialAgents()
          set({ agents: localAgents, isLoading: false })
          return
        }

        const transformedAgents: Agent[] = data.map((agent: any) => ({
          id: String(agent.id),
          name: agent.name,
          avatar: agent.avatar || '🤖',
          role: agent.role,
          departmentId: agent.department_id ? String(agent.department_id) : '00000000-0000-0000-0000-000000000002',
          jobId: agent.job_id ? String(agent.job_id) : undefined,
          workspaceId: String(agent.workspace_id),
          ownerId: String(agent.owner_id),
          systemPrompt: agent.system_prompt,
          modelConfig: agent.model_config_json,
          tools: agent.tools || [],
          knowledgeBaseIds: agent.knowledge_base_ids || [],
          memoryNamespace: String(agent.memory_namespace),
          status: agent.status || 'idle',
          createdAt: new Date(agent.created_at),
          updatedAt: new Date(agent.updated_at),
        }))

        localStorage.setItem('teamilyAgents', JSON.stringify(transformedAgents))
        set({ agents: transformedAgents, isLoading: false })
      } else {
        throw new Error('Failed to fetch agents')
      }
    } catch (error: any) {
      console.log('Fetch failed, using localStorage:', error)
      const localAgents = getInitialAgents()
      set({ agents: localAgents, isLoading: false })
    }
  },

  createAgent: async (data: Partial<Agent>) => {
    set({ isLoading: true, error: null })
    const newAgentData: Agent = {
      id: uuidv4(),
      name: data.name || '未命名',
      avatar: data.avatar || '🤖',
      role: data.role || 'AI助手',
      departmentId: data.departmentId || '00000000-0000-0000-0000-000000000002',
      jobId: data.jobId,
      systemPrompt: data.systemPrompt || 'You are a helpful AI assistant.',
      workspaceId: data.workspaceId || '00000000-0000-0000-0000-000000000001',
      ownerId: 'user-1',
      tools: data.tools || [],
      knowledgeBaseIds: data.knowledgeBaseIds || [],
      memoryNamespace: `agent-${uuidv4()}`,
      status: 'idle',
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    try {
      const response = await fetch('/api/v1/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          avatar: data.avatar,
          role: data.role,
          department_id: data.departmentId || '00000000-0000-0000-0000-000000000002',
          job_id: data.jobId,
          workspace_id: data.workspaceId || '00000000-0000-0000-0000-000000000001',
          system_prompt: data.systemPrompt || 'You are a helpful AI assistant.',
          model_config_json: data.modelConfig,
          tools: data.tools || [],
          knowledge_base_ids: data.knowledgeBaseIds || [],
        }),
      })

      if (response.ok) {
        const newAgent = await response.json()
        const agent: Agent = {
          id: newAgent.id,
          name: newAgent.name,
          avatar: newAgent.avatar || '🤖',
          role: newAgent.role,
          departmentId: data.departmentId || '00000000-0000-0000-0000-000000000002',
          jobId: data.jobId,
          workspaceId: newAgent.workspace_id,
          ownerId: newAgent.owner_id,
          systemPrompt: newAgent.system_prompt,
          modelConfig: newAgent.model_config_json,
          tools: newAgent.tools || [],
          knowledgeBaseIds: newAgent.knowledge_base_ids || [],
          memoryNamespace: newAgent.memory_namespace,
          status: newAgent.status || 'idle',
          createdAt: new Date(newAgent.created_at),
          updatedAt: new Date(newAgent.updated_at),
        }

        set((state) => {
          const newAgents = [...state.agents, agent]
          localStorage.setItem('teamilyAgents', JSON.stringify(newAgents))
          return { agents: newAgents, isLoading: false }
        })

        return agent
      } else {
        throw new Error('Failed to create agent')
      }
    } catch (error: any) {
      console.log('Create agent API failed, creating locally:', error)

      set((state) => {
        const newAgents = [...state.agents, newAgentData]
        localStorage.setItem('teamilyAgents', JSON.stringify(newAgents))
        return { agents: newAgents, isLoading: false, error: error.message }
      })

      return newAgentData
    }
  },

  updateAgent: async (id: string, data: Partial<Agent>) => {
    set({ isLoading: true, error: null })
    try {
      const response = await fetch(`/api/v1/agents/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          avatar: data.avatar,
          role: data.role,
          department_id: data.departmentId || '00000000-0000-0000-0000-000000000002',
          job_id: data.jobId,
          system_prompt: data.systemPrompt,
          model_config_json: data.modelConfig,
          tools: data.tools,
          status: data.status,
          knowledge_base_ids: data.knowledgeBaseIds,
        }),
      })

      if (response.ok) {
        const updatedAgent = await response.json()
        set((state) => ({
          agents: state.agents.map((agent) =>
            agent.id === id
              ? {
                  ...agent,
                  name: updatedAgent.name,
                  avatar: updatedAgent.avatar,
                  role: updatedAgent.role,
                  departmentId: data.departmentId || agent.departmentId || '00000000-0000-0000-0000-000000000002',
                  jobId: data.jobId || agent.jobId,
                  systemPrompt: updatedAgent.system_prompt,
                  modelConfig: updatedAgent.model_config_json,
                  tools: updatedAgent.tools || [],
                  knowledgeBaseIds: updatedAgent.knowledge_base_ids || [],
                  status: updatedAgent.status,
                }
              : agent
          ),
          currentAgent: state.currentAgent?.id === id
            ? {
                ...state.currentAgent,
                name: updatedAgent.name,
                avatar: updatedAgent.avatar,
                role: updatedAgent.role,
                departmentId: data.departmentId || state.currentAgent.departmentId || '00000000-0000-0000-0000-000000000002',
                jobId: data.jobId || state.currentAgent.jobId,
                systemPrompt: updatedAgent.system_prompt,
                modelConfig: updatedAgent.model_config_json,
                tools: updatedAgent.tools || [],
                knowledgeBaseIds: updatedAgent.knowledge_base_ids || [],
                status: updatedAgent.status,
              }
            : state.currentAgent,
          isLoading: false,
        }))
      } else {
        throw new Error('Failed to update agent')
      }
    } catch (error: any) {
      console.log('Update agent API failed, updating locally:', error)
      // 即使API失败，也在本地更新数据
      set((state) => {
        const updatedAgents = state.agents.map((agent) =>
          agent.id === id
            ? {
                ...agent,
                name: data.name || agent.name,
                avatar: data.avatar || agent.avatar,
                role: data.role || agent.role,
                departmentId: data.departmentId || agent.departmentId || '00000000-0000-0000-0000-000000000002',
                jobId: data.jobId || agent.jobId,
                systemPrompt: data.systemPrompt || agent.systemPrompt,
                modelConfig: data.modelConfig || agent.modelConfig,
                tools: data.tools || agent.tools,
                knowledgeBaseIds: data.knowledgeBaseIds || agent.knowledgeBaseIds,
                status: data.status || agent.status,
              }
            : agent
        )

        localStorage.setItem('teamilyAgents', JSON.stringify(updatedAgents))

        return {
          agents: updatedAgents,
          currentAgent: state.currentAgent?.id === id
            ? {
                ...state.currentAgent,
                name: data.name || state.currentAgent.name,
                avatar: data.avatar || state.currentAgent.avatar,
                role: data.role || state.currentAgent.role,
                departmentId: data.departmentId || state.currentAgent.departmentId || '00000000-0000-0000-0000-000000000002',
                jobId: data.jobId || state.currentAgent.jobId,
                systemPrompt: data.systemPrompt || state.currentAgent.systemPrompt,
                modelConfig: data.modelConfig || state.currentAgent.modelConfig,
                tools: data.tools || state.currentAgent.tools,
                knowledgeBaseIds: data.knowledgeBaseIds || state.currentAgent.knowledgeBaseIds,
                status: data.status || state.currentAgent.status,
              }
            : state.currentAgent,
          isLoading: false,
          error: error.message,
        }
      })
    }
  },

  deleteAgent: async (id: string) => {
    set({ isLoading: true, error: null })
    try {
      const response = await fetch(`/api/v1/agents/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        set((state) => {
          const newAgents = state.agents.filter((agent) => agent.id !== id)
          localStorage.setItem('teamilyAgents', JSON.stringify(newAgents))
          return {
            agents: newAgents,
            currentAgent: state.currentAgent?.id === id ? null : state.currentAgent,
            isLoading: false,
          }
        })
      } else {
        throw new Error('Failed to delete agent')
      }
    } catch (error: any) {
      console.log('Delete agent API failed, deleting locally:', error)
      set((state) => {
        const newAgents = state.agents.filter((agent) => agent.id !== id)
        localStorage.setItem('teamilyAgents', JSON.stringify(newAgents))
        return {
          agents: newAgents,
          currentAgent: state.currentAgent?.id === id ? null : state.currentAgent,
          isLoading: false,
          error: error.message,
        }
      })
    }
  },

  selectAgent: (agent: Agent) => {
    set({ currentAgent: agent })
  },

  setAgentStatus: (id: string, status: Agent['status']) => {
    console.log('[setAgentStatus] Setting status for', id, 'to', status, 'Available agents:', get().agents.map(a => a.id))
    set((state) => ({
      agents: state.agents.map((agent) =>
        agent.id === id ? { ...agent, status } : agent
      ),
    }))
    console.log('[setAgentStatus] Updated agents:', get().agents.filter(a => a.id === id).map(a => ({ id: a.id, name: a.name, status: a.status })))
  },

  // 调试用：直接导入示例agents
  debugImportDemoAgents: () => {
    const demoAgents = [
      { id: 'oc-demo-1', name: '主要助手', avatar: '🤖', role: 'AI助手', isOpenClawNative: true, systemPrompt: '你是一位友好的AI助手，可以回答各种问题。' },
      { id: 'oc-demo-2', name: '代码助手', avatar: '👨‍💻', role: '程序员', isOpenClawNative: true, systemPrompt: '你是一位专业的编程助手，擅长代码开发和技术问题解答。' },
      { id: 'oc-demo-3', name: '设计助手', avatar: '🎨', role: '设计师', isOpenClawNative: true, systemPrompt: '你是一位创意设计助手，擅长UI/UX设计和创意问题。' },
      { id: 'oc-demo-4', name: '写作助手', avatar: '✍️', role: '作家', isOpenClawNative: true, systemPrompt: '你是一位专业写作助手，擅长文案创作和内容优化。' },
      { id: 'oc-demo-5', name: '数据分析', avatar: '📊', role: '数据分析师', isOpenClawNative: true, systemPrompt: '你是一位数据分析助手，擅长数据处理和可视化。' }
    ]

    const existingIds = new Set(get().agents.map(a => a.id))
    const agentsToAdd = demoAgents.filter(a => !existingIds.has(a.id))

    if (agentsToAdd.length === 0) {
      console.log('所有示例agents已存在，无需添加')
      return
    }

    const completeAgents: Agent[] = agentsToAdd.map(agent => ({
      id: agent.id,
      name: agent.name,
      avatar: agent.avatar,
      role: agent.role,
      departmentId: '00000000-0000-0000-0000-000000000002',
      systemPrompt: agent.systemPrompt,
      workspaceId: '00000000-0000-0000-0000-000000000001',
      ownerId: 'user-1',
      tools: agent.tools || [],
      knowledgeBaseIds: agent.knowledgeBaseIds || [],
      memoryNamespace: `agent-${agent.id}`,
      status: 'idle',
      createdAt: new Date(),
      updatedAt: new Date(),
      isOpenClawNative: agent.isOpenClawNative,
      openClawId: agent.id,
      customApiKey: agent.customApiKey,
      useCustomApiKey: agent.useCustomApiKey || false,
    }))

    set((state) => {
      const newAgents = [...state.agents, ...completeAgents]
      localStorage.setItem('teamilyAgents', JSON.stringify(newAgents))
      console.log('成功添加', completeAgents.length, '个示例agents到store和localStorage')
      console.log('当前agents总数:', newAgents.length)
      return {
        agents: newAgents,
        isLoading: false
      }
    })
  },

  bulkAddAgents: async (newAgents: Partial<Agent>[]) => {
    set({ isLoading: true, error: null })

    try {
      const existingOpenClawIds = new Set(get().agents.filter(a => a.openClawId).map(a => a.openClawId))
      const agentsToAdd = newAgents.filter(a => !existingOpenClawIds.has(a.openClawId!))

      if (agentsToAdd.length === 0) {
        set({ isLoading: false })
        return
      }

      console.log(`开始导入 ${agentsToAdd.length} 个 agents...`)

      // 逐个调用后端 API 创建 agents
      const createdAgents: Agent[] = []

      for (const agentData of agentsToAdd) {
        try {
          console.log(`正在创建 agent: ${agentData.name}`)
          
          const newAgentData = {
            name: agentData.name || '未命名',
            avatar: agentData.avatar || '🤖',
            role: agentData.role || 'AI助手',
            department_id: agentData.departmentId || '00000000-0000-0000-0000-000000000002',
            system_prompt: agentData.systemPrompt || 'You are a helpful AI assistant.',
            workspace_id: '00000000-0000-0000-0000-000000000001',
          }

          const response = await fetch('/api/v1/agents', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newAgentData),
          })

          if (response.ok) {
            const newAgentFromApi = await response.json()
            const agent: Agent = {
              id: newAgentFromApi.id,
              name: newAgentFromApi.name,
              avatar: newAgentFromApi.avatar || '🤖',
              role: newAgentFromApi.role,
              departmentId: newAgentFromApi.department_id || '00000000-0000-0000-0000-000000000002',
              jobId: newAgentFromApi.job_id,
              systemPrompt: newAgentFromApi.system_prompt,
              modelConfig: newAgentFromApi.model_config_json,
              tools: newAgentFromApi.tools || [],
              knowledgeBaseIds: newAgentFromApi.knowledge_base_ids || [],
              memoryNamespace: newAgentFromApi.memory_namespace,
              status: newAgentFromApi.status || 'idle',
              createdAt: new Date(newAgentFromApi.created_at),
              updatedAt: new Date(newAgentFromApi.updated_at),
              workspaceId: newAgentFromApi.workspace_id,
              ownerId: newAgentFromApi.owner_id,
              isOpenClawNative: true,
              openClawId: agentData.openClawId,
              customApiKey: agentData.customApiKey,
              useCustomApiKey: agentData.useCustomApiKey || false,
            }
            createdAgents.push(agent)
            console.log(`成功创建 agent: ${agent.name} (${agent.id})`)
          } else {
            console.error(`创建 agent 失败: ${agentData.name}`, await response.text())
          }
        } catch (err) {
          console.error(`创建 agent 出错: ${agentData.name}`, err)
        }
      }

      if (createdAgents.length > 0) {
        set((state) => {
          const newAgents = [...state.agents, ...createdAgents]
          localStorage.setItem('teamilyAgents', JSON.stringify(newAgents))
          return {
            agents: newAgents,
            isLoading: false
          }
        })
        console.log(`成功导入 ${createdAgents.length} 个 agents！`)
      } else {
        set({ isLoading: false })
      }
    } catch (error: any) {
      console.error('Failed to bulk add agents:', error)
      set({ error: error.message, isLoading: false })
    }
  },
}))