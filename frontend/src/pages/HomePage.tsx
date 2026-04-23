import React, { useEffect, useState, useRef } from 'react'
import { Bot, MessageSquare, Users, Zap, ArrowRight, Sparkles, UsersRound, Trash2, X, BookOpen, MoreVertical, Search, FileText, AtSign, Hash, Paperclip, Smile, Mic } from 'lucide-react'
import { useAgentStore, useChatStore, Message } from '@/stores'
import { useProjectGroupStore } from '@/stores/projectGroup'
import { useAuthStore } from '@/stores/auth'
import { ChatMessages, ChatInput } from '@/components'
import { AgentModal } from '@/components/AgentModal'
import { ProjectGroupModal } from '@/components/ProjectGroupModal'
import { ProjectGroupList } from '@/components/ProjectGroupList'
import { ProjectGroupChat } from '@/components/ProjectGroupChat'

const formatTimestamp = (date: Date | string) => {
  let d: Date;
  if (typeof date === 'string') {
    if (!date.endsWith('Z') && !date.includes('+')) {
      d = new Date(date + 'Z');
    } else {
      d = new Date(date);
    }
  } else {
    d = date;
  }
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

type ViewMode = 'agents' | 'groups'
type SearchType = 'all' | 'text' | 'mention' | 'hashtag' | 'attachment' | 'emoji' | 'voice'

export const HomePage: React.FC = () => {
  const { agents, currentAgent, fetchAgents, selectAgent, deleteAgent } = useAgentStore()
  const { createSession, sessions, currentSessionId, selectSession, loadSessions } = useChatStore()
  const { projectGroups, currentGroup, fetchGroups, selectGroup } = useProjectGroupStore()
  const { user } = useAuthStore()

  const [viewMode, setViewMode] = useState<ViewMode>('agents')
  const [isAgentModalOpen, setIsAgentModalOpen] = useState(false)
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false)
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false)
  const [editingAgent, setEditingAgent] = useState<any>(null)
  const [showAgentDetail, setShowAgentDetail] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchType, setSearchType] = useState<SearchType>('all')
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [agentSearchQuery, setAgentSearchQuery] = useState('')
  const searchRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messageRefs = useRef<{ [key: string]: HTMLDivElement | null }>({})

  const currentSession = currentSessionId ? sessions.get(currentSessionId) : null
  const messages = currentSession?.messages || []

  const filteredAgents = agents.filter(
    (agent) =>
      agent.name.toLowerCase().includes(agentSearchQuery.toLowerCase()) ||
      agent.role.toLowerCase().includes(agentSearchQuery.toLowerCase())
  )

  const filteredMessages = messages.filter((msg) => {
    if (searchQuery === '') return true
    
    const content = msg.content.toLowerCase()
    const query = searchQuery.toLowerCase()
    
    // Filter by search type
    switch (searchType) {
      case 'text':
        return content.includes(query)
      case 'mention':
        return content.includes(`@${query}`) || content.includes(`@[${query}`)
      case 'hashtag':
        return content.includes(`#${query}`)
      case 'attachment':
        // Assuming attachments are stored in msg.attachments
        return msg.attachments?.some(attachment => 
          attachment.name.toLowerCase().includes(query)
        ) || false
      case 'emoji':
        // Simple emoji detection - actual implementation would be more complex
        return /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u.test(content)
      case 'voice':
        // Assuming voice messages have a voice property
        return msg.voice !== undefined
      case 'all':
      default:
        return content.includes(query)
    }
  })

  useEffect(() => {
    fetchAgents()
    fetchGroups()
    
    // Restore last selected agent and session from localStorage
    const lastAgentId = localStorage.getItem('lastSelectedAgentId')
    const lastSessionId = localStorage.getItem('lastSessionId')
    
    if (lastAgentId && agents.length > 0) {
      const agent = agents.find(a => a.id === lastAgentId)
      if (agent) {
        handleSelectAgent(agent, lastSessionId)
      }
    }
  }, [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearchResults(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Auto scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  const handleSelectAgent = async (agent: typeof agents[0], sessionIdToRestore?: string | null) => {
    selectAgent(agent)

    // Save to localStorage for persistence
    localStorage.setItem('lastSelectedAgentId', agent.id)

    // Load sessions from backend first
    await loadSessions(agent.id)

    // Get fresh sessions from store after loading
    const { sessions: freshSessions } = useChatStore.getState()

    let targetSessionId: string

    if (sessionIdToRestore) {
      // Use the provided session ID if it exists
      const session = freshSessions.get(sessionIdToRestore)
      if (session && session.agentId === agent.id) {
        targetSessionId = sessionIdToRestore
      } else {
        // Session doesn't exist or doesn't match, find or create one
        const existingSession = Array.from(freshSessions.values()).find(
          (s) => s.agentId === agent.id
        )
        if (existingSession) {
          targetSessionId = existingSession.id
        } else {
          targetSessionId = await createSession(agent.id)
        }
      }
    } else {
      // No session provided, find or create one
      const existingSession = Array.from(freshSessions.values()).find(
        (s) => s.agentId === agent.id
      )
      if (existingSession) {
        targetSessionId = existingSession.id
      } else {
        targetSessionId = await createSession(agent.id)
      }
    }

    // Save session to localStorage
    localStorage.setItem('lastSessionId', targetSessionId)
    
    // Select the session (which will load messages)
    await selectSession(targetSessionId)
  }

  const handleCreateAgent = () => {
    setEditingAgent(null)
    setIsAgentModalOpen(true)
  }

  const handleEditAgent = (agent: typeof agents[0]) => {
    setEditingAgent(agent)
    setIsAgentModalOpen(true)
  }

  const handleDeleteAgent = async (agent: typeof agents[0]) => {
    if (confirm(`确定要删除员工 "${agent.name}" 吗？此操作不可撤销。`)) {
      await deleteAgent(agent.id)
    }
  }

  const handleCreateGroup = () => {
    setIsGroupModalOpen(true)
  }

  const handleOpenHelp = () => {
    setIsHelpModalOpen(true)
  }

  const handleSearch = () => {
    setShowSearchResults(true)
  }

  const handleSearchTypeChange = (type: SearchType) => {
    setSearchType(type)
  }

  const handleSelectSearchResult = (messageId: string) => {
    // Close search results
    setShowSearchResults(false)
    
    // Scroll to the message
    setTimeout(() => {
      const messageElement = messageRefs.current[messageId]
      if (messageElement) {
        messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
        // Add a highlight effect
        messageElement.classList.add('bg-primary-600/20', 'p-2', 'rounded-lg')
        setTimeout(() => {
          messageElement.classList.remove('bg-primary-600/20', 'p-2', 'rounded-lg')
        }, 2000)
      }
    }, 100)
  }

  return (
    <div className="flex h-full min-w-0">
      {/* Left sidebar - Agent or Group list */}
      <div className="w-80 bg-dark-300 border-r border-dark-100 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-dark-100">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-lg flex items-center justify-center">
                <Bot size={18} className="text-white" />
              </div>
              <span className="font-semibold text-white">TeamMateAI</span>
            </div>
          </div>

          {/* View mode toggle */}
          <div className="flex bg-dark-200 rounded-lg p-1 mb-4">
            <button
              onClick={() => setViewMode('agents')}
              className={`flex-1 py-1.5 px-3 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
                viewMode === 'agents'
                  ? 'bg-dark-100 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Bot size={16} />
              AI 员工
            </button>
            <button
              onClick={() => setViewMode('groups')}
              className={`flex-1 py-1.5 px-3 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
                viewMode === 'groups'
                  ? 'bg-dark-100 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <UsersRound size={16} />
              项目组
            </button>
          </div>

          {/* Search box for agents */}
          {viewMode === 'agents' && (
            <div className="mb-4">
              <div className="relative">
                <input
                  type="text"
                  value={agentSearchQuery}
                  onChange={(e) => setAgentSearchQuery(e.target.value)}
                  placeholder="搜索 AI 员工..."
                  className="w-full pl-10 pr-4 py-2 bg-dark-200 border border-dark-100 rounded-xl text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <Search
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                />
              </div>
            </div>
          )}

          {/* Action button based on mode */}
          {viewMode === 'agents' ? (
            <button
              onClick={handleCreateAgent}
              className="w-full px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5"
            >
              <Sparkles size={16} />
              新增员工
            </button>
          ) : (
            <button
              onClick={handleCreateGroup}
              className="w-full px-3 py-2 bg-secondary-600 hover:bg-secondary-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5"
            >
              <Users size={16} />
              创建项目组
            </button>
          )}
        </div>

        {/* List content based on mode */}
        <div className="flex-1 overflow-y-auto p-2">
          {viewMode === 'agents' ? (
            <>
              {filteredAgents.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 py-8">
                  <Bot size={48} className="mb-4 opacity-50" />
                  <p className="text-sm mb-2">
                    {agentSearchQuery ? '没有找到匹配的 AI 员工' : '还没有 AI 员工'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {agentSearchQuery ? '尝试其他搜索词' : '创建一个 AI 员工开始协作'}
                  </p>
                  {!agentSearchQuery && (
                    <button
                      onClick={handleCreateAgent}
                      className="mt-4 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm rounded-lg transition-colors"
                    >
                      创建第一个 AI 员工
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredAgents.map((agent) => (
                    <div
                      key={agent.id}
                      onClick={() => handleSelectAgent(agent)}
                      className={`group flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                        currentAgent?.id === agent.id && viewMode === 'agents'
                          ? 'bg-primary-600/20 border border-primary-500'
                          : 'hover:bg-dark-100 border border-transparent'
                      }`}
                    >
                      <div className="relative">
                        {agent.avatar ? (
                          agent.avatar.startsWith('http') ? (
                            <img
                              src={agent.avatar}
                              alt={agent.name}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-secondary-600 flex items-center justify-center text-2xl">
                              {agent.avatar}
                            </div>
                          )
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-secondary-600 flex items-center justify-center text-white font-medium">
                            {agent.name.charAt(0)}
                          </div>
                        )}
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-dark-300 ${
                            agent.status === 'idle'
                              ? 'bg-green-500'
                              : agent.status === 'thinking'
                              ? 'bg-yellow-500'
                              : agent.status === 'working'
                              ? 'bg-blue-500'
                              : 'bg-red-500'
                          }`}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white truncate">
                            {agent.name}
                          </span>
                        </div>
                        <span className="text-xs text-gray-400 truncate">
                          {agent.role}
                        </span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleEditAgent(agent)
                        }}
                        className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-primary-500/20 rounded-lg transition-all text-primary-400 hover:text-primary-300"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-edit-3"><path d="M12 20h9"/><path d="M16.38 3.46a2.12 2.12 0 0 1 3.01 3.01L7 19l-4 1 1-4L16.38 3.46z"/></svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <ProjectGroupList />
          )}
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex bg-dark-400 min-w-0">
          <div className="flex-1 flex flex-col min-w-0">
            {viewMode === 'agents' && currentAgent ? (
              <>
                {/* Chat header */}
                <div className="px-6 py-4 border-b border-dark-100 bg-dark-300">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {currentAgent.avatar ? (
                        currentAgent.avatar.startsWith('http') ? (
                          <img
                            src={currentAgent.avatar}
                            alt={currentAgent.name}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-secondary-600 flex items-center justify-center text-2xl">
                            {currentAgent.avatar}
                          </div>
                        )
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-secondary-600 flex items-center justify-center text-white font-medium">
                          {currentAgent.name.charAt(0)}
                        </div>
                      )}
                      <div>
                        <div className="font-medium text-white">{currentAgent.name}</div>
                        <div className="text-xs text-gray-400">{currentAgent.role}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2" ref={searchRef}>
                      {showSearch ? (
                        <div className="flex items-center gap-2 relative">
                          <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                            placeholder="搜索聊天内容..."
                            className="px-3 py-1.5 bg-dark-200 border border-dark-100 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                            autoFocus
                          />
                          <div className="flex gap-1">
                            <button
                              onClick={handleSearch}
                              className="p-1.5 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-dark-100"
                              title="搜索"
                            >
                              <Search size={16} />
                            </button>
                            <button
                              onClick={() => {
                                setShowSearch(false)
                                setSearchQuery('')
                                setShowSearchResults(false)
                              }}
                              className="p-1.5 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-dark-100"
                              title="关闭搜索"
                            >
                              <X size={16} />
                            </button>
                          </div>
                          
                          {/* Search types - horizontal scroll */}
                          <div className="absolute right-0 top-full mt-2 w-80 bg-dark-200 border border-dark-100 rounded-lg shadow-lg p-2">
                            <div className="flex items-center gap-1 overflow-x-auto pb-1">
                              <button
                                onClick={() => handleSearchTypeChange('all')}
                                className={`px-3 py-1.5 text-xs rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                                  searchType === 'all'
                                    ? 'bg-primary-600 text-white'
                                    : 'bg-dark-100 text-gray-400 hover:text-white'
                                }`}
                              >
                                <Search size={14} />
                                全部
                              </button>
                              <button
                                onClick={() => handleSearchTypeChange('text')}
                                className={`px-3 py-1.5 text-xs rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                                  searchType === 'text'
                                    ? 'bg-primary-600 text-white'
                                    : 'bg-dark-100 text-gray-400 hover:text-white'
                                }`}
                              >
                                <FileText size={14} />
                                文本
                              </button>
                              <button
                                onClick={() => handleSearchTypeChange('mention')}
                                className={`px-3 py-1.5 text-xs rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                                  searchType === 'mention'
                                    ? 'bg-primary-600 text-white'
                                    : 'bg-dark-100 text-gray-400 hover:text-white'
                                }`}
                              >
                                <AtSign size={14} />
                                @提及
                              </button>
                              <button
                                onClick={() => handleSearchTypeChange('hashtag')}
                                className={`px-3 py-1.5 text-xs rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                                  searchType === 'hashtag'
                                    ? 'bg-primary-600 text-white'
                                    : 'bg-dark-100 text-gray-400 hover:text-white'
                                }`}
                              >
                                <Hash size={14} />
                                #话题
                              </button>
                              <button
                                onClick={() => handleSearchTypeChange('attachment')}
                                className={`px-3 py-1.5 text-xs rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                                  searchType === 'attachment'
                                    ? 'bg-primary-600 text-white'
                                    : 'bg-dark-100 text-gray-400 hover:text-white'
                                }`}
                              >
                                <Paperclip size={14} />
                                附件
                              </button>
                              <button
                                onClick={() => handleSearchTypeChange('emoji')}
                                className={`px-3 py-1.5 text-xs rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                                  searchType === 'emoji'
                                    ? 'bg-primary-600 text-white'
                                    : 'bg-dark-100 text-gray-400 hover:text-white'
                                }`}
                              >
                                <Smile size={14} />
                                表情
                              </button>
                              <button
                                onClick={() => handleSearchTypeChange('voice')}
                                className={`px-3 py-1.5 text-xs rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                                  searchType === 'voice'
                                    ? 'bg-primary-600 text-white'
                                    : 'bg-dark-100 text-gray-400 hover:text-white'
                                }`}
                              >
                                <Mic size={14} />
                                语音
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={() => setShowSearch(true)}
                            className="p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-dark-100"
                            title="搜索聊天"
                          >
                            <Search size={20} />
                          </button>
                          <button
                            onClick={() => setShowAgentDetail(!showAgentDetail)}
                            className="p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-dark-100"
                            title="员工详情"
                          >
                            <MoreVertical size={20} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Search results */}
                {showSearchResults && (
                  <div className="border-b border-dark-100 bg-dark-300 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-medium text-white">搜索结果</h3>
                      <button
                        onClick={() => setShowSearchResults(false)}
                        className="text-xs text-gray-400 hover:text-white"
                      >
                        关闭
                      </button>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {filteredMessages.length > 0 ? (
                        filteredMessages.map((msg) => (
                          <div 
                            key={msg.id} 
                            className="p-2 hover:bg-dark-200 rounded-lg mb-2 cursor-pointer"
                            onClick={() => handleSelectSearchResult(msg.id)}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-400">
                                {msg.type === 'user' ? (user?.username || '你') : 'AI'}
                              </span>
                              <span className="text-xs text-gray-500">
                               {formatTimestamp(msg.timestamp || Date.now())}
                              </span>
                            </div>
                            <p className="text-sm text-gray-300 line-clamp-2">{msg.content}</p>
                          </div>
                        ))
                      ) : (
                        <div className="text-center text-sm text-gray-500 py-4">
                          没有找到匹配的内容
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4">
                  {messages.map((message) => (
                    <div 
                      key={message.id}
                      ref={el => messageRefs.current[message.id] = el}
                      className={`flex gap-3 mb-4 ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      {message.type !== 'user' && (
                        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                          message.type === 'supervisor' 
                            ? 'bg-primary-500' 
                            : 'bg-secondary-600'
                        }`}>
                          {message.type === 'supervisor' ? (
                            <Users size={16} className="text-white" />
                          ) : (
                            <Bot size={16} className="text-white" />
                          )}
                        </div>
                      )}
                      <div className="flex-1 max-w-[70%]">
                        <div className={`flex items-center gap-2 mb-1 ${
                          message.type === 'user' ? 'justify-end' : 'justify-start'
                        }`}>
                          <span className="text-xs text-gray-400">
                            {message.type === 'user' 
                              ? (user?.username || '你') 
                              : (message.agentName || currentAgent?.name || 'AI')}
                          </span>
                          <span className="text-xs text-gray-500">
                            {formatTimestamp(message.timestamp || Date.now())}
                          </span>
                        </div>
                        <div className={`px-4 py-3 rounded-2xl ${
                          message.type === 'user'
                            ? 'bg-primary-600 text-white rounded-tr-md'
                            : message.type === 'supervisor'
                            ? 'bg-primary-500/20 text-white border border-primary-500/30 rounded-tl-md'
                            : 'bg-dark-100 text-white rounded-tl-md'
                        }`}>
                          <p className="whitespace-pre-wrap break-words">{message.content}</p>
                        </div>
                      </div>
                      {message.type === 'user' && (
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center overflow-hidden">
                          {user?.avatar ? (
                            <img src={user.avatar} alt={user.username} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-white font-medium">{user?.username?.charAt(0) || '你'}</span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="border-t border-dark-100 bg-dark-400">
                  <ChatInput agentId={currentAgent?.id} disabled={false} />
                </div>
              </>
            ) : viewMode === 'groups' && currentGroup ? (
              <ProjectGroupChat />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                <div className="w-24 h-24 bg-gradient-to-br from-primary-500/20 to-secondary-500/20 rounded-full flex items-center justify-center mb-6">
                  <Bot size={48} className="text-primary-400" />
                </div>
                <h2 className="text-2xl font-semibold text-white mb-2">
                  欢迎使用 TeamMateAI
                </h2>
                <p className="text-gray-400 mb-6">
                  {viewMode === 'agents'
                    ? '选择一个 AI 员工开始对话，或创建一个新的 AI 员工'
                    : '选择一个项目组开始团队协作，或创建一个新的项目组'}
                </p>
                <div className="flex gap-4">
                  {viewMode === 'agents' ? (
                    <button
                      onClick={handleCreateAgent}
                      className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-xl transition-colors flex items-center gap-2"
                    >
                      <Sparkles size={18} />
                      创建 AI 员工
                    </button>
                  ) : (
                    <button
                      onClick={handleCreateGroup}
                      className="px-6 py-3 bg-secondary-600 hover:bg-secondary-700 text-white font-medium rounded-xl transition-colors flex items-center gap-2"
                    >
                      <Users size={18} />
                      创建项目组
                    </button>
                  )}
                  <button onClick={handleOpenHelp} className="px-6 py-3 bg-dark-200 hover:bg-dark-100 text-white font-medium rounded-xl transition-colors flex items-center gap-2">
                    <BookOpen size={18} />
                    了解如何使用
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Agent detail sidebar */}
          {showAgentDetail && currentAgent && (
            <div className="w-80 border-l border-dark-100 bg-dark-300 overflow-y-auto">
              <div className="p-4 border-b border-dark-100">
                <h3 className="font-semibold text-white">员工详情</h3>
              </div>
              <div className="p-4 space-y-4">
                <div className="flex flex-col items-center gap-2">
                  {currentAgent.avatar ? (
                    currentAgent.avatar.startsWith('http') ? (
                      <img
                        src={currentAgent.avatar}
                        alt={currentAgent.name}
                        className="w-20 h-20 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-full bg-secondary-600 flex items-center justify-center text-4xl">
                        {currentAgent.avatar}
                      </div>
                    )
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-secondary-600 flex items-center justify-center text-white font-medium text-2xl">
                      {currentAgent.name.charAt(0)}
                    </div>
                  )}
                  <div className="text-center">
                    <div className="font-medium text-white">{currentAgent.name}</div>
                    <div className="text-xs text-gray-400">{currentAgent.role}</div>
                  </div>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium text-gray-400 mb-2">系统提示词</h4>
                  <div className="bg-dark-200 p-3 rounded-lg text-xs text-gray-300">
                    {currentAgent.systemPrompt}
                  </div>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium text-gray-400 mb-2">知识库</h4>
                  <div className="bg-dark-200 p-3 rounded-lg text-xs text-gray-300">
                    {currentAgent.knowledgeBaseIds.length > 0 ? (
                      currentAgent.knowledgeBaseIds.join(', ')
                    ) : (
                      '未绑定知识库'
                    )}
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      handleEditAgent(currentAgent)
                      setShowAgentDetail(false)
                    }}
                    className="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    编辑员工
                  </button>
                  <button
                    onClick={() => setShowAgentDetail(false)}
                    className="px-4 py-2 bg-dark-200 hover:bg-dark-100 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    关闭
                  </button>
                </div>
              </div>
            </div>
          )}
      </div>

      {/* Agent modal */}
      <AgentModal
        isOpen={isAgentModalOpen}
        onClose={() => {
          setIsAgentModalOpen(false)
          setEditingAgent(null)
        }}
        agent={editingAgent}
      />

      {/* Project group modal */}
      <ProjectGroupModal
        isOpen={isGroupModalOpen}
        onClose={() => setIsGroupModalOpen(false)}
      />

      {/* Help modal */}
      {isHelpModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsHelpModalOpen(false)}
          />

          {/* Modal */}
          <div className="relative bg-dark-300 rounded-2xl shadow-2xl w-full max-w-3xl mx-4 overflow-hidden border border-dark-100">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-dark-100">
              <div className="flex items-center gap-2">
                <BookOpen size={20} className="text-secondary-400" />
                <h2 className="text-lg font-semibold text-white">了解如何使用 TeamMateAI</h2>
              </div>
              <button
                onClick={() => setIsHelpModalOpen(false)}
                className="p-1.5 hover:bg-dark-100 rounded-lg transition-colors"
              >
                <X size={18} className="text-gray-400" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 max-h-[80vh] overflow-y-auto">
              <div className="space-y-6">
                <div>
                  <h3 className="text-md font-medium text-white mb-2">创建 AI 员工</h3>
                  <p className="text-sm text-gray-400">
                    点击左侧边栏的「新增员工」按钮，填写员工的姓名、岗位和人格提示词，选择一个头像，然后点击「创建员工」按钮。
                  </p>
                </div>

                <div>
                  <h3 className="text-md font-medium text-white mb-2">创建项目组</h3>
                  <p className="text-sm text-gray-400">
                    切换到「项目组」视图，点击「创建项目组」按钮，填写项目组名称和描述，选择一个群主，然后添加团队成员。
                  </p>
                </div>

                <div>
                  <h3 className="text-md font-medium text-white mb-2">与 AI 员工对话</h3>
                  <p className="text-sm text-gray-400">
                    在左侧边栏选择一个 AI 员工，然后在右侧聊天区域输入消息，点击发送按钮即可开始对话。
                  </p>
                </div>

                <div>
                  <h3 className="text-md font-medium text-white mb-2">项目组协作</h3>
                  <p className="text-sm text-gray-400">
                    切换到「项目组」视图，选择一个项目组，然后在右侧聊天区域输入消息，项目组内的所有 AI 员工将协作完成任务。
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-dark-100 bg-dark-200/50">
              <button
                onClick={() => setIsHelpModalOpen(false)}
                className="w-full px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                我知道了
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}