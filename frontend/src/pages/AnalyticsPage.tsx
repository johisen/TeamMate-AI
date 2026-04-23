import React, { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts'
import { TrendingUp, BarChart2, Users, Calendar, Clock, Settings } from 'lucide-react'

interface UsageStats {
  total_token_count: number
  total_message_count: number
  by_date: Array<{
    date: string
    token_count: number
    message_count: number
  }>
  by_agent: Array<{
    agent_id: string
    token_count: number
    message_count: number
  }>
}

interface Agent {
  id: string
  name: string
  role: string
  avatar?: string
}

interface StatsSummary {
  totalTokens: number
  totalMessages: number
  averageTokensPerMessage: number
  totalCost: number
}

export const AnalyticsPage: React.FC = () => {
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null)
  const [agents, setAgents] = useState<Agent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [timeRange, setTimeRange] = useState('7d')

  useEffect(() => {
    fetchStats()
    fetchAgents()
  }, [timeRange])

  const fetchStats = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/v1/usage-stats?start_date=${getStartDate()}&end_date=${getEndDate()}`)
      if (response.ok) {
        const data = await response.json()
        setUsageStats(data)
      }
    } catch (error) {
      console.error('Failed to fetch usage stats:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchAgents = async () => {
    try {
      const response = await fetch('/api/v1/agents')
      if (response.ok) {
        const data = await response.json()
        setAgents(data)
      }
    } catch (error) {
      console.error('Failed to fetch agents:', error)
    }
  }

  const getStartDate = (): string => {
    const date = new Date()
    switch (timeRange) {
      case '7d':
        date.setDate(date.getDate() - 7)
        break
      case '30d':
        date.setDate(date.getDate() - 30)
        break
      case '90d':
        date.setDate(date.getDate() - 90)
        break
    }
    return date.toISOString().split('T')[0]
  }

  const getEndDate = (): string => {
    return new Date().toISOString().split('T')[0]
  }

  const getStatsSummary = (): StatsSummary => {
    if (!usageStats) {
      return {
        totalTokens: 0,
        totalMessages: 0,
        averageTokensPerMessage: 0,
        totalCost: 0
      }
    }

    const totalTokens = usageStats.total_token_count
    const totalMessages = usageStats.total_message_count
    const averageTokensPerMessage = totalMessages > 0 ? totalTokens / totalMessages : 0
    const totalCost = totalTokens * 0.0000015 // Approximate cost for GPT-3.5

    return {
      totalTokens,
      totalMessages,
      averageTokensPerMessage,
      totalCost
    }
  }

  const getAgentName = (agentId: string): string => {
    const agent = agents.find(a => a.id === agentId)
    return agent?.name || `Agent ${agentId.substring(0, 8)}`
  }

  const summary = getStatsSummary()
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d']

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-400">加载中...</div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 p-6 border-b border-dark-100">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">用量统计</h1>
            <p className="text-gray-400">查看团队的 AI 使用情况</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setTimeRange('7d')}
              className={`px-3 py-1 rounded-md text-sm ${timeRange === '7d' ? 'bg-primary-600 text-white' : 'bg-dark-200 text-gray-400 hover:bg-dark-100'}`}
            >
              7 天
            </button>
            <button
              onClick={() => setTimeRange('30d')}
              className={`px-3 py-1 rounded-md text-sm ${timeRange === '30d' ? 'bg-primary-600 text-white' : 'bg-dark-200 text-gray-400 hover:bg-dark-100'}`}
            >
              30 天
            </button>
            <button
              onClick={() => setTimeRange('90d')}
              className={`px-3 py-1 rounded-md text-sm ${timeRange === '90d' ? 'bg-primary-600 text-white' : 'bg-dark-200 text-gray-400 hover:bg-dark-100'}`}
            >
              90 天
            </button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-dark-300 rounded-xl p-4 border border-dark-100">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-primary-600/20 rounded-lg flex items-center justify-center">
                  <TrendingUp size={20} className="text-primary-400" />
                </div>
                <h3 className="text-sm font-medium text-gray-400">总 Token</h3>
              </div>
            </div>
            <div className="text-2xl font-bold text-white">{summary.totalTokens.toLocaleString()}</div>
            <div className="text-xs text-gray-500 mt-1">
              平均每条消息 {summary.averageTokensPerMessage.toFixed(1)} Token
            </div>
          </div>

          <div className="bg-dark-300 rounded-xl p-4 border border-dark-100">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-secondary-600/20 rounded-lg flex items-center justify-center">
                  <BarChart2 size={20} className="text-secondary-400" />
                </div>
                <h3 className="text-sm font-medium text-gray-400">消息数</h3>
              </div>
            </div>
            <div className="text-2xl font-bold text-white">{summary.totalMessages.toLocaleString()}</div>
            <div className="text-xs text-gray-500 mt-1">
              按时间范围计算
            </div>
          </div>

          <div className="bg-dark-300 rounded-xl p-4 border border-dark-100">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-green-600/20 rounded-lg flex items-center justify-center">
                  <Users size={20} className="text-green-400" />
                </div>
                <h3 className="text-sm font-medium text-gray-400">活跃 AI</h3>
              </div>
            </div>
            <div className="text-2xl font-bold text-white">{usageStats?.by_agent.length || 0}</div>
            <div className="text-xs text-gray-500 mt-1">
              有活动的 AI 员工
            </div>
          </div>

          <div className="bg-dark-300 rounded-xl p-4 border border-dark-100">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-yellow-600/20 rounded-lg flex items-center justify-center">
                  <Clock size={20} className="text-yellow-400" />
                </div>
                <h3 className="text-sm font-medium text-gray-400">预估成本</h3>
              </div>
            </div>
            <div className="text-2xl font-bold text-white">${summary.totalCost.toFixed(4)}</div>
            <div className="text-xs text-gray-500 mt-1">
              基于 GPT-3.5 定价
            </div>
          </div>
        </div>
      </div>

      {/* Charts - scrollable area */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-dark-300 rounded-xl p-4 border border-dark-100">
            <h3 className="text-lg font-medium text-white mb-4">Token 使用趋势</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={usageStats?.by_date || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="date" stroke="#888" />
                  <YAxis stroke="#888" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e1e2e', border: '1px solid #333' }}
                    labelStyle={{ color: '#fff' }}
                  />
                  <Line type="monotone" dataKey="token_count" stroke="#0088FE" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-dark-300 rounded-xl p-4 border border-dark-100">
            <h3 className="text-lg font-medium text-white mb-4">消息数量趋势</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={usageStats?.by_date || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="date" stroke="#888" />
                  <YAxis stroke="#888" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e1e2e', border: '1px solid #333' }}
                    labelStyle={{ color: '#fff' }}
                  />
                  <Bar dataKey="message_count" fill="#00C49F" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Agent usage */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-dark-300 rounded-xl p-4 border border-dark-100">
            <h3 className="text-lg font-medium text-white mb-4">AI 员工 Token 使用</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={usageStats?.by_agent.map(item => ({
                    name: getAgentName(item.agent_id),
                    token_count: item.token_count
                  })) || []}
                  layout="vertical"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis type="number" stroke="#888" />
                  <YAxis type="category" dataKey="name" stroke="#888" width={100} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e1e2e', border: '1px solid #333' }}
                    labelStyle={{ color: '#fff' }}
                  />
                  <Bar dataKey="token_count" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-dark-300 rounded-xl p-4 border border-dark-100">
            <h3 className="text-lg font-medium text-white mb-4">AI 员工使用占比</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={usageStats?.by_agent.map(item => ({
                      name: getAgentName(item.agent_id),
                      value: item.token_count
                    })) || []}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {usageStats?.by_agent.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e1e2e', border: '1px solid #333' }}
                    labelStyle={{ color: '#fff' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}