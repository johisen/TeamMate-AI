import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'

export interface Message {
  id: string
  content: string
  type: 'user' | 'agent' | 'system' | 'supervisor'
  agentId?: string
  agentName?: string
  timestamp: Date
  tokenCount?: number
  taskStatus?: string
}

export interface ChatSession {
  id: string
  agentId: string
  title: string
  messages: Message[]
  createdAt: Date
  updatedAt: Date
  isArchived: boolean
}

interface ChatState {
  sessions: Map<string, ChatSession>
  currentSessionId: string | null
  currentAgentId: string | null
  isTyping: boolean
  websocket: WebSocket | null
  isCollaborationMode: boolean
  collaborationStatus: 'idle' | 'in_progress' | 'completed' | 'needs_intervention'
  collaborationRound: number
  maxCollaborationRounds: number

  // Actions
  createSession: (agentId: string) => string
  selectSession: (sessionId: string) => Promise<void>
  sendMessage: (content: string) => Promise<void>
  sendCollaborationMessage: (content: string) => Promise<void>
  continueCollaboration: (message: string) => Promise<void>
  stopCollaboration: () => Promise<void>
  resetContext: () => Promise<void>
  connectWebSocket: (agentId: string, sessionId: string) => void
  disconnectWebSocket: () => void
  addMessage: (message: Message) => void
  setTyping: (isTyping: boolean) => void
  fetchMessages: (sessionId: string) => Promise<void>
  setCollaborationMode: (mode: boolean) => void
  setCollaborationStatus: (status: 'idle' | 'in_progress' | 'completed' | 'needs_intervention') => void
  loadSessions: (agentId: string) => Promise<void>
}

export const useChatStore = create<ChatState>((set, get) => ({
  sessions: new Map(),
  currentSessionId: null,
  currentAgentId: null,
  isTyping: false,
  websocket: null,
  isCollaborationMode: false,
  collaborationStatus: 'idle',
  collaborationRound: 0,
  maxCollaborationRounds: 7,

  // Load sessions from backend
  loadSessions: async (agentId: string) => {
    try {
      const response = await fetch(`/api/v1/sessions?agent_id=${agentId}`)
      if (response.ok) {
        const sessions = await response.json()
        set((state) => {
          const newSessions = new Map(state.sessions)
          sessions.forEach((session: any) => {
            newSessions.set(session.id, {
              id: session.id,
              agentId: session.agent_id,
              title: session.title || '新对话',
              messages: [],
              createdAt: new Date(session.created_at),
              updatedAt: new Date(session.updated_at),
              isArchived: session.is_archived || false
            })
          })
          return { sessions: newSessions }
        })
      }
    } catch (error) {
      console.error('Error loading sessions:', error)
    }
  },

  createSession: async (agentId: string) => {
    const sessionId = uuidv4()
    const newSession: ChatSession = {
      id: sessionId,
      agentId,
      title: '新对话',
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      isArchived: false,
    }

    set((state) => {
      const newSessions = new Map(state.sessions)
      newSessions.set(sessionId, newSession)
      return {
        sessions: newSessions,
        currentSessionId: sessionId,
        currentAgentId: agentId,
      }
    })

    // Create session in backend
    try {
      await fetch('/api/v1/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: sessionId,
          agent_id: agentId,
          title: '新对话',
        }),
      })
    } catch (error) {
      console.error('Error creating session in backend:', error)
    }

    return sessionId
  },

  selectSession: async (sessionId: string) => {
    const session = get().sessions.get(sessionId)
    if (session) {
      set({
        currentSessionId: sessionId,
        currentAgentId: session.agentId,
      })
      // Fetch messages from backend
      await get().fetchMessages(sessionId)
    }
  },

  sendMessage: async (content: string, agentId?: string, attachments?: { name: string; type: string; data?: string }[]) => {
    const { currentSessionId, currentAgentId, sessions, websocket } = get()
    const targetAgentId = agentId || currentAgentId

    console.log('=== sendMessage called ===')
    console.log('content:', content.substring(0, 50))
    console.log('agentId (param):', agentId)
    console.log('currentAgentId (from store):', currentAgentId)
    console.log('targetAgentId (final):', targetAgentId)
    console.log('currentSessionId:', currentSessionId)
    console.log('websocket:', websocket ? 'exists' : 'null')
    console.log('========================')

    if (!currentSessionId || !targetAgentId) {
      console.error('No current session or agent:', { currentSessionId, targetAgentId })
      alert('请先选择一个AI员工进行聊天')
      setIsTyping(false)
      return
    }

    // Check if it's a command
    if (content.startsWith('/reset')) {
      await get().resetContext()
      return
    }

    // Add user message
    const userMessage: Message = {
      id: uuidv4(),
      content,
      type: 'user',
      agentId: targetAgentId,
      timestamp: new Date(),
    }

    get().addMessage(userMessage)

    // Send via WebSocket if connected
    if (websocket && websocket.readyState === WebSocket.OPEN) {
      websocket.send(JSON.stringify({
        type: 'chat',
        content,
        attachments: attachments || [],
      }))
    } else {
      // Fallback to HTTP
      try {
        get().setTyping(true)
        console.log('Sending HTTP request to /api/v1/chat with:', {
          message: content,
          agent_id: targetAgentId,
          session_id: currentSessionId
        })
        const response = await fetch('/api/v1/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: content,
            agent_id: targetAgentId,
            session_id: currentSessionId,
            attachments: attachments || [],
          }),
        })

        console.log('HTTP response status:', response.status)

        if (response.ok) {
          const data = await response.json()
          console.log('HTTP response data:', data)
          const agentMessage: Message = {
            id: uuidv4(),
            content: data.content,
            type: 'agent',
            agentId: targetAgentId,
            timestamp: new Date(),
            tokenCount: data.token_count,
          }
          get().addMessage(agentMessage)
        } else {
          const errorText = await response.text()
          console.error('HTTP error:', response.status, errorText)
          alert('发送消息失败 (错误 ' + response.status + '): ' + errorText)
        }
      } catch (error) {
        console.error('Error sending message:', error)
        alert('发送消息失败: ' + (error as Error).message)
        const errorMessage: Message = {
          id: uuidv4(),
          content: '抱歉，发送消息时出现错误。',
          type: 'system',
          timestamp: new Date(),
        }
        get().addMessage(errorMessage)
        get().setTyping(false)
      } finally {
        get().setTyping(false)
      }
    }
  },

  resetContext: async () => {
    const { currentSessionId } = get()

    if (!currentSessionId) return

    try {
      await fetch('/api/v1/reset-context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: currentSessionId }),
      })

      // Clear messages in current session
      set((state) => {
        const newSessions = new Map(state.sessions)
        const session = newSessions.get(currentSessionId)
        if (session) {
          session.messages = []
          session.updatedAt = new Date()
        }
        return { sessions: newSessions }
      })

      const systemMessage: Message = {
        id: uuidv4(),
        content: '对话上下文已重置，开始新的对话吧！',
        type: 'system',
        timestamp: new Date(),
      }
      get().addMessage(systemMessage)
    } catch (error) {
      console.error('Error resetting context:', error)
    }
  },

  connectWebSocket: (agentId: string, sessionId: string) => {
    const ws = new WebSocket(`/ws/chat/${agentId}/${sessionId}`)

    ws.onopen = () => {
      console.log('WebSocket connected')
    }

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)

      if (data.type === 'message') {
        const agentMessage: Message = {
          id: uuidv4(),
          content: data.content,
          type: 'agent',
          agentId: data.agent_id,
          timestamp: new Date(),
        }
        get().addMessage(agentMessage)
        get().setTyping(false)
      } else if (data.type === 'typing') {
        get().setTyping(data.is_typing)
      } else if (data.type === 'error') {
        console.error('WebSocket error:', data.content)
        get().setTyping(false)
      }
    }

    ws.onclose = () => {
      console.log('WebSocket disconnected')
      set({ websocket: null })
    }

    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
      set({ websocket: null })
    }

    set({ websocket: ws })
  },

  disconnectWebSocket: () => {
    const { websocket } = get()
    if (websocket) {
      websocket.close()
      set({ websocket: null })
    }
  },

  addMessage: (message: Message) => {
    set((state) => {
      const newSessions = new Map(state.sessions)
      const session = newSessions.get(state.currentSessionId!)
      if (session) {
        session.messages.push(message)
        session.updatedAt = new Date()
      }
      return { sessions: newSessions }
    })
  },

  setTyping: (isTyping: boolean) => {
    set({ isTyping })
  },

  fetchMessages: async (sessionId: string) => {
    try {
      console.log('Fetching messages for session:', sessionId)
      const response = await fetch(`/api/v1/messages/${sessionId}`)
      
      if (response.ok) {
        const messages = await response.json()
        console.log('Fetched messages:', messages.length)
        
        // Update session with messages from backend
        set((state) => {
          const newSessions = new Map(state.sessions)
          const session = newSessions.get(sessionId)
          if (session) {
            // Convert backend messages to frontend format
            const frontendMessages = messages.map((msg: any) => ({
              id: msg.id,
              content: msg.content,
              type: msg.message_type === 'user' ? 'user' : msg.message_type === 'agent' ? 'agent' : 'system',
              agentId: msg.agent_id,
              timestamp: new Date(msg.created_at),
              tokenCount: msg.token_count,
            }))
            session.messages = frontendMessages
          }
          return { sessions: newSessions }
        })
      } else {
        console.error('Failed to fetch messages:', response.status)
      }
    } catch (error) {
      console.error('Error fetching messages:', error)
    }
  },

  // Multi-agent collaboration methods
  sendCollaborationMessage: async (content: string) => {
    const { currentSessionId, currentAgentId } = get()
    
    if (!currentSessionId || !currentAgentId) {
      console.error('No current session or agent')
      alert('请先选择一个AI员工进行聊天')
      return
    }

    // Add user message
    const userMessage: Message = {
      id: uuidv4(),
      content,
      type: 'user',
      agentId: currentAgentId,
      timestamp: new Date(),
    }

    get().addMessage(userMessage)
    get().setTyping(true)
    get().setCollaborationStatus('in_progress')

    try {
      console.log('Sending collaboration message:', content)
      const response = await fetch('/api/v1/collaborate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          agent_id: currentAgentId,
          session_id: currentSessionId,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        console.log('Collaboration response:', data)

        // Add all agent messages
        if (data.messages) {
          data.messages.forEach((msgData: any) => {
            const agentMessage: Message = {
              id: uuidv4(),
              content: msgData.content,
              type: msgData.type === 'supervisor' ? 'supervisor' : 'agent',
              agentId: msgData.agent_id,
              agentName: msgData.agent_name,
              timestamp: new Date(),
              taskStatus: msgData.task_status,
            }
            get().addMessage(agentMessage)
          })
        }

        // Update collaboration status
        get().setCollaborationStatus(data.status === 'completed' ? 'completed' : data.needs_human_intervention ? 'needs_intervention' : 'in_progress')
        
        if (data.round) {
          set({ collaborationRound: data.round })
        }
        if (data.max_rounds) {
          set({ maxCollaborationRounds: data.max_rounds })
        }

      } else {
        const errorText = await response.text()
        console.error('Collaboration error:', response.status, errorText)
        alert('协作请求失败 (错误 ' + response.status + '): ' + errorText)
        get().setCollaborationStatus('idle')
      }
    } catch (error) {
      console.error('Error sending collaboration message:', error)
      alert('发送协作消息失败: ' + (error as Error).message)
      get().setCollaborationStatus('idle')
    } finally {
      get().setTyping(false)
    }
  },

  continueCollaboration: async (message: string) => {
    const { currentSessionId } = get()
    
    if (!currentSessionId) {
      console.error('No current session')
      return
    }

    get().setTyping(true)

    try {
      const response = await fetch(`/api/v1/collaborate/${currentSessionId}/continue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'intervention',
          content: message,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        
        // Add messages
        if (data.messages) {
          data.messages.forEach((msgData: any) => {
            const agentMessage: Message = {
              id: uuidv4(),
              content: msgData.content,
              type: msgData.type === 'supervisor' ? 'supervisor' : 'agent',
              agentId: msgData.agent_id,
              agentName: msgData.agent_name,
              timestamp: new Date(),
              taskStatus: msgData.task_status,
            }
            get().addMessage(agentMessage)
          })
        }

        get().setCollaborationStatus(data.status === 'completed' ? 'completed' : data.needs_human_intervention ? 'needs_intervention' : 'in_progress')
        
      } else {
        const errorText = await response.text()
        console.error('Continue collaboration error:', response.status, errorText)
        alert('继续协作失败: ' + errorText)
      }
    } catch (error) {
      console.error('Error continuing collaboration:', error)
      alert('继续协作失败: ' + (error as Error).message)
    } finally {
      get().setTyping(false)
    }
  },

  stopCollaboration: async () => {
    const { currentSessionId } = get()
    
    if (!currentSessionId) {
      console.error('No current session')
      return
    }

    try {
      const response = await fetch(`/api/v1/collaborate/${currentSessionId}/stop`, {
        method: 'POST',
      })

      if (response.ok) {
        get().setCollaborationStatus('idle')
        set({ collaborationRound: 0 })
      } else {
        console.error('Stop collaboration error:', response.status)
      }
    } catch (error) {
      console.error('Error stopping collaboration:', error)
    }
  },

  setCollaborationMode: (mode: boolean) => {
    set({ isCollaborationMode: mode })
  },

  setCollaborationStatus: (status: 'idle' | 'in_progress' | 'completed' | 'needs_intervention') => {
    set({ collaborationStatus: status })
  },
}))
