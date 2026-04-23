import React from 'react'
import { Plus, Bot } from 'lucide-react'
import { useAgentStore, Agent } from '@/stores'
import { AgentCard } from './AgentCard'

interface AgentListProps {
  onCreateAgent: () => void
  onEditAgent?: (agent: Agent) => void
}

export const AgentList: React.FC<AgentListProps> = ({ onCreateAgent, onEditAgent }) => {
  const { agents, currentAgent, selectAgent, deleteAgent } = useAgentStore()

  const handleDelete = async (agent: Agent) => {
    if (confirm(`确定要删除 AI 员工 "${agent.name}" 吗？`)) {
      await deleteAgent(agent.id)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-dark-100">
        <div className="flex items-center gap-2">
          <Bot size={20} className="text-secondary-400" />
          <span className="font-semibold text-white">AI 员工</span>
          <span className="text-xs text-gray-500 bg-dark-100 px-2 py-0.5 rounded-full">
            {agents.length}
          </span>
        </div>
        <button
          onClick={onCreateAgent}
          className="p-1.5 hover:bg-dark-100 rounded-lg transition-colors"
          title="添加 AI 员工"
        >
          <Plus size={18} className="text-gray-400" />
        </button>
      </div>

      {/* Agent list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {agents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 py-8">
            <Bot size={40} className="mb-3 opacity-50" />
            <p className="text-sm">暂无 AI 员工</p>
            <button
              onClick={onCreateAgent}
              className="mt-3 text-sm text-primary-400 hover:text-primary-300"
            >
              创建第一个 AI 员工
            </button>
          </div>
        ) : (
          agents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              isSelected={currentAgent?.id === agent.id}
              onClick={() => selectAgent(agent)}
              onEdit={onEditAgent ? () => onEditAgent(agent) : undefined}
              onDelete={() => handleDelete(agent)}
            />
          ))
        )}
      </div>
    </div>
  )
}
