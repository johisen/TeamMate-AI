import React, { useEffect, useState } from 'react'
import { Plus, Search, Bot, Trash2, X, Building } from 'lucide-react'
import { useAgentStore, useDepartmentStore } from '@/stores'
import { AgentModal } from '@/components/AgentModal'

export const AgentsPage: React.FC = () => {
  const { agents, fetchAgents, deleteAgent, isLoading } = useAgentStore()
  const { departments, jobs, fetchDepartments, fetchJobs, getDepartmentById } = useDepartmentStore()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingAgent, setEditingAgent] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(new Set())
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(null)

  useEffect(() => {
    fetchAgents()
    fetchDepartments()
    fetchJobs()
  }, [])

  const filteredAgents = selectedDepartmentId
    ? agents.filter(agent =>
        agent.departmentId === selectedDepartmentId &&
        (agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        agent.role.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : agents.filter(agent =>
        agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        agent.role.toLowerCase().includes(searchQuery.toLowerCase())
      )

  const groupedAgents = departments.map(dept => ({
    department: dept,
    agents: filteredAgents.filter(agent => agent.departmentId === dept.id)
  })).filter(group => group.agents.length > 0)

  const handleEditAgent = (agent: typeof agents[0]) => {
    setEditingAgent(agent)
    setIsModalOpen(true)
  }

  const handleDeleteAgent = async (agent: typeof agents[0]) => {
    if (confirm(`确定要删除员工 "${agent.name}" 吗？此操作不可撤销。`)) {
      await deleteAgent(agent.id)
    }
  }

  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode)
    setSelectedAgents(new Set())
  }

  const toggleAgentSelection = (agentId: string) => {
    const newSelected = new Set(selectedAgents)
    if (newSelected.has(agentId)) {
      newSelected.delete(agentId)
    } else {
      newSelected.add(agentId)
    }
    setSelectedAgents(newSelected)
  }

  const toggleSelectAll = () => {
    if (selectedAgents.size === filteredAgents.length) {
      setSelectedAgents(new Set())
    } else {
      setSelectedAgents(new Set(filteredAgents.map(agent => agent.id)))
    }
  }

  const handleBatchDelete = async () => {
    if (selectedAgents.size === 0) {
      alert('请选择要删除的员工')
      return
    }

    const confirmMessage = `确定要删除选中的 ${selectedAgents.size} 名员工吗？此操作不可撤销。`
    if (confirm(confirmMessage)) {
      for (const agentId of selectedAgents) {
        await deleteAgent(agentId)
      }
      setSelectedAgents(new Set())
      setIsSelectionMode(false)
    }
  }

  const getAgentCountByDepartment = (departmentId: string) => {
    return agents.filter(agent => agent.departmentId === departmentId).length
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 border-b border-dark-100 bg-dark-300">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-semibold text-white">AI 员工管理</h1>
            <div className="flex items-center gap-4 text-sm text-gray-400 mt-1">
              <span>管理你的 AI 团队成员</span>
              <span>总数: {agents.length}</span>
              <span>空闲: {agents.filter(agent => agent.status === 'idle').length}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isSelectionMode ? (
              <>
                <button
                  onClick={toggleSelectAll}
                  className="px-3 py-2 bg-dark-200 hover:bg-dark-100 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {selectedAgents.size === filteredAgents.length ? '取消全选' : '全选'}
                </button>
                <span className="text-sm text-gray-400">
                  已选择 {selectedAgents.size} / {filteredAgents.length}
                </span>
                <button
                  onClick={handleBatchDelete}
                  disabled={selectedAgents.size === 0}
                  className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1"
                >
                  <Trash2 size={16} />
                  删除 ({selectedAgents.size})
                </button>
                <button
                  onClick={toggleSelectionMode}
                  className="px-3 py-2 bg-dark-200 hover:bg-dark-100 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1"
                >
                  <X size={16} />
                  取消
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={toggleSelectionMode}
                  className="px-3 py-2 bg-dark-200 hover:bg-dark-100 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  批量操作
                </button>
                <button
                  onClick={() => {
                    setEditingAgent(null)
                    setIsModalOpen(true)
                  }}
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
                >
                  <Plus size={18} />
                  新增员工
                </button>
              </>
            )}
          </div>
        </div>

        <div className="flex gap-4 mb-4">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索 AI 员工..."
              className="w-full pl-10 pr-4 py-2 bg-dark-200 border border-dark-100 rounded-xl text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          </div>
          <select
            value={selectedDepartmentId || ''}
            onChange={(e) => setSelectedDepartmentId(e.target.value || null)}
            className="px-4 py-2 bg-dark-200 border border-dark-100 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">所有部门</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name} ({getAgentCountByDepartment(dept.id)})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-400">加载中...</div>
          </div>
        ) : filteredAgents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <Bot size={64} className="mb-4 opacity-50" />
            <p className="text-lg mb-2">
              {searchQuery ? '没有找到匹配的 AI 员工' : '还没有 AI 员工'}
            </p>
            <p className="text-sm text-gray-500 mb-4">
              {searchQuery ? '尝试其他搜索词' : '创建一个 AI 员工开始协作'}
            </p>
            {!searchQuery && (
              <button
                onClick={() => {
                  setEditingAgent(null)
                  setIsModalOpen(true)
                }}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors"
              >
                创建第一个 AI 员工
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {(selectedDepartmentId ? [{ department: departments.find(d => d.id === selectedDepartmentId) || departments[0], agents: filteredAgents }] : groupedAgents).map((group) => (
              <div key={group.department.id}>
                <div className="flex items-center gap-2 mb-3">
                  <Building size={16} className="text-gray-400" />
                  <h2 className="text-sm font-medium text-gray-300">{group.department.name}</h2>
                  <span className="text-xs text-gray-500">({group.agents.length})</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {group.agents.map((agent) => (
                    <div
                      key={agent.id}
                      className={`bg-dark-300 border rounded-xl p-4 hover:border-primary-500/50 transition-colors ${
                        isSelectionMode
                          ? selectedAgents.has(agent.id)
                            ? 'border-primary-500 bg-primary-500/10'
                            : 'border-dark-100'
                          : 'border-dark-100'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {isSelectionMode && (
                          <input
                            type="checkbox"
                            checked={selectedAgents.has(agent.id)}
                            onChange={() => toggleAgentSelection(agent.id)}
                            className="mt-3 w-5 h-5 rounded border-gray-500 text-primary-600 focus:ring-primary-500 bg-dark-200"
                          />
                        )}
                        <div className="relative">
                          {agent.avatar ? (
                            agent.avatar.startsWith('http') ? (
                              <img src={agent.avatar} alt={agent.name} className="w-12 h-12 rounded-full object-cover" />
                            ) : (
                              <div className="w-12 h-12 rounded-full bg-secondary-600 flex items-center justify-center text-2xl">
                                {agent.avatar}
                              </div>
                            )
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-secondary-600 flex items-center justify-center text-white font-medium text-lg">
                              {agent.name.charAt(0)}
                            </div>
                          )}
                          <span className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-dark-300 ${
                            agent.status === 'idle' ? 'bg-green-500' : agent.status === 'thinking' ? 'bg-yellow-500' : agent.status === 'working' ? 'bg-blue-500' : 'bg-red-500'
                          }`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-white truncate">{agent.name}</h3>
                          <p className="text-sm text-gray-400 truncate">{agent.role}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className={`px-2 py-0.5 text-xs rounded-full ${
                              agent.status === 'idle' ? 'bg-green-500/20 text-green-400' : agent.status === 'thinking' ? 'bg-yellow-500/20 text-yellow-400' : agent.status === 'working' ? 'bg-blue-500/20 text-blue-400' : 'bg-red-500/20 text-red-400'
                            }`}>
                              {agent.status === 'idle' ? '空闲' : agent.status === 'thinking' ? '思考中' : agent.status === 'working' ? '工作中' : '错误'}
                            </span>
                          </div>
                        </div>
                        {!isSelectionMode && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleEditAgent(agent)}
                              className="px-3 py-1 text-xs text-gray-400 hover:text-white hover:bg-dark-100 rounded-lg transition-colors"
                            >
                              编辑
                            </button>
                            <button
                              onClick={() => handleDeleteAgent(agent)}
                              className="px-3 py-1 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="mt-4 pt-4 border-t border-dark-100">
                        <p className="text-xs text-gray-500 line-clamp-2">
                          {agent.systemPrompt?.slice(0, 100)}...
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AgentModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setEditingAgent(null)
        }}
        agent={editingAgent}
      />
    </div>
  )
}