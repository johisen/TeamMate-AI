import React from 'react'
import { ChevronDown, Plus, Settings } from 'lucide-react'
import { useWorkspaceStore, Workspace } from '@/stores'
import { useAgentStore } from '@/stores'

interface SidebarProps {
  onCreateAgent: () => void
  onEditAgent?: () => void
}

export const Sidebar: React.FC<SidebarProps> = ({ onCreateAgent, onEditAgent }) => {
  const { workspaces, currentWorkspace, selectWorkspace } = useWorkspaceStore()
  const { agents } = useAgentStore()

  return (
    <div className="w-72 bg-dark-300 border-r border-dark-100 flex flex-col h-full">
      {/* Workspace selector */}
      <div className="p-4 border-b border-dark-100">
        <div className="relative">
          <button className="w-full flex items-center justify-between px-3 py-2 bg-dark-200 rounded-xl text-white hover:bg-dark-100 transition-colors">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-md" />
              <span className="font-medium truncate">
                {currentWorkspace?.name || '选择工作空间'}
              </span>
            </div>
            <ChevronDown size={16} className="text-gray-400" />
          </button>

          {/* Dropdown */}
          {workspaces.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-dark-200 border border-dark-100 rounded-xl shadow-lg z-10 overflow-hidden">
              {workspaces.map((workspace) => (
                <button
                  key={workspace.id}
                  onClick={() => selectWorkspace(workspace)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-dark-100 transition-colors ${
                    currentWorkspace?.id === workspace.id ? 'bg-primary-600/20' : ''
                  }`}
                >
                  <div className="w-5 h-5 bg-gradient-to-br from-primary-500 to-secondary-500 rounded" />
                  <span className="truncate">{workspace.name}</span>
                </button>
              ))}
              <div className="border-t border-dark-100">
                <button className="w-full flex items-center gap-2 px-3 py-2 text-left text-primary-400 hover:bg-dark-100 transition-colors">
                  <Plus size={16} />
                  <span>创建新工作空间</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Agent list */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-dark-100">
          <span className="text-sm font-medium text-gray-400">AI 员工</span>
          <button
            onClick={onCreateAgent}
            className="text-xs text-primary-400 hover:text-primary-300"
          >
            + 添加
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {agents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-gray-400">
              <p className="text-sm">还没有 AI 员工</p>
              <button
                onClick={onCreateAgent}
                className="mt-2 text-sm text-primary-400 hover:text-primary-300"
              >
                创建第一个 AI 员工
              </button>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {agents.map((agent) => (
                <div
                  key={agent.id}
                  className="flex items-center gap-2 p-2 rounded-lg hover:bg-dark-100 cursor-pointer transition-colors"
                >
                  <div className="w-8 h-8 bg-secondary-600 rounded-full flex items-center justify-center text-white text-xs font-medium">
                    {agent.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">
                      {agent.name}
                    </div>
                    <div className="text-xs text-gray-500 truncate">{agent.role}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Settings */}
      <div className="p-4 border-t border-dark-100">
        <button className="w-full flex items-center gap-2 px-3 py-2 text-gray-400 hover:text-white hover:bg-dark-100 rounded-lg transition-colors">
          <Settings size={18} />
          <span className="text-sm">设置</span>
        </button>
      </div>
    </div>
  )
}
