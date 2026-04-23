import React, { useState, useEffect } from 'react'
import { Clock, History, RotateCcw, FileText, Users, AlertTriangle } from 'lucide-react'
import { useAgentStore } from '@/stores'

interface ConfigVersion {
  id: string
  entity_type: string
  entity_id: string
  config_type: string
  old_value: any
  new_value: any
  created_at: string
}

interface AuditLogEntry {
  id: string
  action: string
  entity_type: string
  entity_id: string
  user_id: string
  details: any
  timestamp: string
}

export const ConfigVersionPage: React.FC = () => {
  const { agents } = useAgentStore()
  const [selectedEntity, setSelectedEntity] = useState<string>('')
  const [entityType, setEntityType] = useState<'agent' | 'project_group'>('agent')
  const [configVersions, setConfigVersions] = useState<ConfigVersion[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([])
  const [selectedVersion, setSelectedVersion] = useState<ConfigVersion | null>(null)
  const [comparingVersion, setComparingVersion] = useState<ConfigVersion | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (agents.length > 0 && !selectedEntity) {
      setSelectedEntity(agents[0].id)
    }
  }, [agents])

  useEffect(() => {
    if (selectedEntity) {
      fetchConfigVersions()
      fetchAuditLogs()
    }
  }, [selectedEntity, entityType])

  const fetchConfigVersions = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/v1/config-versions/${entityType}/${selectedEntity}`)
      if (response.ok) {
        const data = await response.json()
        setConfigVersions(data)
      }
    } catch (error) {
      console.error('Failed to fetch config versions:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchAuditLogs = async () => {
    // Mock audit logs for now
    const mockLogs: AuditLogEntry[] = [
      {
        id: '1',
        action: 'updated',
        entity_type: 'agent',
        entity_id: selectedEntity,
        user_id: 'user-1',
        details: { field: 'system_prompt', old_value: 'Old prompt', new_value: 'New prompt' },
        timestamp: new Date(Date.now() - 3600000).toISOString()
      },
      {
        id: '2',
        action: 'created',
        entity_type: 'agent',
        entity_id: selectedEntity,
        user_id: 'user-1',
        details: { name: 'New Agent' },
        timestamp: new Date(Date.now() - 7200000).toISOString()
      }
    ]
    setAuditLogs(mockLogs)
  }

  const handleRollback = async (version: ConfigVersion) => {
    if (window.confirm('确定要回滚到这个版本吗？')) {
      try {
        const response = await fetch(`/api/v1/config-versions/${version.id}/rollback`, {
          method: 'POST'
        })
        if (response.ok) {
          alert('回滚成功')
          fetchConfigVersions()
        } else {
          alert('回滚失败')
        }
      } catch (error) {
        console.error('Failed to rollback:', error)
        alert('回滚失败')
      }
    }
  }

  const getEntityName = (id: string): string => {
    if (entityType === 'agent') {
      const agent = agents.find(a => a.id === id)
      return agent?.name || `Agent ${id.substring(0, 8)}`
    }
    return `Project Group ${id.substring(0, 8)}`
  }

  const getConfigTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      system_prompt: '系统提示词',
      model_config: '模型配置',
      tools: '工具列表',
      config: '配置'
    }
    return labels[type] || type
  }

  const getActionLabel = (action: string): string => {
    const labels: Record<string, string> = {
      created: '创建',
      updated: '更新',
      deleted: '删除',
      rollback: '回滚'
    }
    return labels[action] || action
  }

  const formatValue = (value: any): string => {
    if (typeof value === 'object' && value !== null) {
      return JSON.stringify(value, null, 2)
    }
    return String(value)
  }

  const compareVersions = (v1: ConfigVersion, v2: ConfigVersion) => {
    setSelectedVersion(v1)
    setComparingVersion(v2)
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">配置版本控制</h1>
          <p className="text-gray-400">查看和管理配置变更历史</p>
        </div>
      </div>

      {/* Entity selector */}
      <div className="flex gap-4 mb-6">
        <div className="flex gap-2">
          <button
            onClick={() => setEntityType('agent')}
            className={`px-3 py-1.5 rounded-md text-sm ${entityType === 'agent' ? 'bg-primary-600 text-white' : 'bg-dark-200 text-gray-400'}`}
          >
            AI 员工
          </button>
          <button
            onClick={() => setEntityType('project_group')}
            className={`px-3 py-1.5 rounded-md text-sm ${entityType === 'project_group' ? 'bg-primary-600 text-white' : 'bg-dark-200 text-gray-400'}`}
          >
            项目组
          </button>
        </div>
        
        <div className="flex-1">
          <select
            value={selectedEntity}
            onChange={(e) => setSelectedEntity(e.target.value)}
            className="w-full px-3 py-2 bg-dark-200 border border-dark-100 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {entityType === 'agent' ? (
              agents.map(agent => (
                <option key={agent.id} value={agent.id}>
                  {agent.name} ({agent.role})
                </option>
              ))
            ) : (
              <option value="">选择项目组</option>
            )}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Config Versions */}
        <div className="lg:col-span-2">
          <div className="bg-dark-300 rounded-xl p-4 border border-dark-100">
            <div className="flex items-center gap-2 mb-4">
              <History size={20} className="text-primary-400" />
              <h3 className="text-lg font-medium text-white">配置变更历史</h3>
            </div>
            
            {isLoading ? (
              <div className="text-gray-400">加载中...</div>
            ) : configVersions.length === 0 ? (
              <div className="text-gray-400">暂无配置变更记录</div>
            ) : (
              <div className="space-y-3">
                {configVersions.map((version) => (
                  <div
                    key={version.id}
                    className="p-3 bg-dark-200 rounded-lg border border-dark-100 hover:border-primary-500 transition-colors cursor-pointer"
                    onClick={() => setSelectedVersion(version)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <FileText size={16} className="text-primary-400" />
                        <span className="text-sm font-medium text-white">
                          {getConfigTypeLabel(version.config_type)}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {new Date(version.created_at).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400 mb-2">
                      变更内容: {formatValue(version.old_value).substring(0, 100)}... → {formatValue(version.new_value).substring(0, 100)}...
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRollback(version)
                        }}
                        className="text-xs text-primary-400 hover:text-primary-300 flex items-center gap-1"
                      >
                        <RotateCcw size={14} />
                        回滚
                      </button>
                      {selectedVersion && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            compareVersions(selectedVersion, version)
                          }}
                          className="text-xs text-secondary-400 hover:text-secondary-300 flex items-center gap-1"
                        >
                          <FileText size={14} />
                          对比
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Audit Logs */}
        <div>
          <div className="bg-dark-300 rounded-xl p-4 border border-dark-100">
            <div className="flex items-center gap-2 mb-4">
              <Clock size={20} className="text-secondary-400" />
              <h3 className="text-lg font-medium text-white">审计日志</h3>
            </div>
            
            <div className="space-y-3">
              {auditLogs.map((log) => (
                <div key={log.id} className="p-3 bg-dark-200 rounded-lg border border-dark-100">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={16} className="text-yellow-400" />
                      <span className="text-sm font-medium text-white">
                        {getActionLabel(log.action)}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400">
                    {JSON.stringify(log.details, null, 2)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Version Comparison */}
      {(selectedVersion && comparingVersion) && (
        <div className="mt-6 bg-dark-300 rounded-xl p-4 border border-dark-100">
          <div className="flex items-center gap-2 mb-4">
            <FileText size={20} className="text-primary-400" />
            <h3 className="text-lg font-medium text-white">版本对比</h3>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm font-medium text-white mb-2">版本 1</div>
              <div className="p-3 bg-dark-200 rounded-lg border border-dark-100">
                <pre className="text-xs text-gray-300 whitespace-pre-wrap">
                  {formatValue(selectedVersion.old_value)}
                </pre>
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-white mb-2">版本 2</div>
              <div className="p-3 bg-dark-200 rounded-lg border border-dark-100">
                <pre className="text-xs text-gray-300 whitespace-pre-wrap">
                  {formatValue(comparingVersion.old_value)}
                </pre>
              </div>
            </div>
          </div>
          
          <div className="mt-4 flex justify-end">
            <button
              onClick={() => {
                setSelectedVersion(null)
                setComparingVersion(null)
              }}
              className="px-4 py-2 bg-dark-200 hover:bg-dark-100 text-white text-sm rounded-lg"
            >
              关闭对比
            </button>
          </div>
        </div>
      )}

      {/* Selected Version Details */}
      {selectedVersion && !comparingVersion && (
        <div className="mt-6 bg-dark-300 rounded-xl p-4 border border-dark-100">
          <div className="flex items-center gap-2 mb-4">
            <FileText size={20} className="text-primary-400" />
            <h3 className="text-lg font-medium text-white">版本详情</h3>
          </div>
          
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm font-medium text-gray-400 mb-1">配置类型</div>
                <div className="text-white">{getConfigTypeLabel(selectedVersion.config_type)}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-400 mb-1">变更时间</div>
                <div className="text-white">{new Date(selectedVersion.created_at).toLocaleString()}</div>
              </div>
            </div>
            
            <div>
              <div className="text-sm font-medium text-gray-400 mb-1">旧值</div>
              <div className="p-3 bg-dark-200 rounded-lg border border-dark-100">
                <pre className="text-xs text-gray-300 whitespace-pre-wrap">
                  {formatValue(selectedVersion.old_value)}
                </pre>
              </div>
            </div>
            
            <div>
              <div className="text-sm font-medium text-gray-400 mb-1">新值</div>
              <div className="p-3 bg-dark-200 rounded-lg border border-dark-100">
                <pre className="text-xs text-gray-300 whitespace-pre-wrap">
                  {formatValue(selectedVersion.new_value)}
                </pre>
              </div>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => handleRollback(selectedVersion)}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm rounded-lg flex items-center gap-1"
              >
                <RotateCcw size={16} />
                回滚到此版本
              </button>
              <button
                onClick={() => setSelectedVersion(null)}
                className="px-4 py-2 bg-dark-200 hover:bg-dark-100 text-white text-sm rounded-lg"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}