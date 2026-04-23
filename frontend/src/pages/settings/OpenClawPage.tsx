import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Save, 
  TestTube, 
  Database, 
  RefreshCw,
  AlertCircle,
  CheckCircle,
  XCircle,
  Settings,
  Link,
  Zap,
  Info,
  Wifi,
  WifiOff,
  Download
} from 'lucide-react';
import { useOpenClawStore } from '../../stores/openclaw';

export const OpenClawPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    config,
    connectionStatus,
    availableAgents,
    setConfig,
    saveConfig,
    testConnection,
    fetchAgents,
    syncFromOpenClaw,
    reset,
    debugImportDemoAgents,
    connectWs,
    disconnectWs
  } = useOpenClawStore();
  
  const [showPreview, setShowPreview] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isFetching, setIsFetching] = useState(false);

  useEffect(() => {
    if (config.enabled && !connectionStatus.connected) {
      testConnection();
    }
  }, []);

  const handleTestConnection = async () => {
    setIsTesting(true);
    try {
      await testConnection();
    } finally {
      setIsTesting(false);
    }
  };

  const handlePreview = async () => {
    setIsFetching(true);
    setShowPreview(true);
    try {
      await fetchAgents();
    } finally {
      setIsFetching(false);
    }
  };

  const handleSyncFrom = async () => {
    setIsSyncing(true);
    try {
      await syncFromOpenClaw();
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDebugImport = () => {
    debugImportDemoAgents();
  };

  const handleSave = () => {
    saveConfig();
    alert('配置已保存');
  };

  const handleReset = () => {
    if (confirm('确定要重置所有 OpenClaw 配置吗？')) {
      reset();
    }
  };

  const getStatusColor = () => {
    if (connectionStatus.connected) return 'text-green-400';
    if (connectionStatus.status === '演示模式') return 'text-yellow-400';
    if (connectionStatus.error) return 'text-red-400';
    return 'text-gray-400';
  };

  const getStatusIcon = () => {
    if (connectionStatus.connected) return <Wifi size={16} className="text-green-400" />;
    return <WifiOff size={16} className="text-gray-400" />;
  };

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
              <h1 className="text-xl font-semibold text-white">OpenClaw 集成</h1>
              <p className="text-sm text-gray-400">
                连接 OpenClaw，实现 Agents 同步
              </p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="p-6 space-y-6">
        
        <div className="bg-dark-300 rounded-xl border border-dark-100 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Link size={20} className="text-primary-400" />
            <h2 className="text-lg font-medium text-white">连接状态</h2>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              {getStatusIcon()}
              <div>
                <span className={`font-medium ${getStatusColor()}`}>
                  {connectionStatus.status}
                </span>
                {connectionStatus.error && (
                  <p className="text-sm text-red-400 mt-1">
                    {connectionStatus.error}
                  </p>
                )}
              </div>
            </div>
            
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleTestConnection}
                disabled={isTesting}
                className="flex items-center gap-2 px-4 py-2 bg-secondary-600 hover:bg-secondary-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {isTesting ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    连接中...
                  </>
                ) : (
                  <>
                    <TestTube size={16} />
                    测试连接
                  </>
                )}
              </button>
              
              {connectionStatus.connected && (
                <button
                  onClick={disconnectWs}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  <WifiOff size={16} />
                  断开连接
                </button>
              )}
            </div>
          </div>
        </div>
        
        <div className="bg-dark-300 rounded-xl border border-dark-100 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Settings size={20} className="text-primary-400" />
            <h2 className="text-lg font-medium text-white">配置</h2>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-white font-medium">启用集成</label>
              <button
                onClick={() => setConfig({ enabled: !config.enabled })}
                className={`w-12 h-6 rounded-full transition-colors ${
                  config.enabled ? 'bg-primary-500' : 'bg-gray-600'
                }`}
              >
                <div className={`w-4 h-4 rounded-full bg-white shadow transform transition-transform ${
                  config.enabled ? 'translate-x-7' : 'translate-x-1'
                }`} />
              </button>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                OpenClaw Gateway URL
              </label>
              <input
                type="text"
                value={config.gatewayUrl || 'ws://localhost:10099'}
                onChange={(e) => setConfig({ gatewayUrl: e.target.value })}
                className="w-full px-3 py-2 bg-dark-200 border border-dark-100 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="ws://localhost:10099"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Gateway Token
              </label>
              <input
                type="password"
                value={config.gatewayToken || ''}
                onChange={(e) => setConfig({ gatewayToken: e.target.value })}
                className="w-full px-3 py-2 bg-dark-200 border border-dark-100 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="输入 token"
              />
            </div>
            
            <div className="flex items-center justify-between">
              <label className="text-white font-medium">使用 Vite 代理</label>
              <button
                onClick={() => setConfig({ useProxy: !config.useProxy })}
                className={`w-12 h-6 rounded-full transition-colors ${
                  config.useProxy !== false ? 'bg-primary-500' : 'bg-gray-600'
                }`}
              >
                <div className={`w-4 h-4 rounded-full bg-white shadow transform transition-transform ${
                  config.useProxy !== false ? 'translate-x-7' : 'translate-x-1'
                }`} />
              </button>
            </div>
            
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <Info size={16} className="text-blue-400 mt-0.5" />
                <p className="text-sm text-blue-300">
                  <strong>提示：</strong>如果 OpenClaw Gateway 正在运行，测试连接后会自动获取真实数据。
                  否则会使用演示数据进行测试。
                </p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-dark-300 rounded-xl border border-dark-100 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Database size={20} className="text-primary-400" />
            <h2 className="text-lg font-medium text-white">同步操作</h2>
          </div>
          
          <div className="space-y-4">
            {config.lastSyncTime && (
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <CheckCircle size={14} className="text-green-400" />
                <span>最后同步：{config.lastSyncTime.toLocaleString()}</span>
              </div>
            )}
            
            {config.syncResult && config.syncResult.imported > 0 && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                <p className="text-sm text-green-400">
                  成功导入 {config.syncResult.imported} 个 Agents
                </p>
              </div>
            )}
            
            {config.syncResult && config.syncResult.errors.length > 0 && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                <p className="text-sm text-red-400">
                  {config.syncResult.errors[0]}
                </p>
              </div>
            )}
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                onClick={handlePreview}
                disabled={isFetching}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-dark-200 hover:bg-dark-100 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {isFetching ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    获取中...
                  </>
                ) : (
                  <>
                    <RefreshCw size={16} />
                    预览
                  </>
                )}
              </button>
              
              <button
                onClick={handleSyncFrom}
                disabled={isSyncing || availableAgents.length === 0}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {isSyncing ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    同步中...
                  </>
                ) : (
                  <>
                    <Download size={16} />
                    从 OpenClaw 导入
                  </>
                )}
              </button>
              
              <button
                onClick={handleDebugImport}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <Zap size={16} />
                导入演示数据
              </button>
            </div>
          </div>
        </div>
        
        {showPreview && availableAgents.length > 0 && (
          <div className="bg-dark-300 rounded-xl border border-dark-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-white">OpenClaw Agents</h2>
              <span className="text-sm text-gray-400">
                {availableAgents.length} 个 Agents
              </span>
            </div>
            
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {availableAgents.map((agent) => (
                <div
                  key={agent.id}
                  className="flex items-center gap-3 p-3 bg-dark-200 rounded-lg"
                >
                  <div className="w-10 h-10 rounded-full bg-secondary-600 flex items-center justify-center text-xl">
                    {agent.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white truncate">
                        {agent.name}
                      </span>
                    </div>
                    <span className="text-sm text-gray-500 truncate">
                      {agent.role}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-dark-100">
          <button
            onClick={() => navigate('/settings')}
            className="px-4 py-2 bg-dark-200 hover:bg-dark-100 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            返回
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <Save size={16} />
            保存配置
          </button>
          <button
            onClick={handleReset}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <XCircle size={16} />
            重置配置
          </button>
        </div>
      </div>
    </div>
  );
};
