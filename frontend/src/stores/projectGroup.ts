import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'

export interface ProjectGroupMember {
  id: string
  agentId: string
  joinedAt: Date
  roleInGroup?: string
}

export interface ProjectGroup {
  id: string
  name: string
  description?: string
  workspaceId: string
  supervisorId: string
  isActive: boolean
  config?: Record<string, any>
  createdAt: Date
  updatedAt: Date
  members: ProjectGroupMember[]
}

export interface GroupMessage {
  id: string
  projectGroupId: string
  content: string
  messageType: string
  senderAgentId?: string
  userId?: string
  tokenCount: number
  metadata?: Record<string, any>
  createdAt: Date
}

interface ProjectGroupState {
  groups: ProjectGroup[]
  currentGroup: ProjectGroup | null
  groupMessages: Map<string, GroupMessage[]>
  isLoading: boolean
  error: string | null

  // Actions
  fetchGroups: (workspaceId?: string) => Promise<void>
  fetchGroup: (groupId: string) => Promise<void>
  createGroup: (data: Partial<ProjectGroup> & { supervisorId: string; memberAgentIds: string[] }) => Promise<ProjectGroup | null>
  updateGroup: (groupId: string, data: Partial<ProjectGroup>) => Promise<void>
  deleteGroup: (groupId: string) => Promise<void>
  selectGroup: (group: ProjectGroup) => void
  addMember: (groupId: string, agentId: string, roleInGroup?: string) => Promise<void>
  removeMember: (groupId: string, agentId: string) => Promise<void>
  fetchGroupMessages: (groupId: string) => Promise<void>
  sendGroupMessage: (groupId: string, message: string, mentionAgentIds?: string[]) => Promise<GroupMessage | null>
}

export const useProjectGroupStore = create<ProjectGroupState>((set, get) => ({
  groups: [],
  currentGroup: null,
  groupMessages: new Map(),
  isLoading: false,
  error: null,

  fetchGroups: async (workspaceId?: string) => {
    set({ isLoading: true, error: null })
    try {
      const url = workspaceId
        ? `/api/v1/project-groups?workspace_id=${workspaceId}`
        : '/api/v1/project-groups'

      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        const transformedGroups: ProjectGroup[] = data.map((group: any) => ({
          id: String(group.id),
          name: group.name,
          description: group.description,
          workspaceId: String(group.workspace_id),
          supervisorId: String(group.supervisor_id),
          isActive: group.is_active,
          config: group.config,
          createdAt: new Date(group.created_at),
          updatedAt: new Date(group.updated_at),
          members: (group.members || []).map((member: any) => ({
            id: String(member.id),
            agentId: String(member.agent_id),
            joinedAt: new Date(member.joined_at),
            roleInGroup: member.role_in_group,
          })),
        }))
        set({ groups: transformedGroups, isLoading: false })
      } else {
        throw new Error('Failed to fetch groups')
      }
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
    }
  },

  fetchGroup: async (groupId: string) => {
    set({ isLoading: true, error: null })
    try {
      const response = await fetch(`/api/v1/project-groups/${groupId}`)
      if (response.ok) {
        const data = await response.json()
        const transformedGroup: ProjectGroup = {
          id: String(data.id),
          name: data.name,
          description: data.description,
          workspaceId: String(data.workspace_id),
          supervisorId: String(data.supervisor_id),
          isActive: data.is_active,
          config: data.config,
          createdAt: new Date(data.created_at),
          updatedAt: new Date(data.updated_at),
          members: (data.members || []).map((member: any) => ({
            id: String(member.id),
            agentId: String(member.agent_id),
            joinedAt: new Date(member.joined_at),
            roleInGroup: member.role_in_group,
          })),
        }
        set((state) => ({
          groups: state.groups.map((g) => (g.id === groupId ? transformedGroup : g)),
          currentGroup: transformedGroup,
          isLoading: false,
        }))
      } else {
        throw new Error('Failed to fetch group')
      }
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
    }
  },

  createGroup: async (data) => {
    set({ isLoading: true, error: null })
    try {
      const response = await fetch('/api/v1/project-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          description: data.description,
          workspace_id: data.workspaceId,
          supervisor_id: data.supervisorId,
          member_agent_ids: data.memberAgentIds,
          is_active: true,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        const newGroup: ProjectGroup = {
          id: String(data.id),
          name: data.name,
          description: data.description,
          workspaceId: String(data.workspace_id),
          supervisorId: String(data.supervisor_id),
          isActive: data.is_active,
          config: data.config,
          createdAt: new Date(data.created_at),
          updatedAt: new Date(data.updated_at),
          members: (data.members || []).map((member: any) => ({
            id: String(member.id),
            agentId: String(member.agent_id),
            joinedAt: new Date(member.joined_at),
            roleInGroup: member.role_in_group,
          })),
        }
        set((state) => ({
          groups: [...state.groups, newGroup],
          isLoading: false,
        }))
        return newGroup
      } else {
        throw new Error('Failed to create group')
      }
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
      return null
    }
  },

  updateGroup: async (groupId: string, data: Partial<ProjectGroup>) => {
    set({ isLoading: true, error: null })
    try {
      const response = await fetch(`/api/v1/project-groups/${groupId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (response.ok) {
        const updatedGroup = await response.json()
        const transformedUpdatedGroup: ProjectGroup = {
          id: String(updatedGroup.id),
          name: updatedGroup.name,
          description: updatedGroup.description,
          workspaceId: String(updatedGroup.workspace_id),
          supervisorId: String(updatedGroup.supervisor_id),
          isActive: updatedGroup.is_active,
          config: updatedGroup.config,
          createdAt: new Date(updatedGroup.created_at),
          updatedAt: new Date(updatedGroup.updated_at),
          members: (updatedGroup.members || []).map((member: any) => ({
            id: String(member.id),
            agentId: String(member.agent_id),
            joinedAt: new Date(member.joined_at),
            roleInGroup: member.role_in_group,
          })),
        }
        set((state) => ({
          groups: state.groups.map((g) => (g.id === groupId ? transformedUpdatedGroup : g)),
          currentGroup: state.currentGroup?.id === groupId ? transformedUpdatedGroup : state.currentGroup,
          isLoading: false,
        }))
      } else {
        throw new Error('Failed to update group')
      }
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
    }
  },

  deleteGroup: async (groupId: string) => {
    set({ isLoading: true, error: null })
    try {
      const response = await fetch(`/api/v1/project-groups/${groupId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        set((state) => ({
          groups: state.groups.filter((g) => g.id !== groupId),
          currentGroup: state.currentGroup?.id === groupId ? null : state.currentGroup,
          isLoading: false,
        }))
      } else {
        throw new Error('Failed to delete group')
      }
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
    }
  },

  selectGroup: (group: ProjectGroup) => {
    set({ currentGroup: group })
  },

  addMember: async (groupId: string, agentId: string, roleInGroup?: string) => {
    set({ isLoading: true, error: null })
    try {
      const response = await fetch(`/api/v1/project-groups/${groupId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_id: agentId,
          role_in_group: roleInGroup,
        }),
      })

      if (response.ok) {
        const updatedGroup = await response.json()
        set((state) => ({
          groups: state.groups.map((g) => (g.id === groupId ? updatedGroup : g)),
          currentGroup: state.currentGroup?.id === groupId ? updatedGroup : state.currentGroup,
          isLoading: false,
        }))
      } else {
        throw new Error('Failed to add member')
      }
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
    }
  },

  removeMember: async (groupId: string, agentId: string) => {
    set({ isLoading: true, error: null })
    try {
      const response = await fetch(`/api/v1/project-groups/${groupId}/members`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_id: agentId,
        }),
      })

      if (response.ok) {
        await get().fetchGroup(groupId)
      } else {
        throw new Error('Failed to remove member')
      }
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
    }
  },

  fetchGroupMessages: async (groupId: string) => {
    set({ isLoading: true, error: null })
    try {
      console.log('[fetchGroupMessages] Fetching messages for group:', groupId)
      const response = await fetch(`/api/v1/project-groups/${groupId}/messages`)
      if (response.ok) {
        const data = await response.json()
        console.log('[fetchGroupMessages] Received', data.length, 'messages')
        // 转换字段名从下划线命名法到驼峰命名法，并反转顺序（后端返回的是倒序）
        const transformedMessages = data.map((msg: any) => ({
          id: String(msg.id),
          projectGroupId: String(msg.project_group_id),
          content: msg.content,
          messageType: msg.message_type,
          senderAgentId: msg.sender_agent_id ? String(msg.sender_agent_id) : undefined,
          userId: msg.user_id ? String(msg.user_id) : undefined,
          tokenCount: msg.token_count,
          metadata: msg.metadata,
          createdAt: new Date(msg.created_at)
        })).reverse()
        console.log('[fetchGroupMessages] Transformed', transformedMessages.length, 'messages after reverse')
        set((state) => {
          const newGroupMessages = new Map(state.groupMessages)
          newGroupMessages.set(groupId, transformedMessages)
          console.log('[fetchGroupMessages] Updated state with', transformedMessages.length, 'messages for group:', groupId)
          return { groupMessages: newGroupMessages, isLoading: false }
        })
      } else {
        throw new Error('Failed to fetch group messages')
      }
    } catch (error: any) {
      console.error('[fetchGroupMessages] Error:', error)
      set({ error: error.message, isLoading: false })
    }
  },

  sendGroupMessage: async (groupId: string, message: string, mentionAgentIds?: string[]) => {
    set({ isLoading: true, error: null })
    
    // 添加超时机制
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 120000) // 120秒超时，匹配后端60秒模型超时
    
    try {
      const response = await fetch(`/api/v1/project-groups/${groupId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          mention_agent_ids: mentionAgentIds || [],
        }),
        signal: controller.signal,
      })
      
      clearTimeout(timeoutId)

      if (response.ok) {
        // 发送成功后，强制刷新消息列表
        await get().fetchGroupMessages(groupId)
        // 等待状态更新完成
        await new Promise(resolve => setTimeout(resolve, 100))
        const messages = get().groupMessages.get(groupId) || []
        set({ isLoading: false })
        return messages[messages.length - 1] || null
      } else {
        // 尝试从响应中提取错误详情
        let errorMessage = '发送消息失败'
        try {
          const errorData = await response.json()
          if (errorData.detail) {
            errorMessage = errorData.detail
          }
        } catch (e) {
          // 如果无法解析错误详情，使用默认错误信息
          errorMessage = `HTTP错误 ${response.status}: ${response.statusText}`
        }
        throw new Error(errorMessage)
      }
    } catch (error: any) {
      clearTimeout(timeoutId)
      
      let errorMessage = '发送消息失败'
      if (error.name === 'AbortError') {
        errorMessage = '请求超时（120秒），大模型服务响应时间过长，请稍后再试'
      } else if (error.message) {
        errorMessage = error.message
      } else if (error.code === 'ECONNREFUSED') {
        errorMessage = '无法连接到服务器，请检查网络'
      } else if (error.code === 'ERR_NETWORK') {
        errorMessage = '网络连接错误，请检查网络设置'
      }
      
      set({ error: errorMessage, isLoading: false })
      return null
    }
  },
}))
