import React from 'react'
import { User, Bot, AlertCircle } from 'lucide-react'
import type { Message } from '@/stores'

interface ChatMessageProps {
  message: Message
}

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

export const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.type === 'user'
  const isSystem = message.type === 'system'

  return (
    <div className={`flex gap-3 p-4 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser
            ? 'bg-primary-600'
            : isSystem
            ? 'bg-yellow-600'
            : 'bg-secondary-600'
        }`}
      >
        {isUser ? (
          <User size={16} className="text-white" />
        ) : isSystem ? (
          <AlertCircle size={16} className="text-white" />
        ) : (
          <Bot size={16} className="text-white" />
        )}
      </div>

      {/* Content */}
      <div
        className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[70%]`}
      >
        {/* Agent name */}
        {(message.type === 'agent' || message.type === 'supervisor') && message.agentName && (
          <span className="text-xs text-secondary-400 mb-1 px-1">
            {message.agentName}
          </span>
        )}

        <div
          className={`px-4 py-2 rounded-2xl ${
            isUser
              ? 'bg-primary-600 text-white rounded-tr-md'
              : isSystem
              ? 'bg-yellow-600/20 text-yellow-300 border border-yellow-600/30'
              : 'bg-dark-100 text-white rounded-tl-md'
          }`}
        >
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        </div>

        {/* Timestamp */}
        <span className="text-xs text-gray-500 mt-1">
          {formatTimestamp(message.timestamp)}
          {message.tokenCount && ` · ${message.tokenCount} tokens`}
        </span>
      </div>
    </div>
  )
}
