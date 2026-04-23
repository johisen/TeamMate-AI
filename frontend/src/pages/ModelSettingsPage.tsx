import React, { useState, useEffect } from 'react'
import { Bot, CheckCircle, XCircle, Settings, Key, Globe, Server } from 'lucide-react'

interface LLMProvider {
  id: string
  name: string
  default_model: string
  api_key_env: string
  supports_functions: boolean
  configured: boolean
  base_url?: string
}

export const ModelSettingsPage: React.FC = () => {
  const [providers, setProviders] = useState<LLMProvider[]>([])
  const [selectedProvider, setSelectedProvider] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [testingConnection, setTestingConnection] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  useEffect(() => {
    fetchProviders()
  }, [])

  const fetchProviders = async () => {
    try {
      const response = await fetch('/api/v1/llm/providers')
      if (response.ok) {
        const data = await response.json()
        setProviders(data.providers)
        if (data.providers.length > 0) {
          setSelectedProvider(data.providers[0].id)
        }
      }
    } catch (error) {
      console.error('Failed to fetch providers:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleTestConnection = async (providerId: string, model: string) => {
    setTestingConnection(true)
    setTestResult(null)

    try {
      const response = await fetch('/api/v1/llm/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: providerId, model })
      })

      const result = await response.json()
      setTestResult(result)
    } catch (error) {
      setTestResult({
        success: false,
        message: `连接失败: ${error}`
      })
    } finally {
      setTestingConnection(false)
    }
  }

  const getProviderIcon = (providerId: string) => {
    switch (providerId) {
      case 'openai':
        return <Bot size={20} className="text-green-400" />
      case 'anthropic':
        return <Bot size={20} className="text-orange-400" />
      case 'deepseek':
        return <Bot size={20} className="text-blue-400" />
      case 'qwen':
        return <Globe size={20} className="text-orange-400" />
      case 'kimi':
        return <Bot size={20} className="text-purple-400" />
      case 'ollama':
        return <Server size={20} className="text-green-400" />
      default:
        return <Bot size={20} className="text-gray-400" />
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
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">模型配置</h1>
        <p className="text-gray-400">配置 LLM 模型提供商和 API Keys</p>
      </div>

      {/* Provider List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {providers.map(provider => (
          <div
            key={provider.id}
            onClick={() => setSelectedProvider(provider.id)}
            className={`bg-dark-300 rounded-xl p-4 border cursor-pointer transition-all ${
              selectedProvider === provider.id
                ? 'border-primary-500 bg-primary-600/10'
                : 'border-dark-100 hover:border-primary-500/50'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                {getProviderIcon(provider.id)}
                <div>
                  <div className="font-medium text-white">{provider.name}</div>
                  <div className="text-xs text-gray-400">{provider.id}</div>
                </div>
              </div>
              {provider.configured ? (
                <div className="flex items-center gap-1 text-green-400">
                  <CheckCircle size={16} />
                  <span className="text-xs">已配置</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-gray-400">
                  <XCircle size={16} />
                  <span className="text-xs">未配置</span>
                </div>
              )}
            </div>

            <div className="text-xs text-gray-400">
              <div>默认模型: {provider.default_model}</div>
              <div>支持函数调用: {provider.supports_functions ? '是' : '否'}</div>
            </div>

            {!provider.configured && (
              <div className="mt-3 p-2 bg-dark-200 rounded-lg">
                <div className="text-xs text-gray-400 mb-1">环境变量:</div>
                <code className="text-xs text-primary-400">{provider.api_key_env}</code>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Selected Provider Details */}
      {selectedProvider && (
        <div className="bg-dark-300 rounded-xl p-6 border border-dark-100">
          <div className="flex items-center gap-3 mb-6">
            {getProviderIcon(selectedProvider)}
            <h2 className="text-xl font-medium text-white">
              {providers.find(p => p.id === selectedProvider)?.name}
            </h2>
          </div>

          {/* Configuration Instructions */}
          <div className="space-y-4">
            <div className="bg-dark-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-white mb-2 flex items-center gap-2">
                <Key size={16} />
                API Key 配置
              </h3>
              <p className="text-sm text-gray-400 mb-2">
                请在环境变量或 <code className="text-primary-400">.env</code> 文件中设置以下变量:
              </p>
              <div className="bg-dark-300 rounded p-2 font-mono text-sm">
                <div className="text-gray-400"># {providers.find(p => p.id === selectedProvider)?.name}</div>
                <div className="text-green-400">
                  {providers.find(p => p.id === selectedProvider)?.api_key_env}=your_api_key_here
                </div>
              </div>
            </div>

            <div className="bg-dark-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-white mb-2 flex items-center gap-2">
                <Settings size={16} />
                可用模型
              </h3>
              <div className="flex flex-wrap gap-2">
                {getAvailableModels(selectedProvider).map(model => (
                  <span
                    key={model}
                    className="px-3 py-1 bg-dark-300 rounded-full text-sm text-gray-300"
                  >
                    {model}
                  </span>
                ))}
              </div>
            </div>

            {/* Test Connection */}
            <div className="bg-dark-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-white mb-2">测试连接</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => handleTestConnection(
                    selectedProvider,
                    providers.find(p => p.id === selectedProvider)?.default_model || ''
                  )}
                  disabled={testingConnection || !providers.find(p => p.id === selectedProvider)?.configured}
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {testingConnection ? '测试中...' : '测试连接'}
                </button>
              </div>

              {testResult && (
                <div className={`mt-3 p-3 rounded-lg ${
                  testResult.success ? 'bg-green-900/20 border border-green-600' : 'bg-red-900/20 border border-red-600'
                }`}>
                  <div className="flex items-center gap-2">
                    {testResult.success ? (
                      <CheckCircle size={16} className="text-green-400" />
                    ) : (
                      <XCircle size={16} className="text-red-400" />
                    )}
                    <span className={`text-sm ${testResult.success ? 'text-green-400' : 'text-red-400'}`}>
                      {testResult.message}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Quick Setup Guide */}
      <div className="mt-6 bg-dark-300 rounded-xl p-6 border border-dark-100">
        <h3 className="text-lg font-medium text-white mb-4">快速设置指南</h3>
        <div className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center text-white font-medium">1</div>
            <div>
              <div className="font-medium text-white mb-1">获取 API Key</div>
              <div className="text-sm text-gray-400">
                访问各模型提供商的官网注册账号并获取 API Key
              </div>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center text-white font-medium">2</div>
            <div>
              <div className="font-medium text-white mb-1">配置环境变量</div>
              <div className="text-sm text-gray-400">
                在 <code className="text-primary-400">.env</code> 文件中添加 API Key
              </div>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center text-white font-medium">3</div>
            <div>
              <div className="font-medium text-white mb-1">测试连接</div>
              <div className="text-sm text-gray-400">
                使用上面的测试功能验证配置是否正确
              </div>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center text-white font-medium">4</div>
            <div>
              <div className="font-medium text-white mb-1">开始使用</div>
              <div className="text-sm text-gray-400">
                配置完成后即可在创建 AI 员工时选择使用的模型
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function getAvailableModels(provider: string): string[] {
  const models: Record<string, string[]> = {
    openai: ['gpt-4', 'gpt-4-turbo-preview', 'gpt-3.5-turbo'],
    anthropic: ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'],
    deepseek: ['deepseek-chat', 'deepseek-coder'],
    qwen: ['qwen-turbo', 'qwen-plus', 'qwen-max'],
    kimi: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
    ollama: ['llama2', 'mistral', 'codellama'],
  }
  return models[provider] || []
}
