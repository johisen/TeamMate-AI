import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Lock, Save, X, Copy, RefreshCw, Check } from 'lucide-react'
import { useLogStore } from '@/stores'

export const ApiKeysPage: React.FC = () => {
  const navigate = useNavigate()
  const { addLog } = useLogStore()
  const [apiKeys, setApiKeys] = useState({
    openai: '',
    anthropic: '',
    deepseek: '',
    qwen: '',
    kimi: '',
    glm: ''
  })
  const [originalKeys, setOriginalKeys] = useState({
    openai: '',
    anthropic: '',
    deepseek: '',
    qwen: '',
    kimi: '',
    glm: ''
  })
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [defaultModel, setDefaultModel] = useState<string>('')
  const [isSettingDefault, setIsSettingDefault] = useState(false)

  // 从后端获取API密钥和默认模型
  useEffect(() => {
    const fetchApiKeys = async () => {
      try {
        // 获取API密钥
        const keysResponse = await fetch('/api/v1/llm/keys')
        if (keysResponse.ok) {
          const keysData = await keysResponse.json()
          setApiKeys(keysData.keys || {})
          setOriginalKeys(keysData.keys || {})
        }

        // 获取默认模型
        const defaultModelResponse = await fetch('/api/v1/llm/default-model')
        if (defaultModelResponse.ok) {
          const defaultModelData = await defaultModelResponse.json()
          setDefaultModel(defaultModelData.default_model || '')
        }
      } catch (error) {
        console.error('获取API密钥失败:', error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchApiKeys()
  }, [])

  const handleSave = async (key: string) => {
    try {
      const response = await fetch('/api/v1/llm/keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ [key]: apiKeys[key as keyof typeof apiKeys] }),
      })
      if (response.ok) {
        const data = await response.json()
        alert(data.message || 'API密钥已保存')
        
        // 记录操作日志
        addLog('info', 'API密钥已保存', 'API设置', `修改了${key}模型的API密钥配置`)
        
        setEditingKey(null)
        // 重新获取密钥列表
        const keysResponse = await fetch('/api/v1/llm/keys')
        if (keysResponse.ok) {
          const keysData = await keysResponse.json()
          setApiKeys(keysData.keys || {})
          setOriginalKeys(keysData.keys || {})
        }
      }
    } catch (error) {
      console.error('保存API密钥失败:', error)
      // 记录错误日志
      addLog('error', 'API密钥保存失败', 'API设置', error instanceof Error ? error.message : '未知错误')
      alert('保存失败，请重试')
    }
  }

  const handleCancel = (key: string) => {
    setEditingKey(null)
    // 恢复原始值
    setApiKeys(prev => ({
      ...prev,
      [key]: originalKeys[key as keyof typeof originalKeys]
    }))
  }

  const handleBack = () => {
    navigate('/settings')
  }

  const handleChange = (key: keyof typeof apiKeys, value: string) => {
    setApiKeys(prev => ({
      ...prev,
      [key]: value
    }))
  }

  const handleSetDefaultModel = async (model: string) => {
    try {
      setIsSettingDefault(true)
      const response = await fetch('/api/v1/llm/default-model', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model }),
      })
      if (response.ok) {
        const data = await response.json()
        alert(data.message || '默认模型已设置')
        setDefaultModel(model)
        
        // 记录操作日志
        addLog('info', '默认模型已设置', 'API设置', `设置了${model}为默认模型`)
      }
    } catch (error) {
      console.error('设置默认模型失败:', error)
      addLog('error', '默认模型设置失败', 'API设置', error instanceof Error ? error.message : '未知错误')
      alert('设置失败，请重试')
    } finally {
      setIsSettingDefault(false)
    }
  }



  if (isLoading) {
    return (
      <div className="h-full bg-dark-400 flex items-center justify-center">
        <div className="text-gray-400">加载中...</div>
      </div>
    )
  }

  return (
    <div className="h-full bg-dark-400 overflow-y-auto">
      {/* 头部 */}
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
              <h1 className="text-xl font-semibold text-white">API 密钥</h1>
              <p className="text-sm text-gray-400">
                管理 API 密钥配置
              </p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="p-6">

        <div className="bg-dark-300 border border-dark-100 rounded-xl p-6">
          <div className="space-y-4">
            {/* 国际大模型 */}
            <div>
              <h3 className="text-sm font-medium text-gray-300 mb-3">国际大模型</h3>

              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-gray-400">
                      OpenAI API Key
                    </label>
                    <button
                      onClick={() => handleSetDefaultModel('gpt-4o')}
                      disabled={isSettingDefault || defaultModel === 'gpt-4o'}
                      className={`text-xs flex items-center gap-1 px-2 py-1 rounded transition-colors ${
                        defaultModel === 'gpt-4o' 
                          ? 'bg-primary-600 text-white' 
                          : 'bg-dark-200 hover:bg-dark-100 text-gray-400 hover:text-white'
                      }`}
                    >
                      {defaultModel === 'gpt-4o' && <Check size={12} />}
                      {isSettingDefault ? '设置中...' : '设为默认'}
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type={editingKey === 'openai' ? 'text' : 'password'}
                      value={apiKeys.openai}
                      onChange={(e) => handleChange('openai', e.target.value)}
                      disabled={editingKey !== 'openai'}
                      className="flex-1 px-3 py-2 bg-dark-200 border border-dark-100 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder={apiKeys.openai || '输入OpenAI API Key'}
                    />
                    {editingKey === 'openai' ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleSave('openai')}
                          className="px-3 py-1 bg-primary-600 hover:bg-primary-700 text-white text-xs font-medium rounded transition-colors"
                        >
                          保存
                        </button>
                        <button
                          onClick={() => handleCancel('openai')}
                          className="px-3 py-1 text-gray-400 hover:text-white text-xs font-medium rounded transition-colors"
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setEditingKey('openai')}
                        className="px-3 py-1 bg-dark-200 hover:bg-dark-100 text-white text-xs font-medium rounded transition-colors"
                      >
                        修改
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-gray-400">
                      Anthropic API Key
                    </label>
                    <button
                      onClick={() => handleSetDefaultModel('claude-sonnet-4-20250514')}
                      disabled={isSettingDefault || defaultModel === 'claude-sonnet-4-20250514'}
                      className={`text-xs flex items-center gap-1 px-2 py-1 rounded transition-colors ${
                        defaultModel === 'claude-sonnet-4-20250514' 
                          ? 'bg-primary-600 text-white' 
                          : 'bg-dark-200 hover:bg-dark-100 text-gray-400 hover:text-white'
                      }`}
                    >
                      {defaultModel === 'claude-sonnet-4-20250514' && <Check size={12} />}
                      {isSettingDefault ? '设置中...' : '设为默认'}
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type={editingKey === 'anthropic' ? 'text' : 'password'}
                      value={apiKeys.anthropic}
                      onChange={(e) => handleChange('anthropic', e.target.value)}
                      disabled={editingKey !== 'anthropic'}
                      className="flex-1 px-3 py-2 bg-dark-200 border border-dark-100 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder={apiKeys.anthropic || '输入Anthropic API Key'}
                    />
                    {editingKey === 'anthropic' ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleSave('anthropic')}
                          className="px-3 py-1 bg-primary-600 hover:bg-primary-700 text-white text-xs font-medium rounded transition-colors"
                        >
                          保存
                        </button>
                        <button
                          onClick={() => handleCancel('anthropic')}
                          className="px-3 py-1 text-gray-400 hover:text-white text-xs font-medium rounded transition-colors"
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setEditingKey('anthropic')}
                        className="px-3 py-1 bg-dark-200 hover:bg-dark-100 text-white text-xs font-medium rounded transition-colors"
                      >
                        修改
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 国内大模型 */}
            <div className="pt-4 border-t border-dark-100">
              <h3 className="text-sm font-medium text-gray-300 mb-3">国内大模型</h3>

              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-gray-400">
                      智谱AI GLM API Key
                    </label>
                    <button
                      onClick={() => handleSetDefaultModel('glm-4.7-flash')}
                      disabled={isSettingDefault || defaultModel === 'glm-4.7-flash'}
                      className={`text-xs flex items-center gap-1 px-2 py-1 rounded transition-colors ${
                        defaultModel === 'glm-4.7-flash' 
                          ? 'bg-primary-600 text-white' 
                          : 'bg-dark-200 hover:bg-dark-100 text-gray-400 hover:text-white'
                      }`}
                    >
                      {defaultModel === 'glm-4.7-flash' && <Check size={12} />}
                      {isSettingDefault ? '设置中...' : '设为默认'}
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type={editingKey === 'glm' ? 'text' : 'password'}
                      value={apiKeys.glm}
                      onChange={(e) => handleChange('glm', e.target.value)}
                      disabled={editingKey !== 'glm'}
                      className="flex-1 px-3 py-2 bg-dark-200 border border-dark-100 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder={apiKeys.glm || '输入智谱AI GLM API Key'}
                    />
                    {editingKey === 'glm' ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleSave('glm')}
                          className="px-3 py-1 bg-primary-600 hover:bg-primary-700 text-white text-xs font-medium rounded transition-colors"
                        >
                          保存
                        </button>
                        <button
                          onClick={() => handleCancel('glm')}
                          className="px-3 py-1 text-gray-400 hover:text-white text-xs font-medium rounded transition-colors"
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setEditingKey('glm')}
                        className="px-3 py-1 bg-dark-200 hover:bg-dark-100 text-white text-xs font-medium rounded transition-colors"
                      >
                        修改
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-gray-400">
                      DeepSeek API Key
                    </label>
                    <button
                      onClick={() => handleSetDefaultModel('deepseek-chat')}
                      disabled={isSettingDefault || defaultModel === 'deepseek-chat'}
                      className={`text-xs flex items-center gap-1 px-2 py-1 rounded transition-colors ${
                        defaultModel === 'deepseek-chat' 
                          ? 'bg-primary-600 text-white' 
                          : 'bg-dark-200 hover:bg-dark-100 text-gray-400 hover:text-white'
                      }`}
                    >
                      {defaultModel === 'deepseek-chat' && <Check size={12} />}
                      {isSettingDefault ? '设置中...' : '设为默认'}
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type={editingKey === 'deepseek' ? 'text' : 'password'}
                      value={apiKeys.deepseek}
                      onChange={(e) => handleChange('deepseek', e.target.value)}
                      disabled={editingKey !== 'deepseek'}
                      className="flex-1 px-3 py-2 bg-dark-200 border border-dark-100 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder={apiKeys.deepseek || '输入DeepSeek API Key'}
                    />
                    {editingKey === 'deepseek' ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleSave('deepseek')}
                          className="px-3 py-1 bg-primary-600 hover:bg-primary-700 text-white text-xs font-medium rounded transition-colors"
                        >
                          保存
                        </button>
                        <button
                          onClick={() => handleCancel('deepseek')}
                          className="px-3 py-1 text-gray-400 hover:text-white text-xs font-medium rounded transition-colors"
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setEditingKey('deepseek')}
                        className="px-3 py-1 bg-dark-200 hover:bg-dark-100 text-white text-xs font-medium rounded transition-colors"
                      >
                        修改
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-gray-400">
                      阿里云通义千问 API Key
                    </label>
                    <button
                      onClick={() => handleSetDefaultModel('qwen-plus')}
                      disabled={isSettingDefault || defaultModel === 'qwen-plus'}
                      className={`text-xs flex items-center gap-1 px-2 py-1 rounded transition-colors ${
                        defaultModel === 'qwen-plus' 
                          ? 'bg-primary-600 text-white' 
                          : 'bg-dark-200 hover:bg-dark-100 text-gray-400 hover:text-white'
                      }`}
                    >
                      {defaultModel === 'qwen-plus' && <Check size={12} />}
                      {isSettingDefault ? '设置中...' : '设为默认'}
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type={editingKey === 'qwen' ? 'text' : 'password'}
                      value={apiKeys.qwen}
                      onChange={(e) => handleChange('qwen', e.target.value)}
                      disabled={editingKey !== 'qwen'}
                      className="flex-1 px-3 py-2 bg-dark-200 border border-dark-100 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder={apiKeys.qwen || '输入阿里云通义千问 API Key'}
                    />
                    {editingKey === 'qwen' ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleSave('qwen')}
                          className="px-3 py-1 bg-primary-600 hover:bg-primary-700 text-white text-xs font-medium rounded transition-colors"
                        >
                          保存
                        </button>
                        <button
                          onClick={() => handleCancel('qwen')}
                          className="px-3 py-1 text-gray-400 hover:text-white text-xs font-medium rounded transition-colors"
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setEditingKey('qwen')}
                        className="px-3 py-1 bg-dark-200 hover:bg-dark-100 text-white text-xs font-medium rounded transition-colors"
                      >
                        修改
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-gray-400">
                      Kimi API Key
                    </label>
                    <button
                      onClick={() => handleSetDefaultModel('moonshot-v1-8k')}
                      disabled={isSettingDefault || defaultModel === 'moonshot-v1-8k'}
                      className={`text-xs flex items-center gap-1 px-2 py-1 rounded transition-colors ${
                        defaultModel === 'moonshot-v1-8k' 
                          ? 'bg-primary-600 text-white' 
                          : 'bg-dark-200 hover:bg-dark-100 text-gray-400 hover:text-white'
                      }`}
                    >
                      {defaultModel === 'moonshot-v1-8k' && <Check size={12} />}
                      {isSettingDefault ? '设置中...' : '设为默认'}
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type={editingKey === 'kimi' ? 'text' : 'password'}
                      value={apiKeys.kimi}
                      onChange={(e) => handleChange('kimi', e.target.value)}
                      disabled={editingKey !== 'kimi'}
                      className="flex-1 px-3 py-2 bg-dark-200 border border-dark-100 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder={apiKeys.kimi || '输入Kimi API Key'}
                    />
                    {editingKey === 'kimi' ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleSave('kimi')}
                          className="px-3 py-1 bg-primary-600 hover:bg-primary-700 text-white text-xs font-medium rounded transition-colors"
                        >
                          保存
                        </button>
                        <button
                          onClick={() => handleCancel('kimi')}
                          className="px-3 py-1 text-gray-400 hover:text-white text-xs font-medium rounded transition-colors"
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setEditingKey('kimi')}
                        className="px-3 py-1 bg-dark-200 hover:bg-dark-100 text-white text-xs font-medium rounded transition-colors"
                      >
                        修改
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-6">
              <button 
                onClick={handleBack}
                className="px-4 py-2 bg-dark-200 hover:bg-dark-100 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                <X size={16} />
                返回
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}