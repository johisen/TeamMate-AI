import React, { useState } from 'react'
import { useWorkspaceStore } from '@/stores'

export const WorkspaceSelector: React.FC = () => {
  const { workspaces, currentWorkspace, selectWorkspace, createWorkspace } = useWorkspaceStore()
  const [isCreating, setIsCreating] = useState(false)
  const [newName, setNewName] = useState('')

  const handleCreate = async () => {
    if (!newName.trim()) return

    const workspace = await createWorkspace({ name: newName.trim() })
    if (workspace) {
      selectWorkspace(workspace)
      setNewName('')
      setIsCreating(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={currentWorkspace?.id || ''}
        onChange={(e) => {
          const ws = workspaces.find((w) => w.id === e.target.value)
          if (ws) selectWorkspace(ws)
        }}
        className="bg-dark-200 border border-dark-100 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
      >
        <option value="">选择工作空间</option>
        {workspaces.map((ws) => (
          <option key={ws.id} value={ws.id}>
            {ws.name}
          </option>
        ))}
      </select>

      {isCreating ? (
        <div className="flex gap-1">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="工作空间名称"
            className="bg-dark-200 border border-dark-100 rounded-lg px-2 py-1 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            autoFocus
          />
          <button
            onClick={handleCreate}
            className="px-2 py-1 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700"
          >
            创建
          </button>
          <button
            onClick={() => {
              setIsCreating(false)
              setNewName('')
            }}
            className="px-2 py-1 text-gray-400 text-sm hover:text-white"
          >
            取消
          </button>
        </div>
      ) : (
        <button
          onClick={() => setIsCreating(true)}
          className="px-2 py-1 text-xs text-gray-400 hover:text-white border border-dark-100 rounded-lg hover:border-gray-500"
        >
          + 新建
        </button>
      )}
    </div>
  )
}
