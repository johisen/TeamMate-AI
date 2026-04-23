import React, { useState, useEffect, useRef } from 'react'
import { Bot, Send, Users, ArrowRight, MessageSquare, Clock, Smile, Hash, AtSign, Archive, Paperclip, Search, X, MoreVertical, Trash2, Edit, UserPlus } from 'lucide-react'
import { useProjectGroupStore, ProjectGroup, GroupMessage } from '@/stores/projectGroup'
import { useAgentStore } from '@/stores/agent'
import { useAuthStore } from '@/stores/auth'

interface CollaborationEvent {
  id: string
  type: 'mention' | 'thinking' | 'response' | 'timeout'
  fromAgent: string
  toAgent?: string
  content?: string
  timestamp: Date
}

interface MentionItem {
  id: string
  name: string
  type: 'agent' | 'user'
}

interface QuoteItem {
  id: string
  content: string
  sender: string
  timestamp: Date
}

// 84个表情，分12行，每行7个
const EMOJIS = [
  '😀', '😃', '😄', '😁', '😅', '😂', '🤣',
  '😊', '😇', '🙂', '😉', '😌', '😍', '🥰',
  '😘', '😋', '😛', '😜', '🤪', '🤩', '🤔',
  '🤭', '🤫', '🤗', '🤐', '🤨', '😐', '😑',
  '😶', '😏', '😒', '🙄', '😬', '🤥', '😔',
  '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢',
  '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯',
  '🤠', '🥳', '😎', '🤓', '🧐', '😕', '😟',
  '🙁', '😮', '😯', '😲', '😳', '🥺', '😦',
  '😧', '😨', '😰', '😥', '😢', '😭', '😱',
  '😖', '😣', '😞', '😓', '😩', '😫', '🥱',
  '😤', '😡', '😠', '🤬', '😈', '👿', '💀'
]

export const ProjectGroupChat: React.FC = () => {
  const { currentGroup, groupMessages, fetchGroupMessages, sendGroupMessage, groups } = useProjectGroupStore()
  const { agents } = useAgentStore()
  const { user } = useAuthStore()
  const [message, setMessage] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [onlineCount, setOnlineCount] = useState(0)
  const [ws, setWs] = useState<WebSocket | null>(null)
  const [typingUsers, setTypingUsers] = useState<string[]>([])
  const [collaborationEvents, setCollaborationEvents] = useState<CollaborationEvent[]>([])
  const [showCollaborationView, setShowCollaborationView] = useState(false)
  const [showCollaborationDetail, setShowCollaborationDetail] = useState(false)
  const [showEmojis, setShowEmojis] = useState(false)
  const [attachments, setAttachments] = useState<File[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [showMentionList, setShowMentionList] = useState(false)
  const [mentionListType, setMentionListType] = useState<'agents' | 'all' | 'groups'>('groups')
  const [mentionSearch, setMentionSearch] = useState('')
  const [showQuoteList, setShowQuoteList] = useState(false)
  const [quoteSearch, setQuoteSearch] = useState('')
  const [showCommandSuggestions, setShowCommandSuggestions] = useState(false)
  const [commandSuggestions, setCommandSuggestions] = useState<string[]>([])
  const [emojiUsage, setEmojiUsage] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem('emojiUsage')
    return saved ? JSON.parse(saved) : {}
  })
  const [showGroupDetail, setShowGroupDetail] = useState(false)
  const [messageVersion, setMessageVersion] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const mentionRef = useRef<HTMLDivElement>(null)
  const quoteRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const formatTimestamp = (date: Date | string) => {
    // 将输入转换为Date对象
    let d: Date;
    if (typeof date === 'string') {
      // 如果是字符串，确保作为UTC解析
      if (!date.endsWith('Z') && !date.includes('+')) {
        d = new Date(date + 'Z'); // 强制作为UTC时间处理
      } else {
        d = new Date(date);
      }
    } else {
      d = date;
    }
    
    // 使用Intl.DateTimeFormat确保正确的时区转换
    const formatter = new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    
    return formatter.format(d);
  }

  const getFrequentlyUsedEmojis = () => {
    return Object.entries(emojiUsage)
      .filter(([_, count]) => count > 3)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 21)
      .map(([emoji]) => emoji)
  }

  const handleAddEmoji = (emoji: string) => {
    const newUsage = {
      ...emojiUsage,
      [emoji]: (emojiUsage[emoji] || 0) + 1
    }
    setEmojiUsage(newUsage)
    localStorage.setItem('emojiUsage', JSON.stringify(newUsage))
    setMessage(prev => prev + emoji)
    setShowEmojis(false)
  }

  // 使用useMemo来监听groupMessages的变化，确保messages和filteredMessages能够正确更新
  const messages = React.useMemo(() => {
    const msgs = currentGroup ? (groupMessages.get(currentGroup.id) || []) : []
    console.log('[useMemo] messages updated:', msgs.length, 'messages for group:', currentGroup?.id)
    return msgs
  }, [currentGroup, groupMessages, messageVersion])
  
  const filteredMessages = React.useMemo(() => {
    return searchQuery
      ? messages.filter(msg => msg.content.toLowerCase().includes(searchQuery.toLowerCase()))
      : messages
  }, [messages, searchQuery])

  const filteredAgents: MentionItem[] = agents
    .filter(agent => agent.name.toLowerCase().includes(mentionSearch.toLowerCase()))
    .map(agent => ({
      id: agent.id,
      name: agent.name,
      type: 'agent' as const
    }))

  const filteredUsers: MentionItem[] = [
    { id: 'all', name: '所有人', type: 'user' }
  ].filter(user => user.name.toLowerCase().includes(mentionSearch.toLowerCase()))

  const filteredGroups = groups
    .filter(group => {
      if (!mentionSearch) {
        return true
      }
      const searchLower = mentionSearch.toLowerCase()
      if (group.name.toLowerCase().includes(searchLower)) {
        return true
      }
      if (group.members && group.members.some(member => {
        const agent = agents.find(a => a.id === member.agentId)
        return agent && agent.name.toLowerCase().includes(searchLower)
      })) {
        return true
      }
      return false
    })
    .map(group => ({
      id: group.id,
      name: group.name,
      members: group.members || [],
      type: 'group' as const,
      matchedMembers: mentionSearch
        ? group.members
            ?.filter(member => {
              const agent = agents.find(a => a.id === member.agentId)
              return agent && agent.name.toLowerCase().includes(mentionSearch.toLowerCase())
            })
            .map(member => {
              const agent = agents.find(a => a.id === member.agentId)
              return agent ? { id: agent.id, name: agent.name } : null
            })
            .filter(Boolean) || []
        : group.members
            ?.map(member => {
              const agent = agents.find(a => a.id === member.agentId)
              return agent ? { id: agent.id, name: agent.name } : null
            })
            .filter(Boolean) || []
    }))

  const filteredQuotes: QuoteItem[] = messages
    .filter(msg => msg.content.toLowerCase().includes(quoteSearch.toLowerCase()))
    .slice(-10)
    .reverse()
    .map(msg => ({
      id: msg.id,
      content: msg.content.length > 100 ? msg.content.substring(0, 100) + '...' : msg.content,
      sender: msg.messageType === 'user' ? (user?.username || '用户') : (agents.find(a => a.id === msg.senderAgentId)?.name || 'AI'),
      timestamp: new Date(msg.createdAt || Date.now())
    }))

  const wsRef = useRef<WebSocket | null>(null)
  const connectedGroupIdRef = useRef<string | null>(null)
  const isConnectingRef = useRef<boolean>(false)

  useEffect(() => {
    if (!currentGroup) return

    const currentGroupId = currentGroup.id

    // 如果已经在连接中或已连接，且groupId相同，则不重复连接
    if (
      connectedGroupIdRef.current === currentGroupId &&
      wsRef.current &&
      (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)
    ) {
      return
    }

    // 如果正在连接中，等待连接完成
    if (isConnectingRef.current) {
      return
    }

    // 关闭现有连接
    if (wsRef.current) {
      try {
        wsRef.current.close()
      } catch (e) {
        // 忽略关闭错误
      }
      wsRef.current = null
    }

    connectedGroupIdRef.current = currentGroupId
    isConnectingRef.current = true

    fetchGroupMessages(currentGroupId).then(() => {
      setMessageVersion(v => v + 1)
    })

    const sessionId = `group_${currentGroupId}_${Date.now()}`
    const wsUrl = `ws://localhost:8000/ws/group/${currentGroup.id}/${sessionId}`
    const webSocket = new WebSocket(wsUrl)

    wsRef.current = webSocket
    setWs(webSocket)

    webSocket.onopen = () => {
      console.log('WebSocket connected for group chat')
      isConnectingRef.current = false
    }

    webSocket.onmessage = (event) => {
      const data = JSON.parse(event.data)
      console.log('[WebSocket] Received message:', data.type, data)

      switch (data.type) {
        case 'connected':
          setOnlineCount(data.online_count || 0)
          break
        case 'message':
          console.log('[WebSocket] Received message event, incrementing messageVersion')
          // 当收到最终消息时，重新获取消息列表，确保数据一致
          if (currentGroup) {
            fetchGroupMessages(currentGroup.id).then(() => {
              setMessageVersion(v => v + 1)
            })
          } else {
            setMessageVersion(v => v + 1)
          }
          break
        case 'agent_thinking':
          addCollaborationEvent({
            id: `evt-${Date.now()}`,
            type: 'thinking',
            fromAgent: data.agent_name,
            content: data.content,
            timestamp: new Date(),
          })
          // 更新AI状态为思考中
          if (data.agent_id) {
            console.log('[WebSocket] agent_thinking: setting status for', data.agent_id, 'to thinking')
            useAgentStore.getState().setAgentStatus(data.agent_id, 'thinking')
          }
          break
        case 'agent_response':
          addCollaborationEvent({
            id: `evt-${Date.now()}`,
            type: 'response',
            fromAgent: data.agent_name,
            content: data.content,
            timestamp: new Date(),
          })
          // 立即更新消息版本，触发消息列表更新
          console.log('[WebSocket] agent_response: received response from', data.agent_name)
          
          // 更新AI状态为空闲
          if (data.agent_id) {
            console.log('[WebSocket] agent_response: setting status for', data.agent_id, 'to idle')
            useAgentStore.getState().setAgentStatus(data.agent_id, 'idle')
          }
          break
        case 'agent_responding':
          addCollaborationEvent({
            id: `evt-${Date.now()}`,
            type: 'response',
            fromAgent: data.agent_name,
            toAgent: data.to_agent,
            content: data.content,
            timestamp: new Date(),
          })
          // 更新AI状态为工作中
          if (data.agent_id) {
            console.log('[WebSocket] agent_responding: setting status for', data.agent_id, 'to working')
            useAgentStore.getState().setAgentStatus(data.agent_id, 'working')
          }
          break
        case 'agent_mention':
          addCollaborationEvent({
            id: `evt-${Date.now()}`,
            type: 'mention',
            fromAgent: data.from_agent,
            toAgent: data.to_agent,
            content: `@${data.to_agent}: ${data.content}`,
            timestamp: new Date(),
          })
          break
        case 'agent_tool_call':
          addCollaborationEvent({
            id: `evt-${Date.now()}`,
            type: 'tool',
            fromAgent: data.agent_name,
            content: data.content,
            timestamp: new Date(),
          })
          // 更新AI状态为工作中
          if (data.agent_id) {
            useAgentStore.getState().setAgentStatus(data.agent_id, 'working')
          }
          break
        case 'agent_result':
          addCollaborationEvent({
            id: `evt-${Date.now()}`,
            type: 'result',
            fromAgent: data.agent_name,
            content: data.content,
            timestamp: new Date(),
          })
          // 更新AI状态为空闲
          if (data.agent_id) {
            useAgentStore.getState().setAgentStatus(data.agent_id, 'idle')
          }
          break
        case 'agent_status':
          // 处理AI状态更新
          if (data.agent_id && data.status) {
            useAgentStore.getState().setAgentStatus(data.agent_id, data.status)
          }
          break
        case 'typing':
          if (data.is_typing) {
            const displayName = data.agent_name || (data.user_id && !data.user_id.includes('group_') ? data.user_id : 'AI助手')
            setTypingUsers(prev => [...new Set([...prev, displayName])])
          } else {
            const displayName = data.agent_name || (data.user_id && !data.user_id.includes('group_') ? data.user_id : 'AI助手')
            setTypingUsers(prev => prev.filter(id => id !== displayName))
          }
          break
        case 'user_joined':
          setOnlineCount(data.online_count || 0)
          break
        case 'user_left':
          setOnlineCount(data.online_count || 0)
          break
      }
    }

    webSocket.onerror = (error) => {
      console.error('WebSocket error:', error)
      isConnectingRef.current = false
    }

    webSocket.onclose = () => {
      console.log('WebSocket disconnected')
      if (wsRef.current === webSocket) {
        wsRef.current = null
        connectedGroupIdRef.current = null
      }
      isConnectingRef.current = false
    }
  }, [currentGroup?.id || ''])

  useEffect(() => {
    const { fetchAgents } = useAgentStore.getState()
    fetchAgents()
  }, [])

  // 监听新消息到达，添加AI响应的协作事件
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1]
      if (lastMessage.messageType === 'agent' && lastMessage.senderAgentId) {
        const agentName = getAgentName(lastMessage.senderAgentId)
        // 检查是否已经添加过这个事件（避免重复）
        const recentEvents = collaborationEvents.slice(-5)
        const alreadyAdded = recentEvents.some(
          event => event.content === lastMessage.content && event.fromAgent === agentName
        )
        if (!alreadyAdded && lastMessage.content) {
          addCollaborationEvent({
            id: `evt-${Date.now()}-response`,
            type: 'response',
            fromAgent: agentName,
            content: lastMessage.content,
            timestamp: new Date(),
          })
        }
      }
    }
  }, [messages.length, messageVersion])

  // 当currentGroup变化时，获取项目组成员的详细信息
  useEffect(() => {
    if (currentGroup) {
      const { fetchAgents } = useAgentStore.getState()
      fetchAgents()
    }
  }, [currentGroup])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (mentionRef.current && !mentionRef.current.contains(e.target as Node)) {
        setShowMentionList(false)
      }
      if (quoteRef.current && !quoteRef.current.contains(e.target as Node)) {
        setShowQuoteList(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [currentGroup, groupMessages, collaborationEvents])

  const addCollaborationEvent = (event: CollaborationEvent) => {
    setCollaborationEvents(prev => {
      // 检查是否已存在相同类型、相同来源和相同内容的事件
      const isDuplicate = prev.some(existingEvent => 
        existingEvent.type === event.type &&
        existingEvent.fromAgent === event.fromAgent &&
        existingEvent.content === event.content &&
        Math.abs(new Date(existingEvent.timestamp).getTime() - new Date(event.timestamp).getTime()) < 1000
      )
      
      if (isDuplicate) {
        return prev
      }
      
      return [...prev.slice(-20), event]
    })
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim() || !currentGroup) return
    
    const messageText = message.trim()
    
    // 检查消息内容是否为空或只包含特殊字符
    if (!messageText.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '').length) {
      alert('消息内容不能为空或只包含特殊字符')
      return
    }
    
    // 添加用户消息的协作事件
    addCollaborationEvent({
      id: `evt-${Date.now()}`,
      type: 'mention',
      fromAgent: user?.username || '用户',
      content: messageText,
      timestamp: new Date(),
    })
    
    // 检查是否是命令
    if (messageText.startsWith('/')) {
      if (handleCommand(messageText)) {
        setMessage('')
        setIsTyping(false)
        
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current)
        }
        
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'typing',
            is_typing: false
          }))
        }
        
        return
      }
    }

    setMessage('')
    setIsTyping(false)

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'typing',
        is_typing: false
      }))
    }

    const mentionAgentIds: string[] = []
    // 只检查当前项目组的成员
    const projectMembers = currentGroup?.members || []
    projectMembers.forEach((member) => {
      // 通过 agentId 查找对应的 agent 名称
      const agent = agents.find(a => a.id === member.agentId)
      if (!agent) return
      
      // Check for @agent with various punctuation and spacing
      const mentionPatterns = [
        `@${agent.name}`,
        `@${agent.name} `,
        `@${agent.name},`,
        `@${agent.name}.`,
        `@${agent.name}!`,
        `@${agent.name}?`,
        `@${agent.name}:`,
        `@${agent.name};`
      ]
      
      const isMentioned = mentionPatterns.some(pattern => messageText.includes(pattern))
      
      if (isMentioned) {
        mentionAgentIds.push(member.agentId)
        addCollaborationEvent({
          id: `evt-${Date.now()}-${member.agentId}`,
          type: 'mention',
          fromAgent: user?.username || '用户',
          toAgent: agent.name,
          content: messageText,
          timestamp: new Date(),
        })
      }
    })

    // 立即创建本地消息对象并添加到消息列表
    const tempMessageId = `temp-${Date.now()}`
    const tempMessage = {
      id: tempMessageId,
      projectGroupId: currentGroup.id,
      content: messageText,
      messageType: 'user',
      userId: user?.id,
      tokenCount: 0,
      createdAt: new Date()
    }

    // 添加到本地消息列表
    const projectGroupStore = useProjectGroupStore.getState()
    const currentMessages = projectGroupStore.groupMessages.get(currentGroup.id) || []
    const updatedMessages = [...currentMessages, tempMessage]
    projectGroupStore.groupMessages.set(currentGroup.id, updatedMessages)
    setMessageVersion(v => v + 1)

    // 通过WebSocket发送消息（实现实时进度更新）
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      // 设置等待标志
      let messageReceived = false
      
      // 创建一次性的消息处理器来接收最终响应
      const originalOnMessage = wsRef.current.onmessage
      wsRef.current.onmessage = (event) => {
        const data = JSON.parse(event.data)
        
        // 调用原始处理器
        if (originalOnMessage) {
          originalOnMessage.call(wsRef.current, event)
        }
        
        // 检查是否是最终消息
        if (data.type === 'message' && !messageReceived) {
          messageReceived = true
          setMessageVersion(v => v + 1)
        }
      }
      
      // 通过WebSocket发送消息
      wsRef.current.send(JSON.stringify({
        type: 'chat',
        content: messageText,
        mention_agent_ids: mentionAgentIds || [],
      }))
      
      // 设置超时
      setTimeout(() => {
        if (!messageReceived) {
          wsRef.current.onmessage = originalOnMessage
          alert('发送消息超时，请稍后再试')
          // 移除临时消息
          const updatedMessagesAfterError = projectGroupStore.groupMessages.get(currentGroup.id)?.filter(msg => msg.id !== tempMessageId) || []
          projectGroupStore.groupMessages.set(currentGroup.id, updatedMessagesAfterError)
          setMessageVersion(v => v + 1)
        }
      }, 120000) // 120秒超时
    } else {
      // 如果WebSocket未连接，使用REST API（备用方案）
      const result = await sendGroupMessage(currentGroup.id, messageText, mentionAgentIds)
      if (result) {
        setMessageVersion(v => v + 1)
      } else {
        const error = useProjectGroupStore.getState().error
        if (error) {
          alert(`发送消息失败: ${error}`)
        }
        const updatedMessagesAfterError = projectGroupStore.groupMessages.get(currentGroup.id)?.filter(msg => msg.id !== tempMessageId) || []
        projectGroupStore.groupMessages.set(currentGroup.id, updatedMessagesAfterError)
        setMessageVersion(v => v + 1)
      }
    }
  }

  const handleTyping = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value)

    if (!isTyping) {
      setIsTyping(true)
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'typing',
          is_typing: true
        }))
      }
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false)
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'typing',
          is_typing: false
        }))
      }
    }, 1000)
  }

  const handleMention = (type: 'agents' | 'all' | 'groups' = 'groups') => {
    setMentionListType(type)
    setMentionSearch('')
    setShowMentionList(true)
    setShowQuoteList(false)
  }

  const handleSelectMention = (item: MentionItem) => {
    // 移除末尾的@符号，避免重复
    let newMessage = message
    if (newMessage.endsWith('@')) {
      newMessage = newMessage.slice(0, -1)
    }
    setMessage(newMessage + `@${item.name} `)
    setShowMentionList(false)
    setMentionSearch('')
  }

// #标签
  const handleHashTag = () => {
    setQuoteSearch('')
    setShowQuoteList(true)
    setShowMentionList(false)
  }

  const handleSelectQuote = (item: QuoteItem) => {
    const quoteText = `\n> ${item.content}\n`
    setMessage(prev => prev + quoteText)
    setShowQuoteList(false)
    setQuoteSearch('')
  }

  const handleArchive = () => {
    if (confirm('确定要归档当前对话吗？')) {
      // 实现归档功能
      if (currentGroup) {
        // 这里可以添加归档逻辑，比如更新会话状态
        console.log('归档对话:', currentGroup.id)
        alert('对话已归档')
      }
    }
  }

  const handleCompress = () => {
    if (confirm('确定要压缩对话上下文吗？')) {
      // 实现压缩功能
      if (currentGroup) {
        // 这里可以添加压缩逻辑，比如合并历史消息
        console.log('压缩对话:', currentGroup.id)
        alert('对话上下文已压缩')
      }
    }
  }

  const handleReset = () => {
    if (confirm('确定要重置对话上下文吗？')) {
      // 实现重置功能
      if (currentGroup) {
        // 清空当前会话的消息
        const projectGroupStore = useProjectGroupStore.getState()
        projectGroupStore.fetchGroupMessages(currentGroup.id).then(() => {
          // 重新获取消息（空消息）
          console.log('重置对话:', currentGroup.id)
          alert('对话已重置')
        })
      }
    }
  }

  // 处理命令行输入
  const handleCommand = (cmd: string) => {
    const command = cmd.trim();
    
    if (command === '/archive') {
      handleArchive();
      return true;
    } else if (command === '/compress') {
      handleCompress();
      return true;
    } else if (command === '/reset') {
      handleReset();
      return true;
    }
    
    return false;
  };

  // 处理输入变化，检测反斜杠、@和#输入
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setMessage(value);
    
    // 检测是否输入了反斜杠
    if (value.endsWith('/')) {
      // 显示命令建议
      setCommandSuggestions(['/archive', '/compress', '/reset']);
      setShowCommandSuggestions(true);
      setShowMentionList(false);
      setShowQuoteList(false);
    } else if (value.includes('/')) {
      // 过滤命令建议
      const lastSlashIndex = value.lastIndexOf('/');
      const commandPrefix = value.substring(lastSlashIndex);
      const filtered = ['/archive', '/compress', '/reset'].filter(cmd => cmd.startsWith(commandPrefix));
      setCommandSuggestions(filtered);
      setShowCommandSuggestions(filtered.length > 0);
      setShowMentionList(false);
      setShowQuoteList(false);
    } else if (value.endsWith('@')) {
      // 显示@提及列表
      setMentionListType('groups');
      setMentionSearch('');
      setShowMentionList(true);
      setShowQuoteList(false);
      setShowCommandSuggestions(false);
    } else if (value.endsWith('#')) {
      // 显示#引用列表
      setQuoteSearch('');
      setShowQuoteList(true);
      setShowMentionList(false);
      setShowCommandSuggestions(false);
    } else {
      setShowCommandSuggestions(false);
    }
    
    // 原有的typing逻辑
    if (!isTyping) {
      setIsTyping(true);
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'typing',
          is_typing: true
        }));
      }
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'typing',
          is_typing: false
        }));
      }
    }, 1000);
  };

  const handleSelectCommand = (command: string) => {
    setMessage(prev => {
      const lastSlashIndex = prev.lastIndexOf('/');
      if (lastSlashIndex >= 0) {
        return prev.substring(0, lastSlashIndex) + command;
      }
      return command;
    });
    setShowCommandSuggestions(false);
  };

  const handleAttachClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      setAttachments(prev => [...prev, ...Array.from(files)])
    }
  }

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index))
  }

  const getAgentName = (agentId?: any) => {
    if (!agentId) return 'AI助手'
    const agentIdStr = String(agentId)
    const agent = agents.find((a) => String(a.id) === agentIdStr)
    const name = agent?.name || 'AI助手'
    return name
  }

  const getAgentAvatar = (agentId?: any) => {
    if (!agentId) return null
    const agentIdStr = String(agentId)
    const agent = agents.find((a) => String(a.id) === agentIdStr)
    return agent?.avatar && agent.avatar !== '🤖' ? agent.avatar : null
  }

  const getCollaborationIcon = (type: string) => {
    switch (type) {
      case 'thinking':
        return <Clock size={14} className="text-yellow-400 animate-pulse" />
      case 'response':
        return <ArrowRight size={14} className="text-blue-400" />
      case 'mention':
        return <Bot size={14} className="text-primary-400" />
      case 'tool':
        return <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-400"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="m22 2-7 20-4-9-9-4 20-7"/></svg>
      case 'result':
        return <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-400"><polyline points="20 6 9 17 4 12"/></svg>
      case 'timeout':
        return <Clock size={14} className="text-red-400" />
      default:
        return <MessageSquare size={14} className="text-gray-400" />
    }
  }

  if (!currentGroup) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
        <div className="w-24 h-24 bg-gradient-to-br from-primary-500/20 to-secondary-500/20 rounded-full flex items-center justify-center mb-6">
          <Bot size={48} className="text-primary-400" />
        </div>
        <h2 className="text-2xl font-semibold text-white mb-2">
          选择一个项目组开始协作
        </h2>
        <p className="text-gray-400">
          左侧列表选择或创建新的项目组
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-full min-w-0">
      <div className="flex-1 flex flex-col min-w-0">
      {/* Header */}
      <div className="px-6 py-4 border-b border-dark-100 bg-dark-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-secondary-600 rounded-lg flex items-center justify-center">
              <Bot size={20} className="text-white" />
            </div>
            <div>
              <h2 className="font-semibold text-white">{currentGroup.name}</h2>
              <p className="text-xs text-gray-400">
                {currentGroup.description || '多 AI 智能体协作项目组'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSearch(!showSearch)}
              className="p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-dark-100"
              title={showSearch ? "关闭搜索" : "搜索聊天"}
            >
              <Search size={20} />
            </button>
            <button
              onClick={() => {
                setShowCollaborationView(!showCollaborationView)
                if (!showCollaborationView) {
                  setShowCollaborationDetail(true)
                } else {
                  setShowCollaborationDetail(false)
                }
              }}
              className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 transition-colors ${
                showCollaborationView
                  ? 'bg-primary-600 text-white'
                  : 'bg-dark-200 text-gray-400 hover:text-white'
              }`}
            >
              <MessageSquare size={14} />
              协作视图
            </button>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-sm text-gray-400">
                <Users size={14} />
                <span title={`项目组共 ${currentGroup.members?.length || 0} 名成员`}>
                  {onlineCount} 在线
                </span>
              </div>
              {/* 显示项目组成员头像 */}
              {currentGroup.members && currentGroup.members.length > 0 && (
                <div className="flex -space-x-2">
                  {currentGroup.members.slice(0, 4).map((member) => {
                    const agent = agents.find(a => String(a.id) === String(member.agentId))
                    if (!agent) return null
                    return (
                      <div
                        key={member.agentId}
                        className="w-6 h-6 rounded-full bg-secondary-600 border border-dark-300 flex items-center justify-center text-xs text-white"
                        title={agent.name || 'AI 员工'}
                      >
                        {agent.name?.charAt(0) || '?'}
                      </div>
                    )
                  }).filter(Boolean)}
                  {currentGroup.members.length > 4 && (
                    <div className="w-6 h-6 rounded-full bg-dark-200 border border-dark-300 flex items-center justify-center text-xs text-gray-400">
                      +{currentGroup.members.length - 4}
                    </div>
                  )}
                </div>
              )}
            </div>
            <button
              onClick={() => setShowGroupDetail(!showGroupDetail)}
              className="p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-dark-100"
              title="项目组详情"
            >
              <MoreVertical size={20} />
            </button>
          </div>
        </div>

        {/* Search bar */}
        {showSearch && (
          <div className="mt-4 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索聊天内容..."
              className="w-full pl-10 pr-4 py-2 bg-dark-200 border border-dark-100 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
              autoFocus
            />
          </div>
        )}
      </div>

      {/* Collaboration Events Bar */}
      {showCollaborationView && (
        <div className="px-4 py-2 bg-dark-200 border-b border-dark-100 w-full min-w-0 overflow-hidden">
          {collaborationEvents.length > 0 ? (
            <div className="flex gap-2 overflow-x-auto whitespace-nowrap w-full min-w-0">
              {collaborationEvents.slice(-10).map((event) => (
                <div
                  key={event.id}
                  className="flex items-center gap-1.5 px-2 py-1 bg-dark-300 rounded-lg shrink-0 max-w-[200px] overflow-hidden text-ellipsis"
                >
                  {getCollaborationIcon(event.type)}
                  <span className="text-xs text-gray-300 truncate">
                    {event.fromAgent === 'user' ? (user?.username || '用户') : event.fromAgent}
                  </span>
                  {event.toAgent && (
                    <>
                      <ArrowRight size={12} className="text-gray-500 flex-shrink-0" />
                      <span className="text-xs text-primary-400 truncate">{event.toAgent}</span>
                    </>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-gray-500">
              开始对话或使用 @ 提及 AI 员工来查看协作过程
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        {filteredMessages.length === 0 ? (
          messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <Bot size={48} className="mb-4 opacity-50" />
              <p>开始和项目组中的 AI 员工协作吧！</p>
              <p className="text-sm mt-2">使用 @[AI员工名] 来提及特定的 AI</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <Search size={48} className="mb-3 opacity-50" />
              <p>没有找到匹配的内容</p>
              <p className="text-sm mt-1">尝试其他关键词</p>
            </div>
          )
        ) : (
          <>
            {/* Collaboration View - Show AI interactions (only when detail sidebar is hidden) */}
            {showCollaborationView && !searchQuery && !showCollaborationDetail && (
              <div className="mb-4 space-y-4 max-w-full">
                {/* AI Employees Status Cards */}
                <div className="p-3 bg-gradient-to-r from-secondary-900/20 to-primary-900/20 rounded-xl border border-secondary-500/30 max-w-full">
                  <div className="flex items-center gap-2 mb-3">
                    <Users size={16} className="text-secondary-400" />
                    <span className="text-sm font-medium text-secondary-400">AI 员工状态</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-w-full">
                    {currentGroup.members && currentGroup.members.map((member) => {
                      const agent = agents.find(a => String(a.id) === String(member.agentId))
                      if (!agent) return null
                      
                      // 确定状态样式和文本
                      let statusColor = 'bg-gray-500'
                      let statusText = '空闲'
                      let statusIcon = <Users size={12} />
                      
                      switch (agent.status) {
                        case 'thinking':
                          statusColor = 'bg-yellow-500'
                          statusText = '思考中'
                          statusIcon = <Clock size={12} className="animate-pulse" />
                          break
                        case 'working':
                          statusColor = 'bg-blue-500'
                          statusText = '工作中'
                          statusIcon = <ArrowRight size={12} />
                          break
                        case 'error':
                          statusColor = 'bg-red-500'
                          statusText = '错误'
                          statusIcon = <Trash2 size={12} />
                          break
                        default:
                          statusColor = 'bg-green-500'
                          statusText = '空闲'
                          statusIcon = <Users size={12} />
                      }
                      
                      return (
                        <div key={member.agentId} className="bg-dark-300 rounded-lg p-3 border border-dark-100">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-secondary-600 flex items-center justify-center">
                                {agent.avatar ? (
                                  agent.avatar.startsWith('http') ? (
                                    <img src={agent.avatar} alt={agent.name} className="w-full h-full rounded-full" />
                                  ) : (
                                    <span className="text-lg">{agent.avatar}</span>
                                  )
                                ) : (
                                  <Bot size={16} className="text-white" />
                                )}
                              </div>
                              <div>
                                <div className="font-medium text-white text-sm">{agent.name}</div>
                                <div className="text-xs text-gray-400">{agent.role}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 text-xs">
                              <div className={`w-2 h-2 rounded-full ${statusColor}`}>
                                {statusIcon}
                              </div>
                              <span className="text-gray-300">{statusText}</span>
                            </div>
                          </div>
                          {/* 最近活动 */}
                          <div className="text-xs text-gray-500">
                            {agent.status === 'thinking' && (
                              <div className="flex items-center gap-1">
                                <Clock size={10} className="text-yellow-400" />
                                <span>正在分析问题...</span>
                              </div>
                            )}
                            {agent.status === 'working' && (
                              <div className="flex items-center gap-1">
                                <ArrowRight size={10} className="text-blue-400" />
                                <span>正在处理任务...</span>
                              </div>
                            )}
                            {agent.status === 'idle' && (
                              <div className="flex items-center gap-1">
                                <Users size={10} className="text-green-400" />
                                <span>等待任务分配</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    }).filter(Boolean)}
                  </div>
                </div>
                
                {/* Collaboration Process */}
                <div className="p-3 bg-gradient-to-r from-primary-900/20 to-secondary-900/20 rounded-xl border border-primary-500/30 max-w-full overflow-hidden">
                  <div className="flex items-center gap-2 mb-2">
                    <MessageSquare size={16} className="text-primary-400" />
                    <span className="text-sm font-medium text-primary-400">协作过程</span>
                  </div>
                  {collaborationEvents.length > 0 ? (
                    <div className="space-y-2 max-w-full overflow-y-auto max-h-60">
                      {collaborationEvents.slice(-8).map((event, index) => (
                        <div key={event.id} className="flex items-start gap-2 text-sm max-w-full">
                          <div className="flex items-center gap-1 mt-0.5">
                            {getCollaborationIcon(event.type)}
                          </div>
                          <div className="flex-1 max-w-full min-w-0">
                            <div className="flex flex-wrap items-center gap-1 max-w-full">
                              <span className="font-medium text-white truncate">
                                {event.fromAgent === 'user' ? (user?.username || '用户') : event.fromAgent}
                              </span>
                              {event.toAgent && (
                                <>
                                  <span className="text-gray-400 mx-1">→</span>
                                  <span className="text-primary-400 truncate">{event.toAgent}</span>
                                </>
                              )}
                              {event.type === 'thinking' && (
                                <span className="text-yellow-400 ml-1">思考中...</span>
                              )}
                              {event.type === 'tool' && (
                                <span className="text-purple-400 ml-1">工具调用</span>
                              )}
                              {event.type === 'result' && (
                                <span className="text-green-400 ml-1">成果产出</span>
                              )}
                            </div>
                            {event.content && (
                              <p className="text-gray-400 text-xs mt-1 line-clamp-2 max-w-full overflow-hidden">
                                {event.content}
                              </p>
                            )}
                          </div>
                          <span className="text-xs text-gray-500 whitespace-nowrap">
                            {formatTimestamp(event.timestamp)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500">
                      <p className="mb-2">协作视图可以显示：</p>
                      <ul className="list-disc list-inside space-y-1 text-xs">
                        <li>AI 员工的思考过程</li>
                        <li>多个 AI 之间的响应交互</li>
                        <li>用户 @ 提及 AI 员工的事件</li>
                        <li>AI 工具调用和成果产出</li>
                      </ul>
                      <p className="mt-3 text-xs">开始对话或使用 @ 来激活协作视图！</p>
                    </div>
                  )}
                </div>
                
                {/* Tools and Results */}
                <div className="p-3 bg-gradient-to-r from-tertiary-900/20 to-secondary-900/20 rounded-xl border border-tertiary-500/30">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-4 h-4 flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-tertiary-400"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>
                    </div>
                    <span className="text-sm font-medium text-white">工具调用与成果</span>
                  </div>
                  <div className="space-y-3">
                    {/* 工具调用示例 */}
                    {collaborationEvents.filter(e => e.type === 'tool').length > 0 ? (
                      collaborationEvents.filter(e => e.type === 'tool').slice(-3).map((event) => (
                        <div key={event.id} className="bg-dark-300 rounded-lg p-3 border border-dark-100">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-6 h-6 rounded-full bg-purple-600/30 flex items-center justify-center">
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-400"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="m22 2-7 20-4-9-9-4 20-7"/></svg>
                            </div>
                            <div className="flex-1">
                              <div className="text-sm font-medium text-white">{event.fromAgent}</div>
                              <div className="text-xs text-purple-400">工具调用</div>
                            </div>
                            <span className="text-xs text-gray-500">{formatTimestamp(event.timestamp)}</span>
                          </div>
                          {event.content && (
                            <div className="text-xs text-gray-300 bg-dark-200 p-2 rounded">
                              {event.content}
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-gray-500">
                        暂无工具调用记录
                      </div>
                    )}
                    
                    {/* 成果产出示例 */}
                    {collaborationEvents.filter(e => e.type === 'result').length > 0 ? (
                      collaborationEvents.filter(e => e.type === 'result').slice(-3).map((event) => (
                        <div key={event.id} className="bg-dark-300 rounded-lg p-3 border border-dark-100">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-6 h-6 rounded-full bg-green-600/30 flex items-center justify-center">
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-400"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            </div>
                            <div className="flex-1">
                              <div className="text-sm font-medium text-white">{event.fromAgent}</div>
                              <div className="text-xs text-green-400">成果产出</div>
                            </div>
                            <span className="text-xs text-gray-500">{formatTimestamp(event.timestamp)}</span>
                          </div>
                          {event.content && (
                            <div className="text-xs text-gray-300 bg-dark-200 p-2 rounded">
                              {event.content}
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-gray-500 mt-3">
                        暂无成果产出记录
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Message bubbles */}
            {filteredMessages.map((msg, index) => {
              const prevMsg = filteredMessages[index - 1]
              const showBubble = true // 调试：始终显示名称
              const msgKey = `${msg.id}-${msg.senderAgentId || 'user'}-${index}`

              return (
                <div
                  key={msgKey}
                  className={`flex gap-3 mb-4 ${msg.messageType === 'user' ? 'flex-row-reverse' : ''}`}
                >
                  <div
                    className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                      msg.messageType === 'user'
                        ? 'bg-primary-600'
                        : msg.senderAgentId ? 'bg-secondary-600' : 'bg-dark-200'
                    }`}
                  >
                    {msg.messageType === 'user' ? (
                      // 显示用户头像
                      <div className="w-full h-full flex items-center justify-center text-lg">
                        {user?.avatar ? (
                          <img
                            src={user.avatar}
                            alt={user.username}
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                          user?.username?.charAt(0) || 'U'
                        )}
                      </div>
                    ) : (
                      msg.senderAgentId ? (
                        getAgentAvatar(msg.senderAgentId) ? (
                          <img
                            src={getAgentAvatar(msg.senderAgentId)}
                            alt=""
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-lg">
                            {(() => {
                              const agentIdStr = String(msg.senderAgentId)
                              const agent = agents.find((a) => String(a.id) === agentIdStr)
                              return agent?.avatar || <Bot size={16} className="text-white" />
                            })()}
                          </div>
                        )
                      ) : (
                        <Bot size={16} className="text-white" />
                      )
                    )}
                  </div>

                  <div
                    className={`flex flex-col ${msg.messageType === 'user' ? 'items-end' : 'items-start'} max-w-[70%]`}
                  >
                    {showBubble && (
                      <div className="text-xs text-gray-400 mb-1 px-1">
                        {msg.messageType === 'user'
                          ? user?.username || '用户' // 显示用户名称
                          : getAgentName(msg.senderAgentId)}
                      </div>
                    )}
                    <div
                      className={`px-4 py-2 rounded-2xl ${
                        msg.messageType === 'user'
                          ? 'bg-primary-600 text-white rounded-tr-md'
                          : 'bg-dark-100 text-white rounded-tl-md'
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                    </div>
                    {msg.createdAt && (
                      <div className="text-xs text-gray-500 mt-1 px-1">
                        {formatTimestamp(msg.createdAt)}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </>
        )}

        {/* Typing indicators */}
        {typingUsers.length > 0 && !searchQuery && (
          <div className="flex gap-3 mb-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-secondary-600 flex items-center justify-center">
              <Bot size={16} className="text-white animate-pulse" />
            </div>
            <div className="flex items-center">
              <div className="bg-dark-100 px-4 py-2 rounded-2xl rounded-tl-md">
                <p className="text-xs text-gray-400">
                  {typingUsers.join(', ')} 正在输入...
                </p>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-dark-100 bg-dark-400">
        <form onSubmit={handleSendMessage} className="flex flex-col gap-2 p-4">
        {/* Context actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleArchive}
            className="px-3 py-1.5 text-xs bg-dark-200 hover:bg-dark-100 text-gray-300 rounded-lg transition-colors flex items-center gap-1"
          >
            <Archive size={14} />
            归档
          </button>
          <button
            type="button"
            onClick={handleCompress}
            className="px-3 py-1.5 text-xs bg-dark-200 hover:bg-dark-100 text-gray-300 rounded-lg transition-colors flex items-center gap-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-compress"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
            压缩
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="px-3 py-1.5 text-xs bg-dark-200 hover:bg-dark-100 text-gray-300 rounded-lg transition-colors flex items-center gap-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-rotate-ccw"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
            重置
          </button>
        </div>

        {/* Input area */}
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            {/* Attachments */}
            {attachments.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {attachments.map((file, index) => (
                  <div key={index} className="flex items-center gap-1 px-2 py-1 bg-dark-100 rounded-lg text-sm">
                    <span className="text-gray-400 truncate max-w-[200px]">{file.name}</span>

                    <button
                      onClick={() => removeAttachment(index)}
                      className="text-gray-500 hover:text-red-400"
                    >
                      ×
                    </button>
                  </div>
                ))}
                </div>
              )}

            <div className="relative">
              {/* Command suggestions - above the input */}
              {showCommandSuggestions && commandSuggestions.length > 0 && (
                <div className="absolute bottom-full left-0 mb-2 w-48 bg-dark-200 border border-dark-100 rounded-lg shadow-lg z-20 overflow-hidden">
                  {commandSuggestions.map((command, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => handleSelectCommand(command)}
                      className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-dark-100 flex items-center gap-2"
                    >
                      <span className="text-primary-400">{command}</span>
                    </button>
                  ))}
                </div>
              )}

              <textarea
                value={message}
                onChange={handleInputChange}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSendMessage(e)
                  }
                }}
                placeholder="输入消息，使用 @[AI员工名] 提及特定 AI..."
                rows={1}
                className="w-full px-4 py-3 pr-32 bg-dark-200 border border-dark-100 rounded-xl text-white placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
              />

              {/* Quick actions inside input */}
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleMention()}
                  className="p-1.5 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-dark-100"
                  title="@提及"
                >
                  <AtSign size={16} />
                </button>
                <button
                  type="button"
                  onClick={handleHashTag}
                  className="p-1.5 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-dark-100"
                  title="#引用上下文"
                >
                  <Hash size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setShowEmojis(!showEmojis)}
                  className="p-1.5 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-dark-100"
                  title="表情"
                >
                  <Smile size={16} />
                </button>
                <button
                  type="button"
                  onClick={handleAttachClick}
                  className="p-1.5 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-dark-100"
                  title="附件"
                >
                  <Paperclip size={16} />
                </button>
              </div>

              {/* Emoji picker */}
              {showEmojis && (
                <div ref={mentionRef} className="absolute bottom-full right-0 mb-2 w-96 bg-dark-200 border border-dark-100 rounded-lg shadow-lg z-20">
                  {/* 常用表情分组 */}
                  {getFrequentlyUsedEmojis().length > 0 && (
                    <div className="p-2 border-b border-dark-100">
                      <div className="text-xs text-gray-500 mb-2">常用表情</div>
                      <div className="grid grid-cols-7 gap-2">
                        {getFrequentlyUsedEmojis().map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => handleAddEmoji(emoji)}
                            className="w-12 h-12 flex items-center justify-center rounded hover:bg-dark-100 transition-colors text-2xl relative"
                            title={`使用 ${emojiUsage[emoji]} 次`}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* 完整表情列表 */}
                  <div className="p-2 max-h-64 overflow-y-auto">
                    <div className="text-xs text-gray-500 mb-2">全部表情</div>
                    <div className="grid grid-cols-7 gap-2">
                      {EMOJIS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => handleAddEmoji(emoji)}
                          className="w-12 h-12 flex items-center justify-center rounded hover:bg-dark-100 transition-colors text-2xl"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Mention list */}
              {showMentionList && (
                <div ref={mentionRef} className="absolute bottom-full left-0 mb-2 w-72 bg-dark-200 border border-dark-100 rounded-lg shadow-lg z-20 overflow-hidden">
                  <div className="p-2 border-b border-dark-100 flex gap-2">
                    <button
                      onClick={() => setMentionListType('groups')}
                      className={`flex-1 px-3 py-1.5 text-xs rounded-lg transition-colors ${
                        mentionListType === 'groups'
                          ? 'bg-primary-600 text-white'
                          : 'bg-dark-100 text-gray-400 hover:text-white'
                      }`}
                    >
                      项目组
                    </button>
                    <button
                      onClick={() => setMentionListType('agents')}
                      className={`flex-1 px-3 py-1.5 text-xs rounded-lg transition-colors ${
                        mentionListType === 'agents'
                          ? 'bg-primary-600 text-white'
                          : 'bg-dark-100 text-gray-400 hover:text-white'
                      }`}
                    >
                      AI员工
                    </button>
                    <button
                      onClick={() => setMentionListType('all')}
                      className={`flex-1 px-3 py-1.5 text-xs rounded-lg transition-colors ${
                        mentionListType === 'all'
                          ? 'bg-primary-600 text-white'
                          : 'bg-dark-100 text-gray-400 hover:text-white'
                      }`}
                    >
                      所有人
                    </button>
                  </div>
                  <div className="p-2 border-b border-dark-100">
                    <input
                      type="text"
                      value={mentionSearch}
                      onChange={(e) => setMentionSearch(e.target.value)}
                      placeholder="搜索..."
                      className="w-full px-3 py-1.5 bg-dark-100 border border-dark-100 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                      autoFocus
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {mentionListType === 'groups' ? (
                      filteredGroups.length > 0 ? (
                        filteredGroups.map((group) => (
                          <div key={group.id} className="border-b border-dark-100 last:border-b-0">
                            <button
                              onClick={() => handleSelectMention({ id: group.id, name: group.name, type: 'agent' })}
                              className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-dark-100 flex items-center gap-2"
                            >
                              <span className="w-6 h-6 bg-primary-600 rounded-full flex items-center justify-center text-xs">
                                {group.name.charAt(0)}
                              </span>
                              <div className="flex flex-col flex-1">
                                <span>{group.name}</span>
                                <span className="text-xs text-gray-500">{group.members?.length || 0} 名成员</span>
                              </div>
                            </button>
                            {/* 显示匹配到的项目组成员作为独立选项 */}
                            {group.matchedMembers && group.matchedMembers.length > 0 && (
                              <div className="pl-11 pr-3 pb-2 space-y-1">
                                {group.matchedMembers.map((member: any) => (
                                  <button
                                    key={member.id}
                                    onClick={() => handleSelectMention({ id: member.id, name: member.name, type: 'agent' })}
                                    className="w-full px-2 py-1.5 text-left text-xs text-primary-400 hover:bg-dark-100 rounded flex items-center gap-2"
                                  >
                                    <span className="w-5 h-5 bg-primary-600/30 rounded-full flex items-center justify-center text-xs text-primary-400">
                                      {member.name.charAt(0)}
                                    </span>
                                    <span>{member.name}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="px-3 py-4 text-center text-sm text-gray-500">没有找到匹配的项目组</div>
                      )
                    ) : mentionListType === 'agents' ? (
                      filteredAgents.length > 0 ? (
                        filteredAgents.map((item) => (
                          <button
                            key={item.id}
                            onClick={() => handleSelectMention(item)}
                            className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-dark-100 flex items-center gap-2"
                          >
                            <span className="w-6 h-6 bg-secondary-600 rounded-full flex items-center justify-center text-xs">
                              {item.name.charAt(0)}
                            </span>
                            <span>{item.name}</span>
                          </button>
                        ))
                      ) : (
                        <div className="px-3 py-4 text-center text-sm text-gray-500">没有找到匹配的AI员工</div>
                      )
                    ) : (
                      filteredUsers.length > 0 ? (
                        filteredUsers.map((item) => (
                          <button
                            key={item.id}
                            onClick={() => handleSelectMention(item)}
                            className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-dark-100 flex items-center gap-2"
                          >
                            <span className="w-6 h-6 bg-primary-600 rounded-full flex items-center justify-center text-xs">
                              {item.name.charAt(0)}
                            </span>
                            <span>{item.name}</span>
                          </button>
                        ))
                      ) : (
                        <div className="px-3 py-4 text-center text-sm text-gray-500">没有找到匹配的用户</div>
                      )
                    )}
                  </div>
                </div>
              )}

              {/* Quote list */}
              {showQuoteList && (
                <div ref={quoteRef} className="absolute bottom-full left-0 mb-2 w-96 bg-dark-200 border border-dark-100 rounded-lg shadow-lg z-20 overflow-hidden">
                  <div className="p-2 border-b border-dark-100 flex items-center justify-between">
                    <span className="text-sm text-gray-400">引用上下文</span>
                    <button
                      onClick={() => setShowQuoteList(false)}
                      className="p-1 text-gray-500 hover:text-white"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <div className="p-2 border-b border-dark-100">
                    <input
                      type="text"
                      value={quoteSearch}
                      onChange={(e) => setQuoteSearch(e.target.value)}
                      placeholder="搜索消息内容..."
                      className="w-full px-3 py-1.5 bg-dark-100 border border-dark-100 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                      autoFocus
                    />
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {filteredQuotes.length > 0 ? (
                      filteredQuotes.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => handleSelectQuote(item)}
                          className="w-full px-3 py-2 text-left hover:bg-dark-100 border-b border-dark-100 last:border-b-0"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs text-primary-400">{item.sender}</span>
                            <span className="text-xs text-gray-500">
                              {formatTimestamp(item.timestamp)}
                            </span>
                          </div>
                          <p className="text-sm text-gray-300 line-clamp-2">{item.content}</p>
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-4 text-center text-sm text-gray-500">没有可引用的消息</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* File input */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
          <button
            type="submit"
            disabled={!message.trim()}
            className="p-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl transition-colors disabled:opacity-50"
          >
            <Send size={20} />
          </button>
        </div>
      </form>
      </div>
      </div>

      {/* Project group detail sidebar */}
      {showGroupDetail && currentGroup && (
        <div className="w-80 border-l border-dark-100 bg-dark-300 overflow-y-auto">
          <div className="p-4 border-b border-dark-100 flex items-center justify-between">
            <h3 className="font-semibold text-white">项目组详情</h3>
            <button
              onClick={() => setShowGroupDetail(false)}
              className="p-1.5 hover:bg-dark-100 rounded-lg transition-colors text-gray-400 hover:text-white"
            >
              <X size={16} />
            </button>
          </div>
          <div className="p-4 space-y-4">
            <div className="flex flex-col items-center gap-2">
              <div className="w-20 h-20 bg-secondary-600 rounded-lg flex items-center justify-center">
                <Bot size={32} className="text-white" />
              </div>
              <div className="text-center">
                <div className="font-medium text-white">{currentGroup.name}</div>
                <div className="text-xs text-gray-400">{currentGroup.description || '多 AI 智能体协作项目组'}</div>
              </div>
            </div>
            
            <div>
              <h4 className="text-sm font-medium text-gray-400 mb-2">基本信息</h4>
              <div className="bg-dark-200 p-3 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-xs text-gray-500">创建时间</span>
                  <span className="text-xs text-gray-300">{formatTimestamp(currentGroup.createdAt)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-gray-500">更新时间</span>
                  <span className="text-xs text-gray-300">{formatTimestamp(currentGroup.updatedAt)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-gray-500">状态</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${currentGroup.isActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {currentGroup.isActive ? '活跃' : '已归档'}
                  </span>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="text-sm font-medium text-gray-400 mb-2">成员信息</h4>
              <div className="bg-dark-200 p-3 rounded-lg">
                <div className="mb-3">
                  <div className="text-xs text-gray-500 mb-1">群主</div>
                  <div className="flex items-center gap-2">
                    {(() => {
                      const supervisor = agents.find(a => a.id === currentGroup.supervisorId)
                      return supervisor ? (
                        <>
                          {supervisor.avatar && supervisor.avatar.startsWith('http') ? (
                            <img
                              src={supervisor.avatar}
                              alt={supervisor.name}
                              className="w-6 h-6 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-6 h-6 bg-secondary-600 rounded-full flex items-center justify-center text-sm">
                              {supervisor.avatar || supervisor.name.charAt(0)}
                            </div>
                          )}
                          <span className="text-xs text-gray-300">{supervisor.name}</span>
                        </>
                      ) : (
                        <span className="text-xs text-gray-500">未知</span>
                      )
                    })()}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">成员 ({currentGroup.members?.filter(m => m.agentId !== currentGroup.supervisorId).length || 0})</div>
                  {currentGroup.members && currentGroup.members.length > 0 ? (
                    <div className="space-y-2">
                      {currentGroup.members
                        .filter(member => member.agentId !== currentGroup.supervisorId) // 去除群主
                        .map((member) => {
                          const agent = agents.find(a => a.id === member.agentId)
                          if (!agent) return null
                          return (
                            <div key={member.agentId} className="flex items-center gap-2">
                              {agent.avatar && agent.avatar.startsWith('http') ? (
                                <img
                                  src={agent.avatar}
                                  alt={agent.name}
                                  className="w-5 h-5 rounded-full object-cover"
                                />
                              ) : (
                                <div className="w-5 h-5 bg-secondary-600 rounded-full flex items-center justify-center text-xs">
                                  {agent.avatar || agent.name.charAt(0)}
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="text-xs text-gray-300 truncate">{agent.name}</div>
                                {member.roleInGroup && (
                                  <div className="text-xs text-gray-500 truncate">{member.roleInGroup}</div>
                                )}
                              </div>
                            </div>
                          )
                        })}
                    </div>
                  ) : (
                    <div className="text-xs text-gray-500">暂无成员</div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="mt-6">
              <button
                onClick={() => {
                  if (confirm('确定要解散项目组吗？此操作不可撤销！')) {
                    const { deleteGroup } = useProjectGroupStore.getState()
                    deleteGroup(currentGroup.id).then(() => {
                      setShowGroupDetail(false)
                    })
                  }
                }}
                className="w-full py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Trash2 size={16} />
                解散项目组
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Collaboration detail sidebar */}
      {showCollaborationDetail && showCollaborationView && currentGroup && (
        <div className="w-96 border-l border-dark-100 bg-dark-300 flex flex-col h-full overflow-hidden">
          <div className="p-4 border-b border-dark-100 flex items-center justify-between shrink-0">
            <h3 className="font-semibold text-white">协作详情</h3>
            <button
              onClick={() => {
                setShowCollaborationDetail(false)
                setShowCollaborationView(false)
              }}
              className="p-1.5 hover:bg-dark-100 rounded-lg transition-colors text-gray-400 hover:text-white"
            >
              <X size={16} />
            </button>
          </div>
          
          {/* AI Employees Status - Fixed at top */}
          <div className="shrink-0 p-4 border-b border-dark-100 bg-dark-300">
            <div className="flex items-center gap-2 mb-3">
              <Users size={16} className="text-secondary-400" />
              <span className="text-sm font-medium text-secondary-400">AI 员工状态</span>
            </div>
            <div className="flex flex-wrap gap-2">
                {currentGroup.members && currentGroup.members.map((member) => {
                  const agent = agents.find(a => String(a.id) === String(member.agentId))
                  if (!agent) {
                    console.log('[AI Status] No agent found for member:', member.agentId, 'Available agents:', agents.map(a => a.id))
                    return null
                  }
                  console.log('[AI Status] Found agent:', agent.name, 'status:', agent.status)
                  
                  let statusColor = 'bg-gray-500'
                  let statusText = '空闲'
                  let statusIcon = <Users size={12} />
                  
                  switch (agent.status) {
                    case 'thinking':
                      statusColor = 'bg-yellow-500'
                      statusText = '思考中'
                      statusIcon = <Clock size={12} className="animate-pulse" />
                      break
                    case 'working':
                      statusColor = 'bg-blue-500'
                      statusText = '工作中'
                      statusIcon = <Bot size={12} className="animate-pulse" />
                      break
                    case 'error':
                      statusColor = 'bg-red-500'
                      statusText = '错误'
                      break
                    default:
                      statusIcon = <Users size={12} />
                  }
                  
                  return (
                    <div key={member.agentId} className="flex items-center gap-2 bg-dark-200 px-2 py-1 rounded-lg">
                      {agent.avatar && agent.avatar.startsWith('http') ? (
                        <img src={agent.avatar} alt={agent.name} className="w-5 h-5 rounded-full object-cover" />
                      ) : (
                        <div className="w-5 h-5 bg-secondary-600 rounded-full flex items-center justify-center text-xs text-white">
                          {agent.avatar || agent.name.charAt(0)}
                        </div>
                      )}
                      <div className="text-xs text-gray-300 truncate">{agent.name}</div>
                      <div className={`w-2 h-2 rounded-full ${statusColor}`} title={statusText} />
                    </div>
                  )
                }).filter(Boolean)}
            </div>
          </div>
          
          {/* Scrollable content area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Collaboration Process */}
            <div className="p-3 bg-gradient-to-r from-primary-900/20 to-secondary-900/20 rounded-xl border border-primary-500/30">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare size={16} className="text-primary-400" />
                <span className="text-sm font-medium text-primary-400">协作过程</span>
              </div>
              {collaborationEvents.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {collaborationEvents.slice(-20).map((event) => (
                    <div key={event.id} className="flex items-start gap-2 text-sm">
                      <div className="flex items-center gap-1 mt-0.5">
                        {getCollaborationIcon(event.type)}
                      </div>
                      <div className="flex-1">
                        <span className="font-medium text-white text-xs">
                          {event.fromAgent === 'user' ? (user?.username || '用户') : event.fromAgent}
                        </span>
                        {event.toAgent && (
                          <>
                            <span className="text-gray-400 mx-1">→</span>
                            <span className="text-primary-400 text-xs">{event.toAgent}</span>
                          </>
                        )}
                        {event.type === 'thinking' && (
                          <span className="text-yellow-400 ml-1 text-xs">思考中...</span>
                        )}
                        {event.type === 'tool' && (
                          <span className="text-purple-400 ml-1 text-xs">工具调用</span>
                        )}
                        {event.type === 'result' && (
                          <span className="text-green-400 ml-1 text-xs">成果产出</span>
                        )}
                        {event.content && (
                          <p className="text-gray-400 text-xs mt-1 line-clamp-2">
                            {event.content}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-gray-500">
                        {formatTimestamp(event.timestamp)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-500">
                  <p className="mb-2">暂无协作记录</p>
                  <p className="text-xs">开始对话或使用 @ 来激活协作视图！</p>
                </div>
              )}
            </div>
            
            {/* Tools and Results */}
            <div className="p-3 bg-gradient-to-r from-tertiary-900/20 to-secondary-900/20 rounded-xl border border-tertiary-500/30">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-4 h-4 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-orange-500"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>
                </div>
                <span className="text-sm font-medium text-orange-500">工具调用与成果</span>
              </div>
              <div className="space-y-3 max-h-48 overflow-y-auto">
                {/* 工具调用 */}
                {collaborationEvents.filter(e => e.type === 'tool').length > 0 ? (
                  collaborationEvents.filter(e => e.type === 'tool').slice(-5).map((event) => (
                    <div key={event.id} className="bg-dark-50 rounded-lg p-2 border border-dark-200">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-5 h-5 rounded-full bg-purple-600/30 flex items-center justify-center">
                          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-400"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="m22 2-7 20-4-9-9-4 20-7"/></svg>
                        </div>
                        <div className="flex-1">
                          <div className="text-xs font-medium text-white">{event.fromAgent}</div>
                          <div className="text-xs text-purple-400">工具调用</div>
                        </div>
                        <span className="text-xs text-gray-400">{formatTimestamp(event.timestamp)}</span>
                      </div>
                      {event.content && (
                        <div className="text-xs text-gray-200 bg-dark-100 p-1.5 rounded">
                          {event.content}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-gray-400">
                    暂无工具调用记录
                  </div>
                )}
                
                {/* 成果产出 */}
                {collaborationEvents.filter(e => e.type === 'result').length > 0 && (
                  <div className="mt-3">
                    <div className="text-xs text-gray-400 mb-2">成果产出</div>
                    {collaborationEvents.filter(e => e.type === 'result').slice(-3).map((event) => (
                      <div key={event.id} className="bg-dark-50 rounded-lg p-2 border border-dark-200 mb-2">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-5 h-5 rounded-full bg-green-600/30 flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-400"><polyline points="20 6 9 17 4 12"></polyline></svg>
                          </div>
                          <div className="flex-1">
                            <div className="text-xs font-medium text-white">{event.fromAgent}</div>
                            <div className="text-xs text-green-400">成果产出</div>
                          </div>
                          <span className="text-xs text-gray-400">{formatTimestamp(event.timestamp)}</span>
                        </div>
                        {event.content && (
                          <div className="text-xs text-gray-200 bg-dark-100 p-1.5 rounded">
                            {event.content}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
