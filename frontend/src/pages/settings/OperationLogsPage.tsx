import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Info,
  AlertTriangle,
  AlertCircle,
  ShieldAlert,
  Trash2,
  Filter,
  Download,
  FileText
} from 'lucide-react'
import { useLogStore, LogLevel, LogEntry } from '@/stores'

const LEVEL_CONFIG = {
  info: {
    icon: Info,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    label: '信息',
  },
  warn: {
    icon: AlertTriangle,
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/30',
    label: '警告',
  },
  error: {
    icon: AlertCircle,
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    label: '错误',
  },
  fatal: {
    icon: ShieldAlert,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
    label: '严重',
  },
}

export const OperationLogsPage: React.FC = () => {
  const navigate = useNavigate()
  const { logs, clearLogs, getFilteredLogs } = useLogStore()

  const [selectedLevels, setSelectedLevels] = useState<LogLevel[]>(['info', 'warn', 'error', 'fatal'])
  const [searchQuery, setSearchQuery] = useState('')

  const toggleLevel = (level: LogLevel) => {
    if (selectedLevels.includes(level)) {
      setSelectedLevels(selectedLevels.filter((l) => l !== level))
    } else {
      setSelectedLevels([...selectedLevels, level])
    }
  }

  const selectAllLevels = () => {
    setSelectedLevels(['info', 'warn', 'error', 'fatal'])
  }

  const filteredLogs = searchQuery
    ? getFilteredLogs(selectedLevels).filter(
        (log) =>
          log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
          log.source?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          log.details?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : getFilteredLogs(selectedLevels)

  const handleExport = () => {
    const logText = filteredLogs
      .map(
        (log) =>
          `[${log.timestamp.toLocaleString()}] [${log.level.toUpperCase()}]${log.source ? ` [${log.source}]` : ''} ${log.message}${log.details ? `\n  Details: ${log.details}` : ''}`
      )
      .join('\n\n')

    const blob = new Blob([logText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `operation-logs-${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const getLevelCounts = () => {
    return {
      info: logs.filter((l) => l.level === 'info').length,
      warn: logs.filter((l) => l.level === 'warn').length,
      error: logs.filter((l) => l.level === 'error').length,
      fatal: logs.filter((l) => l.level === 'fatal').length,
    }
  }

  const levelCounts = getLevelCounts()

  return (
    <div className="h-full bg-dark-400 overflow-y-auto">
      <div className="px-6 py-4 border-b border-dark-100 bg-dark-300 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/settings')}
              className="p-2 hover:bg-dark-200 rounded-lg transition-colors"
            >
              <ArrowLeft size={20} className="text-gray-400" />
            </button>
            <div>
              <h1 className="text-xl font-semibold text-white">操作日志</h1>
              <p className="text-sm text-gray-400">查看系统操作记录</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              disabled={filteredLogs.length === 0}
              className="flex items-center gap-2 px-3 py-1.5 bg-dark-200 hover:bg-dark-100 text-gray-300 text-sm rounded-lg transition-colors disabled:opacity-50"
            >
              <Download size={16} />
              导出
            </button>
            <button
              onClick={() => {
                if (confirm('确定要清空所有日志吗？')) {
                  clearLogs()
                }
              }}
              disabled={logs.length === 0}
              className="flex items-center gap-2 px-3 py-1.5 bg-dark-200 hover:bg-red-500/20 text-red-400 text-sm rounded-lg transition-colors disabled:opacity-50"
            >
              <Trash2 size={16} />
              清空
            </button>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-4">
        <div className="bg-dark-300 rounded-xl border border-dark-100 p-4">
          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-gray-400" />
              <span className="text-sm text-gray-400">筛选级别：</span>
            </div>
            <div className="flex items-center gap-2">
              {(Object.keys(LEVEL_CONFIG) as LogLevel[]).map((level) => {
                const config = LEVEL_CONFIG[level]
                const isSelected = selectedLevels.includes(level)
                return (
                  <button
                    key={level}
                    onClick={() => toggleLevel(level)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      isSelected
                        ? `${config.bgColor} ${config.color} border ${config.borderColor}`
                        : 'bg-dark-200 text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    <config.icon size={14} />
                    {config.label}
                    <span className="ml-1 opacity-70">({levelCounts[level]})</span>
                  </button>
                )
              })}
            </div>
            <button
              onClick={selectAllLevels}
              className="px-3 py-1.5 text-xs text-gray-400 hover:text-white transition-colors"
            >
              全选
            </button>
          </div>

          <div className="relative">
            <FileText size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索日志内容..."
              className="w-full pl-10 pr-4 py-2 bg-dark-200 border border-dark-100 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        <div className="bg-dark-300 rounded-xl border border-dark-100">
          <div className="px-4 py-3 border-b border-dark-100 flex items-center justify-between">
            <span className="text-sm text-gray-400">
              共 {filteredLogs.length} 条日志
            </span>
            {searchQuery && (
              <span className="text-xs text-gray-500">
                搜索结果
              </span>
            )}
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {filteredLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <FileText size={48} className="mb-4 opacity-50" />
                <p className="text-sm">{searchQuery ? '没有找到匹配的日志' : '暂无日志记录'}</p>
              </div>
            ) : (
              <div className="divide-y divide-dark-100">
                {filteredLogs.map((log) => {
                  const config = LEVEL_CONFIG[log.level]
                  return (
                    <div key={log.id} className="p-4 hover:bg-dark-200/30 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 p-1.5 rounded-lg ${config.bgColor}`}>
                          <config.icon size={16} className={config.color} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs font-medium ${config.color}`}>
                              {config.label}
                            </span>
                            {log.source && (
                              <span className="text-xs text-gray-500 px-2 py-0.5 bg-dark-200 rounded">
                                {log.source}
                              </span>
                            )}
                            <span className="text-xs text-gray-500">
                              {log.timestamp.toLocaleString()}
                            </span>
                          </div>
                          <p className="text-sm text-white mb-1">{log.message}</p>
                          {log.details && (
                            <p className="text-xs text-gray-400 bg-dark-200 p-2 rounded mt-1 font-mono">
                              {log.details}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}