import React, { useState } from 'react'
import { ArrowLeft, RefreshCw, Info, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export const OpenClawApiExplorer: React.FC = () => {
  const navigate = useNavigate()
  const [url, setUrl] = useState('http://127.0.0.1:10099')
  const [token, setToken] = useState('26237ab3b10049e66250ad2cc4019528c22964788288004f')
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const testEndpoints = [
    '/',
    '/agents',
    '/api/agents',
    '/api/v1/agents',
    '/health',
    '/status',
    '/api/health',
    '/api/status'
  ]

  const testEndpoint = async (endpoint: string) => {
    try {
      const fullUrl = `${url}${endpoint}`
      const response = await fetch(fullUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      const contentType = response.headers.get('content-type') || ''
      let data

      if (contentType.includes('application/json')) {
        data = await response.json()
      } else {
        data = await response.text()
      }

      return {
        endpoint,
        status: response.status,
        statusText: response.statusText,
        contentType,
        data,
        success: response.ok
      }
    } catch (error) {
      return {
        endpoint,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  const runTests = async () => {
    setLoading(true)
    setResults([])

    for (const endpoint of testEndpoints) {
      const result = await testEndpoint(endpoint)
      setResults(prev => [...prev, result])
    }

    setLoading(false)
  }

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
              <h1 className="text-xl font-semibold text-white">OpenClaw API 探索工具</h1>
              <p className="text-sm text-gray-400">
                测试 OpenClaw API 端点
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="bg-dark-300 border border-dark-100 rounded-xl p-4 mb-4">
          <div className="flex gap-4 mb-4">
            <div className="flex-1">
              <label className="block text-sm text-gray-400 mb-1">Gateway URL</label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full px-3 py-2 bg-dark-200 border border-dark-100 rounded-lg text-white"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm text-gray-400 mb-1">Token</label>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="w-full px-3 py-2 bg-dark-200 border border-dark-100 rounded-lg text-white"
              />
            </div>
          </div>

          <button
            onClick={runTests}
            disabled={loading}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-lg flex items-center gap-2"
          >
            {loading && <RefreshCw size={16} className="animate-spin" />}
            测试端点
          </button>
        </div>

        <div className="space-y-3">
          {results.map((result, index) => (
            <div
              key={index}
              className={`p-4 rounded-lg border ${
                result.success
                  ? 'bg-green-900/20 border-green-500/30'
                  : 'bg-red-900/20 border-red-500/30'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`font-mono text-sm ${result.success ? 'text-green-400' : 'text-red-400'}`}>
                  {result.endpoint}
                </span>
                <span className="text-xs text-gray-400">
                  {result.status ? `${result.status} ${result.statusText}` : 'Failed'}
                </span>
              </div>
              {result.data && (
                <details className="mt-2">
                  <summary className="text-sm text-gray-400 cursor-pointer">查看数据</summary>
                  <pre className="mt-2 p-2 bg-dark-200 rounded text-xs text-gray-300 overflow-x-auto max-h-40 overflow-y-auto">
                    {typeof result.data === 'string'
                      ? result.data
                      : JSON.stringify(result.data, null, 2)
                    }
                  </pre>
                </details>
              )}
              {result.error && (
                <p className="text-sm text-red-400">{result.error}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}