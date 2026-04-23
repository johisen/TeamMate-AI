import React, { useState, useEffect } from 'react'
import { Building2, Users, Plus, Settings, Trash2, Shield, Lock } from 'lucide-react'

interface Workspace {
  id: string
  name: string
  description: string
  owner_id: string
  is_active: boolean
  created_at: string
  updated_at: string
}

interface WorkspaceMember {
  id: string
  workspace_id: string
  user_id: string
  role: string
  joined_at: string
  user_email: string
  user_name: string
}

export const WorkspaceSettingsPage: React.FC = () => {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null)
  const [members, setMembers] = useState<WorkspaceMember[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'general' | 'members' | 'permissions'>('general')

  useEffect(() => {
    fetchWorkspaces()
  }, [])

  const fetchWorkspaces = async () => {
    try {
      const response = await fetch('/api/v1/workspaces')
      if (response.ok) {
        const data = await response.json()
        setWorkspaces(data)
        if (data.length > 0 && !selectedWorkspace) {
          setSelectedWorkspace(data[0])
          fetchMembers(data[0].id)
        }
      }
    } catch (error) {
      console.error('Failed to fetch workspaces:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchMembers = async (workspaceId: string) => {
    try {
      const response = await fetch(`/api/v1/workspaces/${workspaceId}/members`)
      if (response.ok) {
        const data = await response.json()
        setMembers(data)
      }
    } catch (error) {
      console.error('Failed to fetch members:', error)
    }
  }

  const handleCreateWorkspace = async () => {
    const name = prompt('输入工作区名称:')
    if (!name) return

    try {
      const response = await fetch('/api/v1/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description: '' })
      })
      if (response.ok) {
        const newWorkspace = await response.json()
        setWorkspaces([...workspaces, newWorkspace])
        setSelectedWorkspace(newWorkspace)
      }
    } catch (error) {
      console.error('Failed to create workspace:', error)
    }
  }

  const handleUpdateWorkspace = async (updates: Partial<Workspace>) => {
    if (!selectedWorkspace) return

    try {
      const response = await fetch(`/api/v1/workspaces/${selectedWorkspace.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      })
      if (response.ok) {
        const updated = await response.json()
        setSelectedWorkspace(updated)
        setWorkspaces(workspaces.map(w => w.id === updated.id ? updated : w))
      }
    } catch (error) {
      console.error('Failed to update workspace:', error)
    }
  }

  const handleDeleteWorkspace = async (workspaceId: string) => {
    if (!confirm('确定要删除此工作区吗？此操作不可撤销。')) return

    try {
      const response = await fetch(`/api/v1/workspaces/${workspaceId}`, {
        method: 'DELETE'
      })
      if (response.ok) {
        setWorkspaces(workspaces.filter(w => w.id !== workspaceId))
        if (selectedWorkspace?.id === workspaceId) {
          setSelectedWorkspace(workspaces[0] || null)
        }
      }
    } catch (error) {
      console.error('Failed to delete workspace:', error)
    }
  }

  const handleUpdateMemberRole = async (memberId: string, newRole: string) => {
    if (!selectedWorkspace) return

    try {
      const response = await fetch(
        `/api/v1/workspaces/${selectedWorkspace.id}/members/${memberId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: newRole })
        }
      )
      if (response.ok) {
        setMembers(members.map(m => m.id === memberId ? { ...m, role: newRole } : m))
      }
    } catch (error) {
      console.error('Failed to update member role:', error)
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    if (!selectedWorkspace) return
    if (!confirm('确定要移除此成员吗？')) return

    try {
      const response = await fetch(
        `/api/v1/workspaces/${selectedWorkspace.id}/members/${memberId}`,
        { method: 'DELETE' }
      )
      if (response.ok) {
        setMembers(members.filter(m => m.id !== memberId))
      }
    } catch (error) {
      console.error('Failed to remove member:', error)
    }
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'owner': return 'bg-yellow-600'
      case 'admin': return 'bg-red-600'
      case 'member': return 'bg-blue-600'
      case 'readonly': return 'bg-gray-600'
      default: return 'bg-gray-600'
    }
  }

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'owner': return '所有者'
      case 'admin': return '管理员'
      case 'member': return '成员'
      case 'readonly': return '只读'
      default: return role
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-400">加载中...</div>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      {/* Sidebar - Workspace list */}
      <div className="w-72 bg-dark-300 border-r border-dark-100 flex flex-col">
        <div className="p-4 border-b border-dark-100">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Building2 size={20} className="text-primary-400" />
              <span className="font-semibold text-white">工作区</span>
            </div>
            <button
              onClick={handleCreateWorkspace}
              className="p-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {workspaces.map(workspace => (
            <div
              key={workspace.id}
              onClick={() => {
                setSelectedWorkspace(workspace)
                fetchMembers(workspace.id)
              }}
              className={`p-3 rounded-xl cursor-pointer transition-all mb-1 ${
                selectedWorkspace?.id === workspace.id
                  ? 'bg-primary-600/20 border border-primary-500'
                  : 'hover:bg-dark-100 border border-transparent'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-white">{workspace.name}</div>
                  <div className="text-xs text-gray-400">
                    {workspace.is_active ? '活跃' : '未激活'}
                  </div>
                </div>
                {workspace.owner_id && (
                  <span className={`px-2 py-0.5 text-xs rounded-full text-white ${getRoleBadgeColor('owner')}`}>
                    所有者
                  </span>
                )}
              </div>
            </div>
          ))}

          {workspaces.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-gray-400">
              <Building2 size={40} className="mb-3 opacity-50" />
              <p className="text-sm">暂无工作区</p>
              <button
                onClick={handleCreateWorkspace}
                className="mt-3 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm rounded-lg"
              >
                创建第一个工作区
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {selectedWorkspace ? (
          <>
            {/* Header */}
            <div className="px-6 py-4 border-b border-dark-100 bg-dark-300">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-semibold text-white">{selectedWorkspace.name}</h1>
                  <p className="text-sm text-gray-400">{selectedWorkspace.description || '暂无描述'}</p>
                </div>
                <button
                  onClick={() => handleDeleteWorkspace(selectedWorkspace.id)}
                  className="p-2 text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
                >
                  <Trash2 size={18} />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex gap-4 mt-4">
                <button
                  onClick={() => setActiveTab('general')}
                  className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'general'
                      ? 'text-primary-400 border-primary-400'
                      : 'text-gray-400 border-transparent hover:text-white'
                  }`}
                >
                  常规设置
                </button>
                <button
                  onClick={() => setActiveTab('members')}
                  className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'members'
                      ? 'text-primary-400 border-primary-400'
                      : 'text-gray-400 border-transparent hover:text-white'
                  }`}
                >
                  成员管理
                </button>
                <button
                  onClick={() => setActiveTab('permissions')}
                  className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'permissions'
                      ? 'text-primary-400 border-primary-400'
                      : 'text-gray-400 border-transparent hover:text-white'
                  }`}
                >
                  权限设置
                </button>
              </div>
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto p-6">
              {activeTab === 'general' && (
                <div className="space-y-6">
                  <div className="bg-dark-300 rounded-xl p-4 border border-dark-100">
                    <h3 className="text-lg font-medium text-white mb-4">基本信息</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">
                          工作区名称
                        </label>
                        <input
                          type="text"
                          value={selectedWorkspace.name}
                          onChange={(e) => handleUpdateWorkspace({ name: e.target.value })}
                          className="w-full px-3 py-2 bg-dark-200 border border-dark-100 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">
                          描述
                        </label>
                        <textarea
                          value={selectedWorkspace.description || ''}
                          onChange={(e) => handleUpdateWorkspace({ description: e.target.value })}
                          rows={3}
                          className="w-full px-3 py-2 bg-dark-200 border border-dark-100 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'members' && (
                <div className="bg-dark-300 rounded-xl p-4 border border-dark-100">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-white">成员列表</h3>
                    <button className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-sm rounded-lg flex items-center gap-1">
                      <Plus size={14} />
                      添加成员
                    </button>
                  </div>

                  <div className="space-y-2">
                    {members.map(member => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between p-3 bg-dark-200 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-secondary-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                            {member.user_name?.charAt(0) || member.user_email?.charAt(0) || '?'}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-white">
                              {member.user_name || '未知用户'}
                            </div>
                            <div className="text-xs text-gray-400">{member.user_email}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <select
                            value={member.role}
                            onChange={(e) => handleUpdateMemberRole(member.id, e.target.value)}
                            className="px-2 py-1 bg-dark-100 border border-dark-100 rounded text-sm text-white"
                          >
                            <option value="admin">管理员</option>
                            <option value="member">成员</option>
                            <option value="readonly">只读</option>
                          </select>
                          <button
                            onClick={() => handleRemoveMember(member.id)}
                            className="p-1.5 text-red-400 hover:bg-red-900/20 rounded"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}

                    {members.length === 0 && (
                      <div className="text-center py-8 text-gray-400">
                        <Users size={40} className="mx-auto mb-3 opacity-50" />
                        <p className="text-sm">暂无成员</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'permissions' && (
                <div className="space-y-6">
                  <div className="bg-dark-300 rounded-xl p-4 border border-dark-100">
                    <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                      <Shield size={20} className="text-primary-400" />
                      权限说明
                    </h3>
                    <div className="space-y-3">
                      <div className="p-3 bg-dark-200 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-600 text-white">所有者</span>
                        </div>
                        <p className="text-sm text-gray-400">
                          拥有工作区的完全控制权，包括删除工作区、转让所有权等
                        </p>
                      </div>
                      <div className="p-3 bg-dark-200 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="px-2 py-0.5 text-xs rounded-full bg-red-600 text-white">管理员</span>
                        </div>
                        <p className="text-sm text-gray-400">
                          可以管理成员、配置工作区设置、创建和管理 AI 员工等
                        </p>
                      </div>
                      <div className="p-3 bg-dark-200 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="px-2 py-0.5 text-xs rounded-full bg-blue-600 text-white">成员</span>
                        </div>
                        <p className="text-sm text-gray-400">
                          可以使用工作区内的 AI 员工和知识库，但不能管理成员和配置
                        </p>
                      </div>
                      <div className="p-3 bg-dark-200 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="px-2 py-0.5 text-xs rounded-full bg-gray-600 text-white">只读</span>
                        </div>
                        <p className="text-sm text-gray-400">
                          只能查看工作区内容，不能进行任何修改操作
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
            <Building2 size={64} className="mb-4 opacity-50" />
            <h2 className="text-xl font-semibold text-white mb-2">选择工作区</h2>
            <p>请从左侧选择一个工作区进行管理</p>
          </div>
        )}
      </div>
    </div>
  )
}
