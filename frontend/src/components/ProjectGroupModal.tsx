import React, { useState, useEffect } from 'react'
import { X, Users, Bot, Check, Search, Edit } from 'lucide-react'
import { useProjectGroupStore, ProjectGroup } from '@/stores/projectGroup'
import { useAgentStore, Agent } from '@/stores'

interface ProjectGroupModalProps {
  isOpen: boolean
  onClose: () => void
  projectGroup?: ProjectGroup | null
}

export const ProjectGroupModal: React.FC<ProjectGroupModalProps> = ({
  isOpen,
  onClose,
  projectGroup,
}) => {
  const { createGroup, updateGroup } = useProjectGroupStore()
  const { agents, fetchAgents } = useAgentStore()

  const [step, setStep] = useState(1)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [supervisorId, setSupervisorId] = useState('')
  const [selectedMembers, setSelectedMembers] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (isOpen) {
      fetchAgents()
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) {
      resetForm()
    } else if (projectGroup) {
      setStep(1)
      setName(projectGroup.name)
      setDescription(projectGroup.description || '')
      setSupervisorId(projectGroup.supervisorId)
      setSelectedMembers(projectGroup.members?.map(member => member.agentId) || [])
    }
  }, [isOpen, projectGroup])

  const resetForm = () => {
    setStep(1)
    setName('')
    setDescription('')
    setSupervisorId('')
    setSelectedMembers([])
    setSearchQuery('')
  }

  const filteredAgents = agents.filter(
    (agent) =>
      agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.role.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const toggleMember = (agentId: string) => {
    if (selectedMembers.includes(agentId)) {
      setSelectedMembers(selectedMembers.filter((id) => id !== agentId))
    } else {
      setSelectedMembers([...selectedMembers, agentId])
    }
  }

  const handleSubmit = async () => {
    if (!name.trim() || !supervisorId) {
      return
    }

    const allMemberIds = [
      supervisorId,
      ...selectedMembers.filter((id) => id !== supervisorId),
    ]

    setIsSubmitting(true)
    
    try {
      let result
      if (projectGroup) {
        result = await updateGroup(projectGroup.id, {
          name: name.trim(),
          description: description.trim() || undefined,
          supervisorId,
        })
      } else {
        result = await createGroup({
          name: name.trim(),
          description: description.trim() || undefined,
          workspaceId: '00000000-0000-0000-0000-000000000001',
          supervisorId,
          memberAgentIds: allMemberIds,
        })
      }

      if (result) {
        onClose()
      } else {
        alert('创建项目组失败，请重试')
      }
    } catch (error) {
      console.error('创建项目组失败:', error)
      alert('创建项目组失败，请重试')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-dark-300 rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden border border-dark-100">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-dark-100">
          <div className="flex items-center gap-2">
            <Users size={20} className="text-secondary-400" />
            <h2 className="text-lg font-semibold text-white">{projectGroup ? '编辑项目组' : '创建项目组'}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-dark-100 rounded-lg transition-colors"
          >
            <X size={18} className="text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {/* Step 1: Basic info */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  项目组名称 <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="例如：Q1 财报分析团队"
                  className="w-full px-3 py-2 bg-dark-200 border border-dark-100 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  描述
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="描述这个项目组的目标和职责..."
                  rows={3}
                  className="w-full px-3 py-2 bg-dark-200 border border-dark-100 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  选择群主（Supervisor） <span className="text-red-400">*</span>
                </label>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {agents.map((agent) => (
                    <label
                      key={agent.id}
                      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                        supervisorId === agent.id
                          ? 'bg-primary-600/20 border border-primary-500'
                          : 'bg-dark-200 border border-transparent hover:bg-dark-100'
                      }`}
                    >
                      <input
                        type="radio"
                        name="supervisor"
                        value={agent.id}
                        checked={supervisorId === agent.id}
                        onChange={() => setSupervisorId(agent.id)}
                        className="w-4 h-4 text-primary-600"
                      />
                      {agent.avatar && agent.avatar.startsWith('http') ? (
                        <img
                          src={agent.avatar}
                          alt={agent.name}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 bg-secondary-600 rounded-full flex items-center justify-center text-lg">
                          {agent.avatar || <Bot size={16} className="text-white" />}
                        </div>
                      )}
                      <div>
                        <div className="text-sm font-medium text-white">{agent.name}</div>
                        <div className="text-xs text-gray-500">{agent.role}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Select members */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-400">
                  选择团队成员
                </label>
                <span className="text-xs text-gray-500">
                  已选择 {selectedMembers.length} 位成员
                </span>
              </div>

              {/* Search */}
              <div className="relative">
                <Search
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜索 AI 员工..."
                  className="w-full pl-10 pr-4 py-2 bg-dark-200 border border-dark-100 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {/* Members list */}
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {filteredAgents.map((agent) => (
                  <label
                    key={agent.id}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                      selectedMembers.includes(agent.id)
                        ? 'bg-primary-600/20 border border-primary-500'
                        : 'bg-dark-200 border border-transparent hover:bg-dark-100'
                    }`}
                  >
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={selectedMembers.includes(agent.id)}
                        onChange={() => toggleMember(agent.id)}
                        className="w-4 h-4 text-primary-600"
                      />
                      {agent.id === supervisorId && (
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-500 rounded-full border border-dark-300" />
                      )}
                    </div>
                    {agent.avatar && agent.avatar.startsWith('http') ? (
                      <img
                        src={agent.avatar}
                        alt={agent.name}
                        className="w-8 h-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-8 h-8 bg-secondary-600 rounded-full flex items-center justify-center text-lg">
                        {agent.avatar || <Bot size={16} className="text-white" />}
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">{agent.name}</span>
                        {agent.id === supervisorId && (
                          <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full">
                            群主
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">{agent.role}</div>
                    </div>
                    {selectedMembers.includes(agent.id) && (
                      <Check size={16} className="text-primary-400" />
                    )}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-dark-100 bg-dark-200/50">
          <button
            onClick={() => setStep(Math.max(1, step - 1))}
            disabled={step === 1}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white disabled:opacity-0"
          >
            ← 上一步
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white mr-2"
            >
              取消
            </button>
            {step < 2 ? (
              <button
                onClick={() => setStep(2)}
                disabled={!name.trim() || !supervisorId}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                下一步 →
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (projectGroup ? '保存中...' : '创建中...') : (projectGroup ? '保存修改' : '创建项目组')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
