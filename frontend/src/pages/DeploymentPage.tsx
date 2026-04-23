import React, { useState } from 'react'
import { Server, Download, Play, Pause, RefreshCw, CheckCircle, XCircle, Database, Cloud, HardDrive } from 'lucide-react'

interface DeploymentStatus {
  backend: 'running' | 'stopped' | 'error'
  frontend: 'running' | 'stopped' | 'error'
  postgres: 'running' | 'stopped' | 'error'
  redis: 'running' | 'stopped' | 'error'
  qdrant: 'running' | 'stopped' | 'error'
}

export const DeploymentPage: React.FC = () => {
  const [deploymentStatus, setDeploymentStatus] = useState<DeploymentStatus>({
    backend: 'stopped',
    frontend: 'stopped',
    postgres: 'stopped',
    redis: 'stopped',
    qdrant: 'stopped',
  })
  const [isDeploying, setIsDeploying] = useState(false)
  const [deploymentLog, setDeploymentLog] = useState<string[]>([])

  const handleDeploy = async () => {
    setIsDeploying(true)
    setDeploymentLog(['开始部署...', '正在拉取 Docker 镜像...', '正在启动容器...'])

    await new Promise(resolve => setTimeout(resolve, 2000))

    setDeploymentStatus({
      backend: 'running',
      frontend: 'running',
      postgres: 'running',
      redis: 'running',
      qdrant: 'running',
    })

    setDeploymentLog(prev => [...prev, '所有服务启动成功！'])

    setIsDeploying(false)
  }

  const handleStop = async () => {
    setIsDeploying(true)
    setDeploymentLog(['正在停止服务...', '所有服务已停止'])

    setDeploymentStatus({
      backend: 'stopped',
      frontend: 'stopped',
      postgres: 'stopped',
      redis: 'stopped',
      qdrant: 'stopped',
    })

    setIsDeploying(false)
  }

  const handleRestart = async () => {
    setIsDeploying(true)
    setDeploymentLog(['正在重启服务...', '所有服务已重启'])
    setIsDeploying(false)
  }

  const getServiceIcon = (service: keyof DeploymentStatus) => {
    switch (service) {
      case 'backend':
      case 'frontend':
        return <Server size={20} />
      case 'postgres':
        return <Database size={20} />
      case 'redis':
        return <HardDrive size={20} />
      case 'qdrant':
        return <Cloud size={20} />
      default:
        return <Server size={20} />
    }
  }

  const getStatusColor = (status: DeploymentStatus[keyof DeploymentStatus]) => {
    switch (status) {
      case 'running':
        return 'text-green-400'
      case 'stopped':
        return 'text-gray-400'
      case 'error':
        return 'text-red-400'
      default:
        return 'text-gray-400'
    }
  }

  const getStatusIcon = (status: DeploymentStatus[keyof DeploymentStatus]) => {
    switch (status) {
      case 'running':
        return <CheckCircle size={16} className="text-green-400" />
      case 'stopped':
        return <Pause size={16} className="text-gray-400" />
      case 'error':
        return <XCircle size={16} className="text-red-400" />
      default:
        return <Pause size={16} className="text-gray-400" />
    }
  }

  const isAllRunning = Object.values(deploymentStatus).every(s => s === 'running')

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">部署管理</h1>
          <p className="text-gray-400">一键部署和管理 TeamMateAI 服务</p>
        </div>
      </div>

      {/* Service Status */}
      <div className="bg-dark-300 rounded-xl p-6 border border-dark-100 mb-6">
        <h3 className="text-lg font-medium text-white mb-4">服务状态</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {Object.entries(deploymentStatus).map(([service, status]) => (
            <div
              key={service}
              className="bg-dark-200 rounded-lg p-4 border border-dark-100"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className={getStatusColor(status)}>{getServiceIcon(service as keyof DeploymentStatus)}</span>
                <span className="text-sm font-medium text-white capitalize">{service}</span>
              </div>
              <div className="flex items-center gap-1">
                {getStatusIcon(status)}
                <span className={`text-xs capitalize ${getStatusColor(status)}`}>{status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Deployment Actions */}
      <div className="bg-dark-300 rounded-xl p-6 border border-dark-100 mb-6">
        <h3 className="text-lg font-medium text-white mb-4">部署控制</h3>
        <div className="flex gap-3">
          <button
            onClick={handleDeploy}
            disabled={isDeploying || isAllRunning}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Play size={18} />
            启动所有服务
          </button>
          <button
            onClick={handleStop}
            disabled={isDeploying || !isAllRunning}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Pause size={18} />
            停止所有服务
          </button>
          <button
            onClick={handleRestart}
            disabled={isDeploying}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw size={18} />
            重启服务
          </button>
        </div>
      </div>

      {/* Deployment Log */}
      <div className="bg-dark-300 rounded-xl p-6 border border-dark-100 mb-6">
        <h3 className="text-lg font-medium text-white mb-4">部署日志</h3>
        <div className="bg-dark-200 rounded-lg p-4 h-48 overflow-y-auto font-mono text-sm">
          {deploymentLog.length === 0 ? (
            <div className="text-gray-500">暂无日志</div>
          ) : (
            deploymentLog.map((log, index) => (
              <div key={index} className="text-gray-300 mb-1">
                <span className="text-gray-500">[{new Date().toLocaleTimeString()}]</span> {log}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Quick Commands */}
      <div className="bg-dark-300 rounded-xl p-6 border border-dark-100">
        <h3 className="text-lg font-medium text-white mb-4">常用命令</h3>
        <div className="space-y-3">
          <div className="bg-dark-200 rounded-lg p-3 font-mono text-sm">
            <div className="text-gray-500 mb-1"># 启动所有服务</div>
            <code className="text-green-400">docker-compose up -d</code>
          </div>
          <div className="bg-dark-200 rounded-lg p-3 font-mono text-sm">
            <div className="text-gray-500 mb-1"># 查看服务状态</div>
            <code className="text-green-400">docker-compose ps</code>
          </div>
          <div className="bg-dark-200 rounded-lg p-3 font-mono text-sm">
            <div className="text-gray-500 mb-1"># 查看日志</div>
            <code className="text-green-400">docker-compose logs -f</code>
          </div>
          <div className="bg-dark-200 rounded-lg p-3 font-mono text-sm">
            <div className="text-gray-500 mb-1"># 停止所有服务</div>
            <code className="text-green-400">docker-compose down</code>
          </div>
        </div>
      </div>

      {/* System Requirements */}
      <div className="bg-dark-300 rounded-xl p-6 border border-dark-100 mt-6">
        <h3 className="text-lg font-medium text-white mb-4">系统要求</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-dark-200 rounded-lg p-4">
            <div className="text-sm font-medium text-white mb-2">最低配置</div>
            <ul className="text-xs text-gray-400 space-y-1">
              <li>• 2 CPU cores</li>
              <li>• 4 GB RAM</li>
              <li>• 20 GB 磁盘空间</li>
            </ul>
          </div>
          <div className="bg-dark-200 rounded-lg p-4">
            <div className="text-sm font-medium text-white mb-2">推荐配置</div>
            <ul className="text-xs text-gray-400 space-y-1">
              <li>• 4 CPU cores</li>
              <li>• 8 GB RAM</li>
              <li>• 50 GB 磁盘空间</li>
            </ul>
          </div>
          <div className="bg-dark-200 rounded-lg p-4">
            <div className="text-sm font-medium text-white mb-2">软件要求</div>
            <ul className="text-xs text-gray-400 space-y-1">
              <li>• Docker 20.10+</li>
              <li>• Docker Compose 2.0+</li>
              <li>• Linux/macOS/Windows</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
