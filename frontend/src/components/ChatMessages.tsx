import React, { useEffect, useRef } from 'react'
import { useChatStore, Message } from '@/stores'
import { ChatMessage } from './ChatMessage'
import { Bot, Search } from 'lucide-react'

interface ChatMessagesProps {
  searchQuery?: string
}

export const ChatMessages: React.FC<ChatMessagesProps> = ({
  searchQuery = ''
}) => {
  const { sessions, currentSessionId, isTyping } = useChatStore()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const currentSession = currentSessionId ? sessions.get(currentSessionId) : null
  const messages = currentSession?.messages || []
  const filteredMessages = searchQuery
    ? messages.filter(msg => msg.content.toLowerCase().includes(searchQuery.toLowerCase()))
    : messages

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  if (!currentSession) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
        <Bot size={64} className="mb-4 opacity-50" />
        <p className="text-lg">选择一个 AI 员工开始对话</p>
        <p className="text-sm mt-2">或创建一个新的 AI 员工</p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {filteredMessages.length === 0 ? (
          messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <Bot size={48} className="mb-3 opacity-50" />
              <p>开始和 {currentSession?.agentId} 对话吧！</p>
              <p className="text-sm mt-1">输入消息后按 Enter 发送</p>
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
            {filteredMessages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}

            {/* Typing indicator */}
            {isTyping && !searchQuery && (
              <div className="flex gap-3 p-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-secondary-600 flex items-center justify-center">
                  <Bot size={16} className="text-white" />
                </div>
                <div className="px-4 py-3 bg-dark-100 rounded-2xl rounded-tl-md">
                  <div className="flex gap-1">
                    <span className="typing-dot w-2 h-2 bg-gray-400 rounded-full" />
                    <span className="typing-dot w-2 h-2 bg-gray-400 rounded-full" />
                    <span className="typing-dot w-2 h-2 bg-gray-400 rounded-full" />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>
    </div>
  )
}