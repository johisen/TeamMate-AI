import React, { useState, useEffect } from 'react'
import { Bot, MessageSquare, Coffee, Briefcase, Clock, Activity, Zap, FileText, Search, Code } from 'lucide-react'
import { useAgentStore } from '@/stores'

interface AgentStatus {
  id: string
  name: string
  avatar?: string
  role: string
  status: 'idle' | 'thinking' | 'working' | 'error'
  currentTask?: string
  progress?: number
  lastActivity?: string
}

export const LobsterOfficePage: React.FC = () => {
  const { agents, fetchAgents } = useAgentStore()
  const [agentStatuses, setAgentStatuses] = useState<AgentStatus[]>([])
  const [ws, setWs] = useState<WebSocket | null>(null)

  useEffect(() => {
    fetchAgents()
  }, [])

  useEffect(() => {
    if (agents.length > 0) {
      const statuses = agents.map(agent => ({
        id: agent.id,
        name: agent.name,
        avatar: agent.avatar,
        role: agent.role,
        status: agent.status as 'idle' | 'thinking' | 'working' | 'error',
        currentTask: getRandomTask(agent.status),
        progress: agent.status === 'working' ? Math.random() * 100 : undefined,
        lastActivity: new Date().toLocaleTimeString(),
      }))
      setAgentStatuses(statuses)
    }
  }, [agents])

  useEffect(() => {
    setupWebSocket()
    return () => {
      if (ws) {
        ws.close()
      }
    }
  }, [])

  const setupWebSocket = () => {
    const wsUrl = `ws://localhost:8000/ws/status`
    const websocket = new WebSocket(wsUrl)

    websocket.onopen = () => {
      console.log('Lobster Office WebSocket connected')
      websocket.send(JSON.stringify({ type: 'subscribe' }))
    }

    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (data.type === 'agents') {
        updateAgentStatuses(data.agents)
      }
    }

    websocket.onerror = (error) => {
      console.error('WebSocket error:', error)
    }

    setWs(websocket)
  }

  const updateAgentStatuses = (agentData: any[]) => {
    setAgentStatuses(prev => prev.map(agent => {
      const updated = agentData.find(a => a.id === agent.id)
      if (updated) {
        return {
          ...agent,
          status: updated.status,
          currentTask: getRandomTask(updated.status),
          lastActivity: new Date().toLocaleTimeString(),
        }
      }
      return agent
    }))
  }

  const getRandomTask = (status: string): string => {
    if (status === 'idle') return '空闲中...'
    if (status === 'thinking') return '思考中...'
    if (status === 'working') {
      const tasks = [
        '分析文档...',
        '搜索网络...',
        '执行代码...',
        '查询知识库...',
        '处理请求...',
      ]
      return tasks[Math.floor(Math.random() * tasks.length)]
    }
    return '未知状态'
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'idle':
        return <Coffee size={20} className="text-green-400" />
      case 'thinking':
        return <Zap size={20} className="text-yellow-400" />
      case 'working':
        return <Activity size={20} className="text-blue-400" />
      case 'error':
        return <Bot size={20} className="text-red-400" />
      default:
        return <Bot size={20} className="text-gray-400" />
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'idle': return '空闲'
      case 'thinking': return '思考中'
      case 'working': return '工作中'
      case 'error': return '错误'
      default: return status
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'idle': return 'border-green-500/50 bg-green-500/10'
      case 'thinking': return 'border-yellow-500/50 bg-yellow-500/10'
      case 'working': return 'border-blue-500/50 bg-blue-500/10'
      case 'error': return 'border-red-500/50 bg-red-500/10'
      default: return 'border-gray-500/50 bg-gray-500/10'
    }
  }

  const idleAgents = agentStatuses.filter(a => a.status === 'idle')
  const thinkingAgents = agentStatuses.filter(a => a.status === 'thinking')
  const workingAgents = agentStatuses.filter(a => a.status === 'working')

  const renderAgentCard = (agent: AgentStatus) => (
    <div
      key={agent.id}
      className={`p-4 rounded-xl border-2 ${getStatusColor(agent.status)} transition-all`}
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="relative">
          {agent.avatar ? (
            <img
              src={agent.avatar}
              alt={agent.name}
              className="w-12 h-12 rounded-full object-cover"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-secondary-600 flex items-center justify-center text-white text-lg font-medium">
              {agent.name.charAt(0)}
            </div>
          )}
          <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-dark-300 flex items-center justify-center ${
            agent.status === 'idle' ? 'bg-green-500' :
            agent.status === 'thinking' ? 'bg-yellow-500' :
            agent.status === 'working' ? 'bg-blue-500' : 'bg-red-500'
          }`}>
            {agent.status === 'thinking' && <div className="animate-pulse">💭</div>}
            {agent.status === 'working' && <div className="animate-bounce">⚡</div>}
          </div>
        </div>
        <div className="flex-1">
          <div className="font-medium text-white">{agent.name}</div>
          <div className="text-xs text-gray-400">{agent.role}</div>
        </div>
        {getStatusIcon(agent.status)}
      </div>

      <div className="text-sm text-gray-300 mb-2">{agent.currentTask}</div>

      {agent.status === 'working' && agent.progress !== undefined && (
        <div className="mt-2">
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>进度</span>
            <span>{Math.round(agent.progress)}%</span>
          </div>
          <div className="h-2 bg-dark-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-500"
              style={{ width: `${agent.progress}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex items-center gap-1 mt-3 text-xs text-gray-500">
        <Clock size={12} />
        <span>{agent.lastActivity}</span>
      </div>
    </div>
  )

  const renderEmptyZone = (message: string) => (
    <div className="flex flex-col items-center justify-center py-12 text-gray-500">
      <div className="w-16 h-16 bg-dark-200 rounded-full flex items-center justify-center mb-3">
        <Bot size={32} className="opacity-50" />
      </div>
      <p className="text-sm">{message}</p>
    </div>
  )

  return (
    <div className="p-6 min-h-full bg-dark-400">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-2">🦞 龙虾办公室</h1>
        <p className="text-gray-400">实时查看 AI 员工的工作状态</p>
      </div>

      {/* Stats overview */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-dark-300 rounded-xl p-4 border border-dark-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
              <Coffee size={20} className="text-green-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{idleAgents.length}</div>
              <div className="text-xs text-gray-400">空闲中</div>
            </div>
          </div>
        </div>
        <div className="bg-dark-300 rounded-xl p-4 border border-dark-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center">
              <Zap size={20} className="text-yellow-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{thinkingAgents.length}</div>
              <div className="text-xs text-gray-400">思考中</div>
            </div>
          </div>
        </div>
        <div className="bg-dark-300 rounded-xl p-4 border border-dark-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <Activity size={20} className="text-blue-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{workingAgents.length}</div>
              <div className="text-xs text-gray-400">工作中</div>
            </div>
          </div>
        </div>
        <div className="bg-dark-300 rounded-xl p-4 border border-dark-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-secondary-500/20 rounded-lg flex items-center justify-center">
              <Bot size={20} className="text-secondary-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{agentStatuses.length}</div>
              <div className="text-xs text-gray-400">总员工数</div>
            </div>
          </div>
        </div>
      </div>

      {/* Three zones */}
      <div className="grid grid-cols-3 gap-6">
        {/* Lounge - Idle zone */}
        <div className="bg-dark-300 rounded-xl p-4 border border-dark-100">
          <div className="flex items-center gap-2 mb-4">
            <Coffee size={20} className="text-green-400" />
            <h2 className="text-lg font-medium text-white">休闲区</h2>
            <span className="text-xs text-gray-400 ml-auto">{idleAgents.length} 人</span>
          </div>
          <div className="space-y-3">
            {idleAgents.length > 0 ? (
              idleAgents.map(agent => renderAgentCard(agent))
            ) : (
              renderEmptyZone('暂无空闲员工')
            )}
          </div>
        </div>

        {/* Chat zone - Thinking */}
        <div className="bg-dark-300 rounded-xl p-4 border border-dark-100">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare size={20} className="text-yellow-400" />
            <h2 className="text-lg font-medium text-white">对话区</h2>
            <span className="text-xs text-gray-400 ml-auto">{thinkingAgents.length} 人</span>
          </div>
          <div className="space-y-3">
            {thinkingAgents.length > 0 ? (
              thinkingAgents.map(agent => (
                <div key={agent.id} className="animate-pulse">
                  {renderAgentCard(agent)}
                </div>
              ))
            ) : (
              renderEmptyZone('暂无对话中的员工')
            )}
          </div>
        </div>

        {/* Office zone - Working */}
        <div className="bg-dark-300 rounded-xl p-4 border border-dark-100">
          <div className="flex items-center gap-2 mb-4">
            <Briefcase size={20} className="text-blue-400" />
            <h2 className="text-lg font-medium text-white">办公区</h2>
            <span className="text-xs text-gray-400 ml-auto">{workingAgents.length} 人</span>
          </div>
          <div className="space-y-3">
            {workingAgents.length > 0 ? (
              workingAgents.map(agent => renderAgentCard(agent))
            ) : (
              renderEmptyZone('暂无工作中的员工')
            )}
          </div>
        </div>
      </div>

      {/* Activity log */}
      <div className="mt-6 bg-dark-300 rounded-xl p-4 border border-dark-100">
        <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
          <Activity size={20} className="text-primary-400" />
          实时活动
        </h3>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {agentStatuses.slice(0, 10).map((agent, index) => (
            <div key={agent.id} className="flex items-center gap-3 p-2 bg-dark-200 rounded-lg">
              {getStatusIcon(agent.status)}
              <span className="text-sm text-white">{agent.name}</span>
              <span className="text-xs text-gray-400">-</span>
              <span className="text-sm text-gray-300">{agent.currentTask}</span>
              <span className="text-xs text-gray-500 ml-auto">{agent.lastActivity}</span>
            </div>
          ))}
          {agentStatuses.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <Bot size={40} className="mx-auto mb-3 opacity-50" />
              <p className="text-sm">暂无活动记录</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
