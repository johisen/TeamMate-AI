import React, { useState, useEffect } from 'react'
import { Users, Plus, MoreVertical, Bot, Trash2, UserPlus, Edit } from 'lucide-react'
import { useProjectGroupStore, ProjectGroup } from '@/stores/projectGroup'
import { useAgentStore } from '@/stores'
import { ProjectGroupModal } from './ProjectGroupModal'

export const ProjectGroupList: React.FC = () => {
  const { groups, currentGroup, selectGroup, fetchGroups, deleteGroup } = useProjectGroupStore()
  const { agents } = useAgentStore()
  const [onlineCounts, setOnlineCounts] = useState<Record<string, number>>({})
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState<ProjectGroup | null>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  useEffect(() => {
    fetchGroups()
  }, [])

  useEffect(() => {
    const { fetchAgents } = useAgentStore.getState()
    fetchAgents()
  }, [])

  const handleSelectGroup = (group: ProjectGroup) => {
    selectGroup(group)
  }

  const handleEditGroup = (group: ProjectGroup) => {
    setEditingGroup(group)
    setIsEditModalOpen(true)
  }

  const handleDeleteGroup = async (group: ProjectGroup) => {
    if (confirm(`确定要删除项目组 "${group.name}" 吗？此操作不可撤销。`)) {
      await deleteGroup(group.id)
    }
  }

  // Mock online counts for now
  useEffect(() => {
    const mockCounts: Record<string, number> = {}
    groups.forEach(group => {
      mockCounts[group.id] = Math.floor(Math.random() * 3) + 1
    })
    setOnlineCounts(mockCounts)
  }, [groups])

  return (
    <div className="w-72 bg-dark-300 border-r border-dark-100 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-dark-100 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Users size={20} className="text-primary-400" />
          <span className="font-semibold text-white">项目组</span>
        </div>
        {/* 隐藏创建项目组按钮 - 如需显示，删除此注释块 */}
      </div>

      {/* Group list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-gray-400">
            <Users size={40} className="mb-3 opacity-50" />
            <p className="text-sm">暂无项目组</p>
          </div>
        ) : (
          groups.map((group) => {
            const supervisor = agents.find((a) => a.id === group.supervisorId)
            const memberCount = group.members?.length || 0
            const onlineCount = onlineCounts[group.id] || 0

            return (
              <div
                key={group.id}
                className={`p-3 rounded-xl cursor-pointer transition-all ${
                  currentGroup?.id === group.id
                    ? 'bg-primary-600/20 border border-primary-500'
                    : 'hover:bg-dark-100 border border-transparent'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div 
                    className="flex items-center gap-2 flex-1 cursor-pointer"
                    onClick={() => handleSelectGroup(group)}
                  >
                    <div className="relative">
                      {supervisor?.avatar && supervisor.avatar.startsWith('http') ? (
                        <img
                          src={supervisor.avatar}
                          alt={supervisor.name}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 bg-secondary-600 rounded-full flex items-center justify-center text-lg">
                          {supervisor?.avatar || <Bot size={16} className="text-white" />}
                        </div>
                      )}
                      {onlineCount > 0 && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-dark-300 flex items-center justify-center">
                          <span className="text-xs text-white font-bold">{onlineCount}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white truncate">{group.name}</div>
                      <div className="text-xs text-gray-500 truncate">
                        {memberCount} 位成员 · 群主: {supervisor?.name || '未知'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    <button 
                      onClick={() => handleEditGroup(group)}
                      className="p-1 hover:bg-dark-200 rounded transition-colors text-gray-400 hover:text-white"
                    >
                      <Edit size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Edit project group modal */}
      <ProjectGroupModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        projectGroup={editingGroup}
      />

      {/* Create project group modal */}
      <ProjectGroupModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        projectGroup={null}
      />
    </div>
  )
}
