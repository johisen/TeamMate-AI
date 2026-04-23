import React from 'react'
import { Bot, MoreVertical, Trash2, Edit2 } from 'lucide-react'
import type { Agent } from '@/stores'

interface AgentCardProps {
  agent: Agent
  isSelected?: boolean
  onClick?: () => void
  onDelete?: () => void
  onEdit?: () => void
}

export const AgentCard: React.FC<AgentCardProps> = ({
  agent,
  isSelected,
  onClick,
  onDelete,
  onEdit,
}) => {
  const statusColors = {
    idle: 'bg-green-500',
    thinking: 'bg-yellow-500',
    working: 'bg-blue-500',
    error: 'bg-red-500',
  }

  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all group ${
        isSelected
          ? 'bg-primary-600/20 border border-primary-500'
          : 'hover:bg-dark-100 border border-transparent'
      }`}
    >
      {/* Avatar */}
      <div className="relative">
        {agent.avatar ? (
          <img
            src={agent.avatar}
            alt={agent.name}
            className="w-10 h-10 rounded-full object-cover"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-secondary-600 flex items-center justify-center">
            <Bot size={20} className="text-white" />
          </div>
        )}
        {/* Status indicator */}
        <span
          className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-dark-300 ${statusColors[agent.status]}`}
        />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-white truncate">{agent.name}</span>
        </div>
        <span className="text-xs text-gray-400 truncate">{agent.role}</span>
      </div>

      {/* Actions */}
      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
        {onEdit && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onEdit()
            }}
            className="p-1.5 hover:bg-dark-200 rounded-lg transition-colors"
          >
            <Edit2 size={14} className="text-gray-400" />
          </button>
        )}
        {onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            className="p-1.5 hover:bg-red-500/20 rounded-lg transition-colors"
          >
            <Trash2 size={14} className="text-red-400" />
          </button>
        )}
      </div>
    </div>
  )
}
