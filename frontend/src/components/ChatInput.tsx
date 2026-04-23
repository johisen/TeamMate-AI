import React, { useState, useRef, useEffect } from 'react'
import { AtSign, Hash, Smile, Paperclip, Send, Archive, RotateCcw, Image, X, Users } from 'lucide-react'
import { useChatStore } from '@/stores/chat'
import { useAgentStore } from '@/stores'
import { useProjectGroupStore } from '@/stores/projectGroup'

interface ChatInputProps {
  agentId?: string
  disabled?: boolean
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
  '😤', '😡', '😠', '🤬', '😈', '👿', '💀',
  '☠️', '💩', '🤡', '👹', '👺', '👻', '👽',
  '👾', '🤖', '🎃', '😺', '😸', '😹', '😻',
  '😼', '😽', '🙀', '😿', '😾'
]

export const ChatInput: React.FC<ChatInputProps> = ({ agentId, disabled }) => {
  const { sendMessage, sendCollaborationMessage, isCollaborationMode, setCollaborationMode, collaborationStatus, collaborationRound, maxCollaborationRounds } = useChatStore()
  const { agents } = useAgentStore()
  const { groups: projectGroups } = useProjectGroupStore()
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const mentionRef = useRef<HTMLDivElement>(null)
  const quoteRef = useRef<HTMLDivElement>(null)

  const [message, setMessage] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [showEmojis, setShowEmojis] = useState(false)
  const [showMentionList, setShowMentionList] = useState(false)
  const [mentionListType, setMentionListType] = useState<'agents' | 'all' | 'groups'>('agents')
  const [attachments, setAttachments] = useState<{ name: string; type: string; data?: string }[]>([])
  const [mentionSearch, setMentionSearch] = useState('')
  const [showQuoteList, setShowQuoteList] = useState(false)
  const [quoteSearch, setQuoteSearch] = useState('')
  const [emojiUsage, setEmojiUsage] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem('emojiUsage')
    return saved ? JSON.parse(saved) : {}
  })

  const [showCommandSuggestions, setShowCommandSuggestions] = useState(false);
  const [commandSuggestions, setCommandSuggestions] = useState<string[]>([]);

  const { sessions, currentSessionId } = useChatStore()
  const currentSession = currentSessionId ? sessions.get(currentSessionId) : null
  const messages = currentSession?.messages || []

  const filteredQuotes: QuoteItem[] = messages
    .filter(msg => msg.content.toLowerCase().includes(quoteSearch.toLowerCase()))
    .slice(-10)
    .reverse()
    .map(msg => ({
      id: msg.id,
      content: msg.content.length > 100 ? msg.content.substring(0, 100) + '...' : msg.content,
      sender: msg.type === 'user' ? '我' : (agents.find(a => a.id === msg.agentId)?.name || 'AI'),
      timestamp: new Date(msg.timestamp)
    }))

  // 处理输入变化，检测反斜杠、@和#输入
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart || 0;
    setMessage(value);

    // 检测是否输入了反斜杠
    if (value.endsWith('/')) {
      setCommandSuggestions(['/archive', '/compress', '/reset']);
      setShowCommandSuggestions(true);
    } else if (value.includes('/')) {
      const lastSlashIndex = value.lastIndexOf('/');
      const commandPrefix = value.substring(lastSlashIndex);
      const filtered = ['/archive', '/compress', '/reset'].filter(cmd => cmd.startsWith(commandPrefix));
      setCommandSuggestions(filtered);
      setShowCommandSuggestions(filtered.length > 0);
    } else {
      setShowCommandSuggestions(false);
    }

    // 检测是否输入了@
    if (value.endsWith('@')) {
      setMentionListType('agents');
      setMentionSearch('');
      setShowMentionList(true);
      setShowQuoteList(false);
    } else if (value.includes('@')) {
      const lastAtIndex = value.lastIndexOf('@');
      const textAfterAt = value.substring(lastAtIndex + 1);
      if (!textAfterAt.includes(' ')) {
        setMentionSearch(textAfterAt);
        if (!showMentionList) {
          setMentionListType('agents');
          setShowMentionList(true);
          setShowQuoteList(false);
        }
      } else if (showMentionList) {
        setShowMentionList(false);
      }
    } else if (showMentionList) {
      setShowMentionList(false);
    }

    // 检测是否输入了#
    if (value.endsWith('#')) {
      setQuoteSearch('');
      setShowQuoteList(true);
      setShowMentionList(false);
    } else if (value.includes('#')) {
      const lastHashIndex = value.lastIndexOf('#');
      const textAfterHash = value.substring(lastHashIndex + 1);
      if (!textAfterHash.includes(' ')) {
        setQuoteSearch(textAfterHash);
        if (!showQuoteList) {
          setShowQuoteList(true);
          setShowMentionList(false);
        }
      } else if (showQuoteList) {
        setShowQuoteList(false);
      }
    } else if (showQuoteList) {
      setShowQuoteList(false);
    }
  };

  // 处理命令选择
  const handleSelectCommand = (command: string) => {
    // 将命令填充到输入框
    setMessage(command);
    setShowCommandSuggestions(false);
  };

  // 自动调整输入框高度
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`
    }
  }, [message])

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (message.trim()) {
        handleSubmit(e as unknown as React.FormEvent)
      }
    }
  }

  // 处理命令
  const handleCommand = (command: string) => {
    const commandText = command.trim();

    if (commandText === '/archive') {
      handleArchive();
      return true;
    } else if (commandText === '/compress') {
      handleCompress();
      return true;
    } else if (commandText === '/reset') {
      handleReset();
      return true;
    }

    return false;
  };

  // 发送消息
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim() && attachments.length === 0) return

    console.log('handleSubmit called:', {
      message: message.substring(0, 50),
      agentId,
      attachments
    })

    setIsTyping(true)

    // 检查是否以反斜杠命令开头
    if (message.trim().startsWith('/')) {
      const command = message.trim();
      const handled = handleCommand(command);
      if (handled) {
        setMessage('');
        setShowCommandSuggestions(false);
        setIsTyping(false);
        return;
      }
    }

    const messageText = message.trim()
    setMessage('')
    setAttachments([])
    setShowEmojis(false)
    setShowCommandSuggestions(false);

    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
    }

    if (isCollaborationMode) {
      await sendCollaborationMessage(messageText)
    } else {
      await sendMessage(messageText, agentId, attachments)
    }
    setIsTyping(false)
  }

  // 归档
  const handleArchive = () => {
    if (confirm('确定要归档当前对话吗？')) {
      console.log('归档对话历史')
      alert('对话已归档')
    }
    setShowCommandSuggestions(false);
  }

  // 压缩
  const handleCompress = () => {
    if (confirm('确定要压缩对话上下文吗？')) {
      console.log('压缩对话上下文')
      alert('对话上下文已压缩')
    }
    setShowCommandSuggestions(false);
  }

  // 重置
  const handleReset = () => {
    if (confirm('确定要重置对话上下文吗？')) {
      console.log('重置对话')
      alert('对话已重置')
    }
    setShowCommandSuggestions(false);
  }

  // 添加表情
  const handleAddEmoji = (emoji: string) => {
    setMessage(prev => prev + emoji)
    
    // 更新表情使用次数
    const newUsage = { ...emojiUsage, [emoji]: (emojiUsage[emoji] || 0) + 1 }
    setEmojiUsage(newUsage)
    localStorage.setItem('emojiUsage', JSON.stringify(newUsage))
    
    setShowEmojis(false)
    inputRef.current?.focus()
  }
  
  // 获取常用表情（使用次数超过3次的，按使用次数降序排列，最多21个）
  const getFrequentlyUsedEmojis = () => {
    return Object.entries(emojiUsage)
      .filter(([_, count]) => count >= 3)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 21)
      .map(([emoji]) => emoji)
  }

  // @提及
  const handleMention = (type: 'agents' | 'all' | 'groups') => {
    setMentionListType(type)
    setShowMentionList(true)
    setShowEmojis(false)
  }

  // #标签
  const handleHashTag = () => {
    setQuoteSearch('')
    setShowQuoteList(true)
    setShowMentionList(false)
    setShowEmojis(false)
  }

  // 选择引用
  const handleSelectQuote = (item: QuoteItem) => {
    const quoteText = `\n> ${item.content}\n`
    setMessage(prev => prev + quoteText)
    setShowQuoteList(false)
    setQuoteSearch('')
    inputRef.current?.focus()
  }

  // 附件
  const handleAttachClick = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files
      if (files) {
        const newAttachments = Array.from(files).map(file => ({
          name: file.name,
          type: file.type
        }))
        setAttachments(prev => [...prev, ...newAttachments])
      }
    }
    input.click()
  }

  // 移除附件
  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index))
  }

  // 点击外部关闭提及列表和引用列表
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

  const handleMentionSelect = (name: string) => {
    // 移除输入框中最后的@
    setMessage(prev => {
      const lastAtIndex = prev.lastIndexOf('@')
      if (lastAtIndex !== -1) {
        // 移除@及后面的内容
        const textBeforeAt = prev.substring(0, lastAtIndex)
        return textBeforeAt + `@${name} `
      }
      return prev + `@${name} `
    })
    setShowMentionList(false)
    inputRef.current?.focus()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 p-4 border-t border-dark-100">

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
          <RotateCcw size={14} />
          压缩
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="px-3 py-1.5 text-xs bg-dark-200 hover:bg-dark-100 text-gray-300 rounded-lg transition-colors flex items-center gap-1"
        >
          <RotateCcw size={14} />
          重置
        </button>
        <button
          type="button"
          onClick={() => setCollaborationMode(!isCollaborationMode)}
          className={`px-3 py-1.5 text-xs rounded-lg transition-colors flex items-center gap-1 ${
            isCollaborationMode
              ? 'bg-primary-600 text-white'
              : 'bg-dark-200 hover:bg-dark-100 text-gray-300'
          }`}
          title={isCollaborationMode ? '退出协作模式' : '进入协作模式'}
        >
          <Users size={14} />
          协作模式
        </button>
        {collaborationStatus !== 'idle' && (
          <div className="text-xs text-gray-400 flex items-center gap-1">
            {collaborationStatus === 'in_progress' && (
              <span>协作中 (第 {collaborationRound}/{maxCollaborationRounds} 轮)</span>
            )}
            {collaborationStatus === 'completed' && (
              <span>协作完成</span>
            )}
            {collaborationStatus === 'needs_intervention' && (
              <span className="text-yellow-400">需要人工干预</span>
            )}
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
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

          {/* Attachments */}
          {attachments.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {attachments.map((file, index) => (
                <div key={index} className="flex items-center gap-1 px-2 py-1 bg-dark-100 rounded-lg text-sm">
                  <span className="text-gray-400 truncate max-w-[200px]">{file.name}</span>
                  <button
                    type="button"
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
            <textarea
              ref={inputRef}
              value={message}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="输入消息，Enter 发送，Shift+Enter 换行..."
              disabled={disabled || isTyping}
              rows={1}
              className="w-full px-4 py-3 pr-32 bg-dark-200 border border-dark-100 rounded-xl text-white placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50"
              style={{
                minHeight: '48px',
                maxHeight: '120px',
              }}
            />

            {/* Quick actions inside input */}
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleMention('agents')}
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
              <div ref={mentionRef} className="absolute bottom-full left-0 mb-2 w-80 bg-dark-200 border border-dark-100 rounded-lg shadow-lg z-20 overflow-hidden">
                <div className="p-2 border-b border-dark-100 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setMentionListType('agents')}
                    className={`flex-1 px-3 py-1.5 text-xs rounded-lg transition-colors ${
                      mentionListType === 'agents'
                        ? 'bg-primary-600 text-white'
                        : 'bg-dark-100 text-gray-400 hover:text-white'
                    }`}
                  >
                    AI 员工
                  </button>
                  <button
                    type="button"
                    onClick={() => setMentionListType('all')}
                    className={`flex-1 px-3 py-1.5 text-xs rounded-lg transition-colors ${
                      mentionListType === 'all'
                        ? 'bg-primary-600 text-white'
                        : 'bg-dark-100 text-gray-400 hover:text-white'
                    }`}
                  >
                    所有人
                  </button>
                  <button
                    type="button"
                    onClick={() => setMentionListType('groups')}
                    className={`flex-1 px-3 py-1.5 text-xs rounded-lg transition-colors flex items-center justify-center gap-1 ${
                      mentionListType === 'groups'
                        ? 'bg-primary-600 text-white'
                        : 'bg-dark-100 text-gray-400 hover:text-white'
                    }`}
                  >
                    <Users size={12} />
                    项目组
                  </button>
                </div>
                {(mentionListType === 'agents' || mentionListType === 'groups') && (
                  <div className="p-2 border-b border-dark-100">
                    <input
                      type="text"
                      value={mentionSearch}
                      onChange={(e) => setMentionSearch(e.target.value)}
                      placeholder={mentionListType === 'agents' ? '搜索员工...' : '搜索项目组...'}
                      className="w-full px-3 py-1.5 text-sm bg-dark-100 border border-dark-300 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                )}
                <div className="max-h-60 overflow-y-auto">
                  {mentionListType === 'agents' ? (
                    agents
                      .filter(agent =>
                        agent.name.toLowerCase().includes(mentionSearch.toLowerCase())
                      )
                      .map((agent) => (
                        <button
                          key={agent.id}
                          type="button"
                          onClick={() => handleMentionSelect(agent.name)}
                          className="w-full px-3 py-2 text-left hover:bg-dark-100 flex items-center gap-2"
                        >
                          <span className="text-lg">{agent.avatar}</span>
                          <span className="text-white">{agent.name}</span>
                        </button>
                      ))
                  ) : mentionListType === 'all' ? (
                    <button
                      type="button"
                      onClick={() => handleMentionSelect('@所有人')}
                      className="w-full px-3 py-2 text-left hover:bg-dark-100 flex items-center gap-2"
                    >
                      <span className="text-lg">👥</span>
                      <span className="text-white">@所有人</span>
                    </button>
                  ) : (
                    projectGroups
                      .filter(group =>
                        group.name.toLowerCase().includes(mentionSearch.toLowerCase())
                      )
                      .map((group) => (
                        <button
                          key={group.id}
                          type="button"
                          onClick={() => handleMentionSelect(`@${group.name}`)}
                          className="w-full px-3 py-2 text-left hover:bg-dark-100 flex items-center gap-2"
                        >
                          <span className="text-lg">👥</span>
                          <div className="flex flex-col">
                            <span className="text-white">{group.name}</span>
                            <span className="text-xs text-gray-500">{group.members?.length || 0} 名成员</span>
                          </div>
                        </button>
                      ))
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
                    type="button"
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
                        type="button"
                        onClick={() => handleSelectQuote(item)}
                        className="w-full px-3 py-2 text-left hover:bg-dark-100 border-b border-dark-100 last:border-b-0"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-primary-400">{item.sender}</span>
                          <span className="text-xs text-gray-500">
                            {item.timestamp.toLocaleTimeString()}
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
        </div>

        {/* Send button */}
        <button
          type="submit"
          disabled={disabled || isTyping || (!message.trim() && attachments.length === 0)}
          className="p-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
        >
          <Send size={20} />
        </button>
      </div>
    </form>
  )
}